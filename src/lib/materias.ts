import type { EscalaMateria, EscalaTipo, EventoAgenda, Materia, Semestre } from "@/types/database";
import { materiaColors, type MateriaColorId, type Tone } from "@/theme/tokens";
import type { DemoMateria } from "@/data/demoContent";
import { formatHorario, nombreDesdePeriodo, PERIODO_ACTUAL } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { currentUserId, getSemestreActivoId } from "@/lib/semestres";
import { diffDias, parseISODate, today } from "@/lib/agenda";
import { rowToDemoEvaluacion } from "@/hooks/useAgenda";

// ============================================================
// Cálculo real (puerto de runtime.js, sección "vistas derivadas de
// materia" — ver computeMateria/computeMaterias/computeKpis/etc. y la
// skill cursada-conventions del repo cursada-design-system). Cada función
// acá abajo anota qué función de runtime.js replica. A diferencia de la
// web (que lee de un caché en memoria ya cargado, `loadMateriasRaw()`/
// `loadAgendaRaw()`), acá se reciben los arrays ya fetcheados de Supabase
// como parámetro — no hay caché global del lado mobile.
// ============================================================

// Réplica de APROBACION_EXAMEN_PENDIENTE (runtime.js): mínimo fijo del
// examen de una materia "pendiente" (debe rendir examen) — 70 sobre 100,
// documentado en el README de cursada-design-system, independiente del
// esc.aprob de la materia (ver escConAprobacionEfectiva/computeMateria).
const APROBACION_EXAMEN_PENDIENTE = 70;

// Réplica de MARGEN_RIESGO (runtime.js): margen de riesgo en escala 0-12,
// escalado al total de la materia por margenDe().
const MARGEN_RIESGO = 1;

function escalaDe(materia: Pick<Materia, "esc">): EscalaMateria {
  return "tipo" in materia.esc ? (materia.esc as EscalaMateria) : { tipo: "nota", total: 12, aprob: 6, exoneracion: null };
}

// Réplica exacta de escConAprobacionEfectiva(esc) (runtime.js): el catálogo
// ORT carga esc.aprob:0 para el sistema "examen con exoneración" (no hay
// mínimo propio del curso, sólo el umbral de exoneración) — acá se toma
// ese umbral como aprobación efectiva para toneDe/notaTxt/"Te faltan..."/
// el badge, sin tocar el esc.aprob crudo guardado en `materias`.
export function escConAprobacionEfectiva(esc: EscalaMateria): EscalaMateria {
  if (!esc || esc.aprob > 0 || esc.exoneracion == null) return esc;
  return { ...esc, aprob: esc.exoneracion };
}

// Réplica exacta de margenDe(e) (runtime.js).
export function margenDe(esc: Pick<EscalaMateria, "total">): number {
  return (MARGEN_RIESGO / 12) * esc.total;
}

// Réplica exacta de toneDe(estado, esc, parciales) (runtime.js) — "aprobada"
// siempre es success sin importar las notas; sin ninguna nota cargada es
// neutral; si no, promedio simple de `parciales` contra esc.aprob/margenDe.
export function toneDe(estado: Materia["estado"], esc: Pick<EscalaMateria, "aprob" | "total">, parciales: number[]): Tone {
  if (estado === "aprobada") return "success";
  if (!parciales.length) return "neutral";
  const a = parciales.reduce((x, y) => x + y, 0) / parciales.length;
  if (a < esc.aprob) return "danger";
  if (a < esc.aprob + margenDe(esc)) return "warning";
  return "success";
}

export type MateriaComputada = {
  raw: Materia;
  esc: EscalaMateria; // ya con escConAprobacionEfectiva + la salvedad de "pendiente" aplicadas
  actual: number | null;
  tone: Tone;
  necesita: number | null;
  riesgoTxt: string;
  items: EventoAgenda[]; // evaluaciones + tareas, ordenadas por fecha/hora
  evaluaciones: EventoAgenda[]; // sólo kind:'evaluacion'
  notasEvals: EventoAgenda[]; // evaluaciones ya calificadas
  parciales: number[];
};

