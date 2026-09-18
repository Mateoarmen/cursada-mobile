// Puerto de la lógica de Asistencia de runtime.js (web) — statsAsistencia,
// statsAsistenciaPorMateria, materiasAsistenciaParaFecha — sin DOM. Opera
// sobre `DemoMateria` (el shape que consumen las pantallas de Asistencia)
// pero tanto la lista de materias como los registros de asistencia ya
// vienen de Supabase real (ver app/asistencia.tsx, AsistenciaDiarioGate y
// useAsistencia.ts) — DemoMateria acá es sólo el shape intermedio, no
// datos de muestra.
import type { DemoMateria } from "@/data/demoContent";
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

// Cantidad de días atrás de "hoy" (inclusive) que cubre cada rango — una
// ventana móvil en vez de un rango calendario alineado (semana ISO, mes
// calendario) porque no tenemos fecha de inicio de semestre a mano acá;
// simple y suficiente para leer una tendencia reciente.
const RANGO_DIAS: Record<AsistenciaRango, number> = { semana: 7, mes: 30, semestre: 180 };

function diasDelRango(rango: AsistenciaRango, hoy: Date): Date[] {
  const n = RANGO_DIAS[rango];
  return Array.from({ length: n }, (_, i) => addDias(hoy, -(n - 1 - i)));
}

// % de asistencia = presentes / total sobre los registros reales que el
// usuario marcó en Historial (ver useAsistencia.ts) — antes leía el
// campo canned `DemoMateria.asistencia`, que nunca cambiaba sin importar lo
// que se marcara en Historial (ver critique: las dos secciones de la
// pantalla contaban historias distintas). Un día sin registro, o marcado
// "no hubo clase", no entra en el denominador.
export function statsGeneral(materias: DemoMateria[], registros: Record<string, AsistenciaEstado>, rango: AsistenciaRango, hoy: Date): AsistenciaStats {
  let presentes = 0;
  let total = 0;
  for (const fecha of diasDelRango(rango, hoy)) {
    const iso = toISODate(fecha);
    for (const m of materiasConClaseEnFecha(materias, fecha)) {
      const estado = registros[`${iso}|${m.id}`];
      if (estado === "asistio") {
        presentes += 1;
        total += 1;
      } else if (estado === "no_asistio") {
        total += 1;
      }
    }
  }
  return { presentes, total, pct: total ? Math.round((presentes / total) * 100) : null };
}

export type AsistenciaPorMateria = { materia: DemoMateria } & AsistenciaStats;

// Sólo materias con seguimiento de asistencia (estado === "cursando" —
// mismo criterio que materiasConClaseHoy/materiasAsistenciaParaFecha en la
// web: una materia que dejó de estar cursando deja de pedirse) y con al
// menos un registro real en este rango.
export function statsPorMateria(materias: DemoMateria[], registros: Record<string, AsistenciaEstado>, rango: AsistenciaRango, hoy: Date): AsistenciaPorMateria[] {
  const acc = new Map<string, { presentes: number; total: number }>();
  for (const fecha of diasDelRango(rango, hoy)) {
    const iso = toISODate(fecha);
    for (const m of materiasConClaseEnFecha(materias, fecha)) {
      const estado = registros[`${iso}|${m.id}`];
      if (estado !== "asistio" && estado !== "no_asistio") continue;
      const cur = acc.get(m.id) ?? { presentes: 0, total: 0 };
      if (estado === "asistio") cur.presentes += 1;
      cur.total += 1;
      acc.set(m.id, cur);
    }
  }
  return materias
    .filter((m) => m.estado === "cursando" && acc.has(m.id))
    .map((m) => {
      const s = acc.get(m.id)!;
      return { materia: m, presentes: s.presentes, total: s.total, pct: s.total ? Math.round((s.presentes / s.total) * 100) : null };
    });
}

// Mismo umbral que TONE en la web: ≥75 éxito, ≥50 aviso, si no peligro.
export function tonePorPct(pct: number | null): Tone {
  if (pct == null) return "neutral";
  if (pct >= 75) return "success";
  if (pct >= 50) return "warning";
  return "danger";
}

// Qué materias tienen clase en una fecha dada — mismo criterio que
// materiasAsistenciaParaFecha() (web): materias "cursando" que tienen un
// bloque ese día de la semana. `Bloque.dia` (ver catalog.ts, 1=Lunes…
// 6=Sábado) calza 1:1 con `Date.getDay()`.
export function materiasConClaseEnFecha(materias: DemoMateria[], fecha: Date): DemoMateria[] {
  const dow = fecha.getDay();
  return materias.filter((m) => m.estado === "cursando" && m.bloques.some((b) => b.dia === dow));
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
// useAsistencia.ts.
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
