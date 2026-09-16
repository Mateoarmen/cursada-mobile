// Puerto de la lógica de Asistencia de runtime.js (web) — statsAsistencia,
// statsAsistenciaPorMateria, materiasAsistenciaParaFecha — sin DOM. El
// schema real de `asistencias` vive en Supabase (mismo backend que la web,
// ver runtime.js) pero el mobile todavía no lo lee: como el resto de las
// pantallas de métricas (ver demoContent.ts), esto opera sobre
// `DemoMateria.asistencia`, cargado a mano por rango. Reemplazar por fetch
// real una vez el schema mobile tenga esa tabla tipada (database.ts).
import type { DemoAsistenciaRango, DemoMateria } from "@/data/demoContent";
import type { Tone } from "@/theme/tokens";

export type AsistenciaRango = "semana" | "mes" | "semestre";

export type AsistenciaEstado = "asistio" | "no_asistio" | "no_hubo_clase";

export const ASISTENCIA_ESTADOS: AsistenciaEstado[] = ["asistio", "no_asistio", "no_hubo_clase"];

export const asistenciaEstadoLabel: Record<AsistenciaEstado, string> = {
  asistio: "Asistí",
  no_asistio: "No asistí",
  no_hubo_clase: "No hubo clase",
};

export type AsistenciaStats = { pct: number | null; presentes: number; total: number };

// % de asistencia = presentes / total, sin materias sin registros en el
// denominador — mismo criterio que statsAsistencia() en la web.
export function statsGeneral(materias: DemoMateria[], rango: AsistenciaRango): AsistenciaStats {
  const rows = materias
    .map((m) => m.asistencia?.[rango])
    .filter((r): r is DemoAsistenciaRango => r != null);
  const presentes = rows.reduce((acc, r) => acc + r.presentes, 0);
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  return { presentes, total, pct: total ? Math.round((presentes / total) * 100) : null };
}

export type AsistenciaPorMateria = { materia: DemoMateria } & AsistenciaStats;

// Sólo materias con seguimiento de asistencia (asistencia !== null — las
// aprobadas/pendientes no lo tienen, igual que en la web una materia que
// dejó de ser 'cursando' deja de pedirse) y con registros en este rango.
export function statsPorMateria(materias: DemoMateria[], rango: AsistenciaRango): AsistenciaPorMateria[] {
  return materias
    .filter((m) => m.asistencia != null)
    .map((m) => ({ materia: m, ...(m.asistencia![rango] as DemoAsistenciaRango) }))
    .filter((x) => x.total > 0);
}

// Mismo umbral que TONE en la web: ≥75 éxito, ≥50 aviso, si no peligro.
export function tonePorPct(pct: number | null): Tone {
  if (pct == null) return "neutral";
  if (pct >= 75) return "success";
  if (pct >= 50) return "warning";
  return "danger";
}

// Qué materias tienen clase en una fecha dada — mismo criterio que
// materiasAsistenciaParaFecha() (web): materias con seguimiento de
// asistencia que tienen un bloque ese día de la semana. `Bloque.dia` (ver
// catalog.ts, 1=Lunes…6=Sábado) calza 1:1 con `Date.getDay()`.
export function materiasConClaseEnFecha(materias: DemoMateria[], fecha: Date): DemoMateria[] {
  const dow = fecha.getDay();
  return materias.filter((m) => m.asistencia != null && m.bloques.some((b) => b.dia === dow));
}

export function addDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

export function esMismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function toISODate(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Hora (0-23) en la que termina la última clase de esas materias ese día de
// la semana — null si ninguna tiene bloque ese día.
export function finUltimaClaseEnFecha(materiasDia: DemoMateria[], fecha: Date): number | null {
  const dow = fecha.getDay();
  const fines = materiasDia.flatMap((m) => m.bloques.filter((b) => b.dia === dow).map((b) => b.fin));
  return fines.length ? Math.max(...fines) : null;
}

// Días con clase que todavía tienen alguna materia sin registrar, del más
// viejo al más nuevo (así se pregunta primero lo atrasado) — puerto de
// maybeOfrecerAsistencia() pero sin acotarse a "hoy": si el usuario no
// contestó ayer, también se le pregunta. "Hoy" sólo entra en la lista una
// vez terminada la última clase del día (ver finUltimaClaseEnFecha) — no
// tiene sentido preguntar "¿fuiste a clase?" de una clase que todavía no
// pasó. `registros` usa la misma clave `${fechaISO}|${materiaId}` que
// asistenciaStore.ts.
export function diasPendientes(
  materias: DemoMateria[],
  registros: Record<string, AsistenciaEstado>,
  hoy: Date,
  maxDiasAtras = 14
): Date[] {
  const dias: Date[] = [];
  for (let i = maxDiasAtras; i >= 0; i--) {
    const fecha = addDias(hoy, -i);
    const materiasDia = materiasConClaseEnFecha(materias, fecha);
    if (materiasDia.length === 0) continue;
    const iso = toISODate(fecha);
    const falta = materiasDia.some((m) => !registros[`${iso}|${m.id}`]);
    if (!falta) continue;
    if (esMismoDia(fecha, hoy)) {
      const finUltima = finUltimaClaseEnFecha(materiasDia, fecha);
      if (finUltima == null) continue;
      const limite = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), finUltima, 0, 0, 0);
      if (new Date() < limite) continue;
    }
    dias.push(fecha);
  }
  return dias;
}

const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

export function formatFechaLarga(fecha: Date): string {
  const texto = `${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES_LARGOS[fecha.getMonth()]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