// Réplica exacta de computeMateria(m, agendaAll) (runtime.js). Ojo: el
// promedio (`actual`) es un PROMEDIO SIMPLE de las notas ya cargadas +
// componentes fijos con valor — no pondera por nota_maxima de cada una
// (eso es un modelo aparte, exclusivo del simulador de escenarios, ver
// calcularSimulacion más abajo). Funciona porque, salvo que el usuario
// edite `nota_maxima` a mano, cada evaluación nueva hereda esc.total como
// su propio máximo (mismo criterio que notaMaximaDefault en runtime.js).
export function computeMateria(materia: Materia, agendaAll: EventoAgenda[]): MateriaComputada {
  const items = agendaAll
    .filter((a) => a.materia_id === materia.id)
    .sort((a, b) => parseISODate(a.fecha).getTime() - parseISODate(b.fecha).getTime() || (a.hora ?? "").localeCompare(b.hora ?? ""));
  const evaluaciones = items.filter((a) => a.kind === "evaluacion");
  const notasEvals = evaluaciones.filter((a) => a.nota != null);
  const componentesFijos = materia.componentes_fijos ?? [];
  const parciales = notasEvals
    .map((a) => a.nota as number)
    .concat(componentesFijos.filter((c) => c.valor != null).map((c) => c.valor as number));

  let esc = escConAprobacionEfectiva(escalaDe(materia));
  // "Debo rendir examen": llegar a este estado ya significa que se superó
  // el mínimo/exoneración de la cursada — de acá en adelante todo
  // (tone/notaTxt/"Te faltan"/riesgoTxt) tiene que ver el mínimo fijo del
  // examen, no el de la materia, y la exoneración deja de aplicar.
  if (materia.estado === "pendiente") esc = { ...esc, aprob: APROBACION_EXAMEN_PENDIENTE, exoneracion: null };

  const actual = parciales.length ? parciales.reduce((a, b) => a + b, 0) / parciales.length : null;
  const tone = toneDe(materia.estado, esc, parciales);
  const necesita = actual == null ? null : Math.max(0, esc.aprob - actual);

  let riesgoTxt = "";
  if (tone === "danger" && actual != null) {
    riesgoTxt = `Tu promedio es ${formatValor(actual, esc.tipo)}${unidad(esc.tipo)}, te faltan ${formatValor(necesita ?? 0, esc.tipo)}${unidad(esc.tipo)} para llegar a la aprobación (${formatValor(esc.aprob, esc.tipo)}${unidad(esc.tipo)}).`;
  } else if (tone === "warning" && actual != null) {
    riesgoTxt = `Vas aprobando, pero raspando: tu promedio es ${formatValor(actual, esc.tipo)}${unidad(esc.tipo)} y el mínimo es ${formatValor(esc.aprob, esc.tipo)}${unidad(esc.tipo)}.`;
  }

  return { raw: materia, esc, actual, tone, necesita, riesgoTxt, items, evaluaciones, notasEvals, parciales };
}

// Réplica de computeMaterias(opts)/computeMateriasDelActivo() (runtime.js):
// sin semestreId (null/undefined), todas las materias — mismo criterio que
// la web ("sin opts.semestreId" en computeMaterias, no sólo un semestreId
// falsy: activeSemestreId() puede devolver null si el usuario no tiene
// ningún semestre todavía, y en ese caso la web tampoco filtra).
export function computeMaterias(materiasAll: Materia[], agendaAll: EventoAgenda[], semestreId?: string | null): MateriaComputada[] {
  const raw = semestreId ? materiasAll.filter((m) => m.semestre_id === semestreId) : materiasAll;
  return raw.map((m) => computeMateria(m, agendaAll));
}

