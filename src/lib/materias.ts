import type { EscalaTipo, Materia } from "@/types/database";
import { materiaColors, type MateriaColorId, type Tone } from "@/theme/tokens";
import { demoMaterias, type DemoMateria } from "@/data/demoContent";
import { formatHorario, nombreDesdePeriodo, PERIODO_ACTUAL } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { currentUserId, getSemestreActivoId } from "@/lib/semestres";

// Combina lo real de Supabase (nombre/color/escala/bloques/puntos fijos)
// con las métricas de muestra (progreso/promedio/evaluaciones) hasta que el
// schema tenga esas columnas. Si el nombre matchea una materia de muestra,
// la muestra gana (trae más datos) — si no, se arma la fila sólo con lo
// real disponible. Compartido por Materias y Detalle de materia.
// TODO(backend): sacar el merge con demoMaterias una vez existan esas columnas.
export function toRow(materia: Materia): DemoMateria {
  const match = demoMaterias.find((d) => d.nombre.toLowerCase() === materia.nombre.toLowerCase());
  if (match) return match;
  const colorId = (materia.color_id && materia.color_id in materiaColors ? materia.color_id : "gris") as MateriaColorId;
  const esc = "tipo" in materia.esc ? materia.esc : null;
  return {
    id: materia.id,
    nombre: materia.nombre,
    codigo: "",
    creditos: 0,
    colorId,
    color: materiaColors[colorId].strong,
    docente: materia.doc || "Sin docente cargado",
    estado: materia.estado,
    tone: "neutral",
    salon: materia.salon || "Sin salón asignado",
    periodoLabel: nombreDesdePeriodo(PERIODO_ACTUAL),
    escalaTipo: esc?.tipo ?? "nota",
    escalaTotal: esc?.total ?? 12,
    escalaAprob: esc?.aprob ?? 6,
    escalaExon: esc?.exoneracion ?? undefined,
    progreso: 0,
    promedio: 0,
    horarioResumen: formatHorario(materia.bloques),
    ubicacionResumen: materia.salon || "Sin salón asignado",
    bloques: materia.bloques ?? [],
    componentesFijos: (materia.componentes_fijos ?? []).map((c) => ({ id: c.id, titulo: c.titulo, puntajeMax: c.puntajeMax, valor: c.valor })),
    asistencia: null,
    evaluaciones: [],
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

// Puntos YA cargados de una materia = suma de notas de evaluaciones
// rendidas (agenda.hecho + agenda.nota) + componentes fijos con valor —
// mismo cálculo que puntosReales de calcularSimulacion (sin los sliders),
// factorizado acá porque lo usan Materias (todas las materias de una) y
// Detalle de materia (una sola, con más detalle). esc.total nunca se
// recalcula sumando notaMax a mano, se usa tal cual viene de Supabase.
// Corte de color en esc.aprob/esc.exoneracion, no en un margen.
export function calcularPuntosObtenidos(
  esc: { aprob: number; exoneracion?: number | null },
  agendaItems: { hecho: boolean; nota: number | null | undefined }[],
  componentesFijos: { valor: number | null }[]
): { puntos: number; hayPuntos: boolean; tone: Tone } {
  const notaSum = agendaItems.filter((a) => a.hecho && a.nota != null).reduce((s, a) => s + (a.nota ?? 0), 0);
  const fijosSum = componentesFijos.filter((c) => c.valor != null).reduce((s, c) => s + (c.valor ?? 0), 0);
  const puntos = notaSum + fijosSum;
  const hayPuntos = agendaItems.some((a) => a.hecho && a.nota != null) || componentesFijos.some((c) => c.valor != null);
  const tone: Tone = !hayPuntos ? "neutral" : puntos < esc.aprob ? "danger" : esc.exoneracion != null && puntos < esc.exoneracion ? "warning" : "success";
  return { puntos, hayPuntos, tone };
}
