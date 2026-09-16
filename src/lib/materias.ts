import type { Materia } from "@/types/database";
import { materiaColors, type MateriaColorId } from "@/theme/tokens";
import { demoMaterias, type DemoMateria } from "@/data/demoContent";
import { formatHorario, nombreDesdePeriodo, PERIODO_ACTUAL } from "@/lib/catalog";

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

// Réplica de `escLabel()`/formateo de la web — mismo texto exacto para las
// 3 escalas (nota 0–12, porcentaje, puntaje libre). Vive acá (en vez de
// duplicarse por pantalla) porque Detalle de materia y Materias la usan
// ambas.
export function escalaLabel(total: number): string {
  if (total === 12) return "Nota 0–12";
  if (total === 100) return "Porcentaje";
  return `Puntaje ${total}`;
}

export function unidad(total: number): string {
  if (total === 12) return "";
  if (total === 100) return "%";
  return " pts";
}

export function formatValor(v: number, total: number): string {
  return total === 12 ? v.toFixed(1) : String(Math.round(v));
}