// Réplica exacta de promedioNormalizado(materias) (runtime.js).
export function promedioNormalizado(materias: MateriaComputada[]): number | null {
  const proms = materias.filter((m) => m.actual != null).map((m) => ((m.actual as number) / m.esc.total) * 100);
  return proms.length ? Math.round(proms.reduce((a, b) => a + b, 0) / proms.length) : null;
}

// Réplica exacta de materiasAprobadasCount() (runtime.js): TODOS los
// semestres, no sólo el activo (a propósito, ver README de la web).
export function materiasAprobadasCount(materiasAll: Materia[]): number {
  return materiasAll.filter((m) => m.estado === "aprobada").length;
}

// Réplica exacta de materiasAprobadasSinNota() (runtime.js, línea 969):
// materias "aprobada" que no tienen ninguna evaluación calificada — típico
// de las cargadas como progreso previo en el onboarding, sin nota real.
export function materiasAprobadasSinNota(materiasAll: Materia[], agendaAll: EventoAgenda[]): MateriaComputada[] {
  return computeMaterias(materiasAll, agendaAll).filter((m) => m.raw.estado === "aprobada" && !m.notasEvals.length);
}

// Réplica exacta de agendaDeSemestre(semestreId) (runtime.js).
export function agendaDeSemestre(agendaAll: EventoAgenda[], materiasAll: Materia[], semestreId: string | null): EventoAgenda[] {
  if (!semestreId) return agendaAll;
  const ids = new Set(materiasAll.filter((m) => m.semestre_id === semestreId).map((m) => m.id));
  return agendaAll.filter((a) => a.materia_id != null && ids.has(a.materia_id));
}

export type KpisComputados = {
  proximaEvaluacion: { valor: string; sub: string } | null;
  promedioGeneral: { valor: string; sub: string; empty: false } | { empty: true; ctaTexto: string };
  pendientesSemana: { valor: string; sub: string; tone: Tone };
};

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Réplica de computeKpis() (runtime.js) — mismas 3 tarjetas/mismos
// criterios ("Próxima evaluación" se oculta si no hay nada pendiente,
// "Promedio general" cae a estado vacío con CTA en vez de ocultarse,
// "Pendientes esta semana" nunca se oculta). Se devuelve un objeto de
// slots fijos en vez del array de la web (ahí el orden definía qué tarjeta
// era "la primera" porque podía faltar; acá cada pantalla
// ya sabe qué tarjeta es cada una) — misma semántica, forma más cómoda
// para consumir desde React.
export function computeKpis(materiasAll: Materia[], agendaAll: EventoAgenda[], semestreId: string | null): KpisComputados {
  const materias = computeMaterias(materiasAll, agendaAll, semestreId);
  const t = today();
  const agenda = agendaDeSemestre(agendaAll, materiasAll, semestreId);
  const pendientes = agenda.filter((a) => !a.hecho);
  const proxExamen = pendientes
    .filter((a) => a.kind === "evaluacion")
    .map((a) => ({ a, d: parseISODate(a.fecha) }))
    .filter((x) => x.d >= t)
    .sort((x, y) => x.d.getTime() - y.d.getTime())[0];
  const promedio = promedioNormalizado(materias);
  const estaSemana = pendientes.filter((a) => {
    const d = diffDias(parseISODate(a.fecha), t);
    return d >= 0 && d <= 6;
  });
  const vencidas = pendientes.filter((a) => parseISODate(a.fecha) < t);
  const materiaNombre = (id: string | null) => materiasAll.find((m) => m.id === id)?.nombre ?? "";

  return {
    proximaEvaluacion: proxExamen
      ? { valor: `${DIAS_CORTOS[proxExamen.d.getDay()]} ${proxExamen.d.getDate()}`, sub: `${proxExamen.a.tipo} · ${materiaNombre(proxExamen.a.materia_id)}` }
      : null,
    promedioGeneral: promedio != null ? { valor: `${promedio}%`, sub: "normalizado · 3 escalas distintas", empty: false } : { empty: true, ctaTexto: "Cargá tu primera nota" },
    pendientesSemana: {
      valor: String(estaSemana.length),
      sub: vencidas.length ? `${vencidas.length} ${vencidas.length === 1 ? "vencida de antes" : "vencidas de antes"}` : "sin vencidas",
      tone: vencidas.length ? "danger" : "neutral",
    },
  };
}

