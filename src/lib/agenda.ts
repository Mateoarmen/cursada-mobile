// Puerto directo de la lógica de fechas/urgencia de Agenda en runtime.js
// (today/diffDias/formatFechaAgenda/agendaBadgeInfo/formatCountdown/
// esCountdownUrgente/groupAgenda) — misma lógica exacta, sin DOM. Reusar
// esto para cualquier otra pantalla que necesite el mismo criterio de
// "vencida / esta semana / próximamente" (ej. Inicio, Calendario) en vez
// de reimplementarlo.
import type { Tone } from "@/theme/tokens";

export const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
export const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

// Color de identidad de los eventos personales (no es ninguno de los 9
// colores de materia) — mismo valor que PERSONAL_COLOR en runtime.js.
export const PERSONAL_COLOR = "#8E8E93";

export function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// YYYY-MM-DD con los componentes *locales* de la fecha. toISOString() pasa
// por UTC y corre el día cerca de la medianoche según el huso horario.
export function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function formatFechaAgenda(iso: string, hora?: string): string {
  const d = parseISODate(iso);
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}${hora ? ` · ${hora}` : ""}`;
}

// Nombre de mes para los separadores de "Próximamente" cuando abarca más
// de un mes — agrega el año sólo si no es el actual (mismo criterio que
// buildAgendaRowsList en runtime.js).
export function mesLargoLabel(iso: string, t: Date): string {
  const d = parseISODate(iso);
  const nombre = MESES_LARGOS[d.getMonth()]!;
  const cap = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  return d.getFullYear() !== t.getFullYear() ? `${cap} ${d.getFullYear()}` : cap;
}

export type AgendaBadge = { tone: Tone; label: string };

// Sólo para ítems de materia (evaluación/tarea) — los eventos personales
// tienen su propio badge fijo ("Todo el día"/"Personal"), ver AgendaRow.
export function agendaBadgeInfo(
  item: { hecho: boolean; itemKind: "evaluacion" | "tarea"; nota?: number | null; fecha: string },
  t: Date
): AgendaBadge {
  if (item.hecho) {
    const esEval = item.itemKind === "evaluacion";
    if (esEval && item.nota == null) return { tone: "warning", label: "Esperando nota" };
    return { tone: "success", label: esEval ? "Rendido" : "Entregado" };
  }
  const diff = diffDias(parseISODate(item.fecha), t);
  if (diff < 0) return { tone: "danger", label: `Vencida hace ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "día" : "días"}` };
  if (diff === 0) return { tone: "warning", label: "Hoy" };
  if (diff === 1) return { tone: "warning", label: "Mañana" };
  if (diff <= 6) return { tone: "neutral", label: "Esta semana" };
  return { tone: "neutral", label: "Pendiente" };
}

export function formatCountdown(fecha: string, hora: string | undefined, ahora: Date): string {
  const d = parseISODate(fecha);
  if (!hora) {
    const dias = diffDias(d, today());
    if (dias < 0) return "vencido";
    if (dias === 0) return "vence hoy";
    return `en ${dias} d`;
  }
  const [hh, mm] = hora.split(":").map(Number);
  const objetivo = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh ?? 0, mm ?? 0);
  const diffMs = objetivo.getTime() - ahora.getTime();
  if (diffMs <= 0) return "vencido";
  const totalMin = Math.ceil(diffMs / 60000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const minutos = totalMin % 60;
  if (dias >= 1) return `en ${dias} d ${horas} h`;
  if (horas >= 1) return `en ${horas} h ${minutos} m`;
  return `en ${minutos} m`;
}

export function esCountdownUrgente(fecha: string): boolean {
  return diffDias(parseISODate(fecha), today()) <= 1;
}

export type Grouped<T> = { vencidas: T[]; estaSemana: T[]; proximamente: T[]; completadas: T[] };

// Split vencidas/esta-semana/próximamente + completadas, ordenado por
// fecha (y hora como desempate) — mismo criterio que renderAgenda().
export function groupAgenda<T extends { fecha: string; hora?: string; hecho: boolean }>(
  entries: T[],
  t: Date,
  separarCompletadas = true
): Grouped<T> {
  const pendientes = separarCompletadas ? entries.filter((e) => !e.hecho) : entries;
  const completadas = separarCompletadas ? entries.filter((e) => e.hecho) : [];
  const vencidas: T[] = [];
  const estaSemana: T[] = [];
  const proximamente: T[] = [];
  pendientes.forEach((e) => {
    const diff = diffDias(parseISODate(e.fecha), t);
    if (diff < 0) vencidas.push(e);
    else if (diff <= 6) estaSemana.push(e);
    else proximamente.push(e);
  });
  const sortFn = (a: T, b: T) =>
    parseISODate(a.fecha).getTime() - parseISODate(b.fecha).getTime() || (a.hora ?? "").localeCompare(b.hora ?? "");
  vencidas.sort(sortFn);
  estaSemana.sort(sortFn);
  proximamente.sort(sortFn);
  completadas.sort(sortFn);
  return { vencidas, estaSemana, proximamente, completadas };
}