export type ProgresoSemestrePunto = { semestre: Semestre; promedio: number | null; aprobadas: number; exoneradas: number; total: number };

// Réplica exacta de computeProgresoPorSemestre() (runtime.js): un punto por
// semestre con al menos una materia (no sólo los que ya tienen promedio).
export function computeProgresoPorSemestre(semestresOrd: Semestre[], materiasAll: Materia[], agendaAll: EventoAgenda[]): ProgresoSemestrePunto[] {
  return semestresOrd
    .map((s) => {
      const materias = computeMaterias(materiasAll, agendaAll, s.id);
      return {
        semestre: s,
        promedio: promedioNormalizado(materias),
        aprobadas: materias.filter((m) => m.raw.estado === "aprobada").length,
        exoneradas: materias.filter((m) => m.actual != null && m.esc.exoneracion != null && (m.actual as number) >= m.esc.exoneracion).length,
        total: materias.length,
      };
    })
    .filter((p) => p.total > 0);
}

export type ProgresoSemestreActivo = {
  promedio: number | null;
  deltaVsAnterior: number | null;
  nombreAnterior: string | null;
  evaluacionesEsperadas: number;
  evaluacionesCalificadas: number;
  materias: MateriaComputada[]; // ordenadas peor-encaminada primero, igual que la web
};

// Réplica de computeProgresoSemestreActivo() (runtime.js) — la tarjeta
// "Progreso del semestre" de Inicio en la web (progreso-semestre-card,
// también renderizada desde renderInicio()) es la que le corresponde al
// widget "Progreso del semestre" que ya existe en Inicio de mobile
// (delta + anillo de evaluaciones calificadas + desglose por materia), no
// computeProgresoPorSemestre (esa alimenta un widget de meta de carrera
// que mobile todavía no tiene en Inicio).
export function computeProgresoSemestreActivo(materiasAll: Materia[], agendaAll: EventoAgenda[], semestresOrd: Semestre[], activeId: string | null): ProgresoSemestreActivo {
  const materias = computeMaterias(materiasAll, agendaAll, activeId);
  const promedio = promedioNormalizado(materias);
  const evaluacionesDelSemestre = agendaDeSemestre(agendaAll, materiasAll, activeId).filter((a) => a.kind === "evaluacion");
  const evaluacionesEsperadas = evaluacionesDelSemestre.length;
  const evaluacionesCalificadas = evaluacionesDelSemestre.filter((a) => a.nota != null).length;

  const idxActivo = semestresOrd.findIndex((s) => s.id === activeId);
  const anterior = idxActivo > 0 ? semestresOrd[idxActivo - 1] : null;
  let deltaVsAnterior: number | null = null;
  let nombreAnterior: string | null = null;
  if (anterior) {
    const promedioAnterior = promedioNormalizado(computeMaterias(materiasAll, agendaAll, anterior.id));
    if (promedio != null && promedioAnterior != null) {
      deltaVsAnterior = promedio - promedioAnterior;
      nombreAnterior = anterior.nombre;
    }
  }

  const desglose = materias.slice().sort((a, b) => {
    const pa = a.actual == null ? 2 : a.actual / a.esc.total;
    const pb = b.actual == null ? 2 : b.actual / b.esc.total;
    return pa - pb;
  });

  return { promedio, deltaVsAnterior, nombreAnterior, evaluacionesEsperadas, evaluacionesCalificadas, materias: desglose };
}

// Réplica de resolverPendienteSiCorresponde(materiaId, nota) (runtime.js):
// se llama después de cargar la nota del examen de una materia "pendiente"
// (debo rendir examen) — si llega al mínimo fijo (APROBACION_EXAMEN_PENDIENTE),
// la pasa a "aprobada" sola; si no, se queda pendiente para volver a rendir.
// No hace nada si la materia no está pendiente. A diferencia de la web
// (que resuelve el mínimo vía computeMateriaById), acá se compara
// directamente contra la constante: para una materia "pendiente" ese
// mínimo siempre es el fijo, nunca el esc.aprob propio (ver computeMateria).
export async function resolverPendienteSiCorresponde(materia: Materia, nota: number): Promise<{ promovida: boolean; mensaje: string } | null> {
  if (materia.estado !== "pendiente") return null;
  if (nota >= APROBACION_EXAMEN_PENDIENTE) {
    const { error } = await supabase.from("materias").update({ estado: "aprobada" }).eq("id", materia.id);
    if (error) throw error;
    return { promovida: true, mensaje: `¡Aprobaste ${materia.nombre}! La marcamos como aprobada.` };
  }
  return { promovida: false, mensaje: `Nota cargada — no llegaste al mínimo, ${materia.nombre} sigue pendiente de rendir.` };
}

// Arma la fila que consumen las pantallas (mismo shape que DemoMateria,
// para no tener que reescribir MateriaCard/MateriaTableRow/EvalRow/
// calloutDe) a partir de datos 100% reales — reemplaza al viejo toRow(),
// que tapaba la falta de cálculo real mergeando por NOMBRE contra
// demoMaterias (podía mostrar la data de otra materia si el nombre
// matcheaba de casualidad). `codigo`/`creditos`/`asistencia` quedan en su
// default vacío: esas columnas no existen todavía en el schema real (ver
// README de la tarea) y no son parte de este cálculo.
export function materiaComputadaToRow(materia: Materia, agendaAll: EventoAgenda[]): DemoMateria {
  const computed = computeMateria(materia, agendaAll);
  const colorId = (materia.color_id && materia.color_id in materiaColors ? materia.color_id : "gris") as MateriaColorId;
  const esc = computed.esc;
  return {
    id: materia.id,
    nombre: materia.nombre,
    codigo: "",
    creditos: 0,
    colorId,
    color: materiaColors[colorId].strong,
    docente: materia.doc || "Sin docente cargado",
    estado: materia.estado,
    tone: computed.tone,
    salon: materia.salon || "Sin salón asignado",
    periodoLabel: nombreDesdePeriodo(PERIODO_ACTUAL),
    escalaTipo: esc.tipo,
    escalaTotal: esc.total,
    escalaAprob: esc.aprob,
    escalaExon: esc.exoneracion ?? undefined,
    progreso: computed.actual != null ? Math.max(0, Math.min(1, computed.actual / esc.total)) : 0,
    promedio: computed.actual ?? 0,
    horarioResumen: formatHorario(materia.bloques),
    ubicacionResumen: materia.salon || "Sin salón asignado",
    bloques: materia.bloques ?? [],
    componentesFijos: (materia.componentes_fijos ?? []).map((c) => ({ id: c.id, titulo: c.titulo, puntajeMax: c.puntajeMax, valor: c.valor })),
    asistencia: null,
    evaluaciones: computed.items.map((r) => rowToDemoEvaluacion(r, esc.total)),
  };
}

// Puerto directo de src/simulador.js (web) — mismo modelo puro, sin DOM: el
// simulador SUMA puntos (no promedia), esc.total/esc.aprob/esc.exoneracion
// son umbrales fijos de la materia, nunca recalculados desde las evaluaciones.
// Reusar para cualquier pantalla que proyecte aprobación/exoneración.
export type EscalaSim = { total: number; aprob: number; exoneracion?: number | null };
export type EvaluacionSim = { id: string; notaMaxima: number; nota: number | null };
export type ComponenteFijoSim = { id: string; puntajeMax: number; valor: number | null };

export type ResultadoSimulacion = {
  puntosReales: number;
  puntosProyectados: number;
  total: number;
  aprob: number;
  exoneracion: number | null;
  disponibles: number;
  faltanAprobacion: number | null;
  faltanExoneracion: number | null;
  imposible: boolean;
  asegurado: boolean;
  exonerado: boolean;
  imposibleExonerar: boolean;
  promedioNecesario: number | null;
  escalaInconsistente: boolean;
};

export function calcularSimulacion(
  esc: EscalaSim,
  evaluaciones: EvaluacionSim[],
  valoresSimulados: Record<string, number>,
  componentesFijos: ComponenteFijoSim[] = []
): ResultadoSimulacion {
  const total = Number(esc.total) || 0;
  const aprob = Number(esc.aprob) || 0;
  const exoneracion = esc.exoneracion != null ? Number(esc.exoneracion) : null;

  let puntosReales = 0; // suma de notas ya cargadas — fija, no la mueve otro slider
  let disponibles = 0; // techo de lo que falta rendir
  let sumaNotaMaxima = 0; // para el aviso de escala inconsistente
  let puntosProyectados = 0; // lo que dice cada slider ahora (real si no se tocó)

  evaluaciones.forEach((e) => {
    const notaMaxima = Number(e.notaMaxima) || 0;
    sumaNotaMaxima += notaMaxima;
    const tieneNota = e.nota != null;
    const notaReal = tieneNota ? Math.max(0, Math.min(Number(e.nota), notaMaxima)) : null;
    if (tieneNota) puntosReales += notaReal as number;
    else disponibles += notaMaxima;
    const simulado = valoresSimulados[e.id];
    const valorProyectado = simulado != null ? Number(simulado) : tieneNota ? (notaReal as number) : 0;
    puntosProyectados += Math.max(0, Math.min(valorProyectado, notaMaxima));
  });

  componentesFijos.forEach((c) => {
    const puntajeMax = Number(c.puntajeMax) || 0;
    sumaNotaMaxima += puntajeMax;
    const tieneValor = c.valor != null;
    const valorFijo = tieneValor ? Math.max(0, Math.min(Number(c.valor), puntajeMax)) : null;
    if (tieneValor) puntosReales += valorFijo as number;
    else disponibles += puntajeMax;
    const simulado = valoresSimulados[c.id];
    const valorProyectado = simulado != null ? Number(simulado) : tieneValor ? (valorFijo as number) : 0;
    puntosProyectados += Math.max(0, Math.min(valorProyectado, puntajeMax));
  });

  // "Imposible"/"asegurado" dependen sólo de lo YA real (ignoran los
  // sliders) — no deben prenderse/apagarse porque alguien arrastra un
  // slider. Los sliders exploran el rango entre esos dos extremos.
  const techoMaximoPosible = puntosReales + disponibles;
  const imposible = total > 0 && techoMaximoPosible < aprob;
  const asegurado = total > 0 && puntosReales >= aprob;
  const exonerado = exoneracion != null && total > 0 && puntosReales >= exoneracion;
  const imposibleExonerar = exoneracion != null && total > 0 && techoMaximoPosible < exoneracion;

  const evaluacionesSinNota = evaluaciones.filter((e) => e.nota == null);
  let promedioNecesario: number | null = null;
  if (evaluacionesSinNota.length && !imposible && !asegurado) {
    promedioNecesario = Math.max(0, aprob - puntosReales) / evaluacionesSinNota.length;
  }

  return {
    puntosReales,
    puntosProyectados,
    total,
    aprob,
    exoneracion,
    disponibles,
    faltanAprobacion: total > 0 ? Math.max(0, aprob - puntosProyectados) : null,
    faltanExoneracion: exoneracion != null && total > 0 ? Math.max(0, exoneracion - puntosProyectados) : null,
    imposible,
    asegurado,
    exonerado,
    imposibleExonerar,
    promedioNecesario,
    escalaInconsistente: total > 0 && sumaNotaMaxima !== total,
  };
}

// Réplica de `escLabel()`/`uni()`/`val()` de la web — mismo texto exacto
// para las 3 escalas (nota 0–12, porcentaje, puntaje libre). El TIPO es lo
// que manda (esc.tipo, elegido por el usuario al cargar la materia), nunca
// se infiere del total — una materia "puntos" puede totalizar 100 sin ser
// porcentaje, o "nota" sin ser sobre 12 (ver toneDe/escLabel en runtime.js,
// que reciben el objeto esc completo por el mismo motivo). Vive acá (en vez
// de duplicarse por pantalla) porque Detalle de materia y Materias la usan
// ambas.
// Alta/edición de Materia — mismo mapeo camelCase/snake_case que
// materiaToRow/rowToMateria de la web (ver runtime.js). `catalogo_materia_id`
// y `catalogo_dictado_id` son sólo lectura acá: nunca se mandan en el
// insert/update, las escriben las RPCs del catálogo de onboarding.
export type MateriaBloqueInput = { dia: number; ini: number; fin: number };
export type MateriaEscInput = { tipo: EscalaTipo; total: number; aprob: number; exoneracion?: number };
export type MateriaFormInput = {
  nombre: string;
  doc: string;
  colorId: MateriaColorId;
  salon: string;
  estado: Materia["estado"];
  bloques: MateriaBloqueInput[];
  esc: MateriaEscInput;
};

function escParaGuardar(esc: MateriaEscInput) {
  // No mandar `exoneracion: null` de más — el simulador chequea
  // `esc.exoneracion != null` (ver calcularSimulacion arriba), así que
  // omitir la clave entera cuando el usuario no la cargó.
  const base: { tipo: EscalaTipo; total: number; aprob: number; exoneracion?: number } = {
    tipo: esc.tipo,
    total: esc.total,
    aprob: esc.aprob,
  };
  if (esc.exoneracion != null) base.exoneracion = esc.exoneracion;
  return base;
}

export async function crearMateria(input: MateriaFormInput): Promise<Materia> {
  const userId = await currentUserId();
  const semestreId = await getSemestreActivoId();
  const { data, error } = await supabase
    .from("materias")
    .insert({
      user_id: userId,
      semestre_id: semestreId,
      nombre: input.nombre,
      doc: input.doc || null,
      color_id: input.colorId,
      salon: input.salon || null,
      bloques: input.bloques,
      esc: escParaGuardar(input.esc),
      estado: input.estado,
      componentes_fijos: [],
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("No se pudo crear la materia.");
  return data as Materia;
}

export async function actualizarMateria(id: string, input: MateriaFormInput): Promise<Materia> {
  const { data, error } = await supabase
    .from("materias")
    .update({
      nombre: input.nombre,
      doc: input.doc || null,
      color_id: input.colorId,
      salon: input.salon || null,
      bloques: input.bloques,
      esc: escParaGuardar(input.esc),
      estado: input.estado,
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw error ?? new Error("No se pudo actualizar la materia.");
  return data as Materia;
}

// Borra primero las filas de `agenda` que apuntan a esta materia y recién
// después la materia — no asume que exista ON DELETE CASCADE en
// agenda.materia_id, así que el orden manual es correcto tanto si el
// cascade existe (el segundo delete no encuentra nada) como si no.
export async function eliminarMateria(id: string): Promise<void> {
  const { error: agendaErr } = await supabase.from("agenda").delete().eq("materia_id", id);
  if (agendaErr) throw agendaErr;
  const { error } = await supabase.from("materias").delete().eq("id", id);
  if (error) throw error;
}

export function escalaLabel(tipo: EscalaTipo, total: number): string {
  if (tipo === "nota") return "Nota 0–12";
  if (tipo === "pct") return "Porcentaje";
  return `Puntaje ${total}`;
}

export function unidad(tipo: EscalaTipo): string {
  if (tipo === "nota") return "";
  if (tipo === "pct") return "%";
  return " pts";
}

export function formatValor(v: number, tipo: EscalaTipo): string {
  return tipo === "nota" ? v.toFixed(1) : String(Math.round(v));
}

