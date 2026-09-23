// Lógica de Asistencia, sin DOM ni React — puerto de statsAsistencia /
// statsAsistenciaPorMateria / materiasAsistenciaParaFecha de runtime.js (web),
// con los mismos criterios de conteo para que un mismo dato se lea igual en
// los dos clientes:
//   - % = asistió / (asistió + no asistió); "no hubo clase" queda afuera del
//     denominador pero se muestra aparte.
//   - Semana = lunes a domingo, mes = mes calendario, semestre = todo lo
//     registrado en el semestre activo (nunca una ventana móvil de N días).
//   - Los números salen de los REGISTROS, no del horario: un registro cuenta
//     aunque la materia hoy no tenga bloque ese día (horario editado, clase
//     recuperatoria). El horario sólo decide qué días "deberían" tener
//     registro (pendientes) y qué filas se ofrecen para editar.
import type { Bloque } from "@/lib/catalog";
import type { EstadoMateria } from "@/theme/tokens";

export type AsistenciaRango = "semana" | "mes" | "semestre";

export type AsistenciaEstado = "asistio" | "no_asistio" | "no_hubo_clase";

export const ASISTENCIA_ESTADOS: AsistenciaEstado[] = ["asistio", "no_asistio", "no_hubo_clase"];

export const asistenciaEstadoLabel: Record<AsistenciaEstado, string> = {
  asistio: "Asistí",
  no_asistio: "No asistí",
  no_hubo_clase: "No hubo clase",
};

// Lo mínimo que estas funciones necesitan de una materia. DemoMateria (la
// fila que ya consumen Materias/Detalle) lo cumple estructuralmente; sólo
// `creadaEl` es nuevo y opcional.
export type MateriaAsistencia = {
  id: string;
  nombre: string;
  color: string;
  estado: EstadoMateria;
  bloques: Bloque[];
  // Fecha local (YYYY-MM-DD) en que se cargó la materia: antes de eso no
  // pudo haber clase que registrar, así que no cuenta como "sin registrar"
  // (si no, un usuario nuevo vería semanas enteras de deuda).
  creadaEl?: string;
};

// `${fechaISO}|${materiaId}` -> estado. Misma clave que ya usaba el hook.
export type Registros = Record<string, AsistenciaEstado>;

export function claveRegistro(fechaISO: string, materiaId: string): string {
  return `${fechaISO}|${materiaId}`;
}

// ---------------------------------------------------------------- fechas

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

export function fechaDeISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

// Lunes de la semana de `fecha` — lunes primero, igual que Horario y
// MiniCalendario (los bloques `dia` 1..6 son lunes..sábado).
export function lunesDe(fecha: Date): Date {
  const diff = (fecha.getDay() + 6) % 7;
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - diff);
}

export function primeroDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

export function ultimoDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}

// ---------------------------------------------------------------- períodos

// Días completos, ambos extremos incluidos.
export type Periodo = { desde: Date; hasta: Date };

export function periodoDe(rango: AsistenciaRango, ancla: Date, inicioSemestre: Date, hoy: Date): Periodo {
  if (rango === "semana") {
    const lunes = lunesDe(ancla);
    return { desde: lunes, hasta: addDias(lunes, 6) };
  }
  if (rango === "mes") return { desde: primeroDeMes(ancla), hasta: ultimoDeMes(ancla) };
  return { desde: inicioSemestre, hasta: hoy };
}

// Período inmediato anterior, para comparar ("vs. semana anterior"). El
// semestre no tiene: no hay un semestre "anterior" con los mismos datos.
export function periodoAnterior(rango: AsistenciaRango, periodo: Periodo): Periodo | null {
  if (rango === "semana") {
    const lunes = addDias(periodo.desde, -7);
    return { desde: lunes, hasta: addDias(lunes, 6) };
  }
  if (rango === "mes") {
    const prev = new Date(periodo.desde.getFullYear(), periodo.desde.getMonth() - 1, 1);
    return { desde: prev, hasta: ultimoDeMes(prev) };
  }
  return null;
}

// Mueve el ancla de un período: ±1 semana o ±1 mes.
export function desplazarAncla(rango: AsistenciaRango, ancla: Date, pasos: number): Date {
  if (rango === "mes") return new Date(ancla.getFullYear(), ancla.getMonth() + pasos, 1);
  return addDias(ancla, 7 * pasos);
}

export function diasDelPeriodo(periodo: Periodo): Date[] {
  const dias: Date[] = [];
  for (let d = periodo.desde; d.getTime() <= periodo.hasta.getTime(); d = addDias(d, 1)) dias.push(d);
  return dias;
}

// Primer día con algún registro entre las materias dadas (el semestre no
// tiene fecha de inicio en la base): el "semestre" arranca cuando el usuario
// empezó a registrar. Sin registros, arranca hoy.
export function inicioSeguimiento(registros: Registros, materiaIds: Set<string>, hoy: Date): Date {
  let primero: string | null = null;
  for (const clave of Object.keys(registros)) {
    const { fecha, materiaId } = separarClave(clave);
    if (!materiaIds.has(materiaId)) continue;
    if (primero === null || fecha < primero) primero = fecha;
  }
  return primero ? fechaDeISO(primero) : hoy;
}

function separarClave(clave: string): { fecha: string; materiaId: string } {
  const i = clave.indexOf("|");
  return { fecha: clave.slice(0, i), materiaId: clave.slice(i + 1) };
}

// ---------------------------------------------------------------- sesiones

// "pendiente" = la clase ya pasó y no hay registro; "futuro" = todavía no
// terminó (o no llegó). Los dos sin registro, distintos en pantalla: uno
// invita a completar, el otro no.
export type SesionEstado = AsistenciaEstado | "pendiente" | "futuro";

export const sesionEstadoLabel: Record<SesionEstado, string> = {
  asistio: "asistí",
  no_asistio: "no asistí",
  no_hubo_clase: "no hubo clase",
  pendiente: "sin registrar",
  futuro: "todavía no",
};

// Una clase de una materia en un día. Es la unidad que dibujan la tira
// semanal, el calendario y las filas por materia.
export type Sesion = { fecha: string; materia: MateriaAsistencia; estado: SesionEstado };

// Materias "cursando" con un bloque ese día de la semana (`Bloque.dia`, 1=lunes
// … 6=sábado, calza 1:1 con Date.getDay()). Misma regla que
// materiasAsistenciaParaFecha() (web): una materia que dejó de cursarse deja
// de pedirse.
export function materiasConClaseEnFecha(materias: MateriaAsistencia[], fecha: Date): MateriaAsistencia[] {
  const dow = fecha.getDay();
  return materias.filter((m) => m.estado === "cursando" && m.bloques.some((b) => b.dia === dow));
}

// Hora (decimal, 0-24) en que termina la última clase de esas materias ese
// día de la semana — null si ninguna tiene bloque ese día.
export function finUltimaClaseEnFecha(materiasDia: MateriaAsistencia[], fecha: Date): number | null {
  const dow = fecha.getDay();
  const fines = materiasDia.flatMap((m) => m.bloques.filter((b) => b.dia === dow).map((b) => b.fin));
  return fines.length ? Math.max(...fines) : null;
}

function inicioClase(materia: MateriaAsistencia, dow: number): number {
  const inicios = materia.bloques.filter((b) => b.dia === dow).map((b) => b.ini);
  return inicios.length ? Math.min(...inicios) : Number.POSITIVE_INFINITY;
}

// Un día "cerrado" es uno cuyas clases ya terminaron todas: recién ahí tiene
// sentido preguntar "¿fuiste?". Hoy sólo cierra cuando pasa el fin de la
// última clase (fin puede ser decimal, ej. 21.5 = 21:30 — no se trunca a la
// hora).
function diaCerrado(programadas: MateriaAsistencia[], fecha: Date, ahora: Date): boolean {
  const hoy = inicioDelDia(ahora);
  if (fecha.getTime() < hoy.getTime()) return true;
  if (fecha.getTime() > hoy.getTime()) return false;
  const fin = finUltimaClaseEnFecha(programadas, fecha);
  if (fin == null) return true;
  return ahora.getTime() >= hoy.getTime() + fin * 3600000;
}

// Las clases de un día: las programadas por horario (cursando + bloque ese
// día) más cualquier materia que ya tenga un registro ese día aunque hoy no
// la devuelva el horario — así una fecha vieja con datos reales sigue siendo
// visible y editable (mismo criterio que materiasAsistenciaParaFecha en la
// web). Ordenadas por hora de inicio.
export function sesionesDelDia(materias: MateriaAsistencia[], registros: Registros, fecha: Date, ahora: Date): Sesion[] {
  const iso = toISODate(fecha);
  const dow = fecha.getDay();
  const programadas = materiasConClaseEnFecha(materias, fecha);
  const ids = new Set(programadas.map((m) => m.id));
  const cerrado = diaCerrado(programadas, fecha, ahora);

  const out: { sesion: Sesion; orden: number }[] = [];
  for (const m of programadas) {
    const reg = registros[claveRegistro(iso, m.id)];
    if (!reg && m.creadaEl && iso < m.creadaEl) continue;
    out.push({ sesion: { fecha: iso, materia: m, estado: reg ?? (cerrado ? "pendiente" : "futuro") }, orden: inicioClase(m, dow) });
  }
  for (const m of materias) {
    if (ids.has(m.id)) continue;
    const reg = registros[claveRegistro(iso, m.id)];
    if (reg) out.push({ sesion: { fecha: iso, materia: m, estado: reg }, orden: Number.POSITIVE_INFINITY });
  }
  // Se compara explícito (no restando): Infinity - Infinity es NaN.
  const porHora = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);
  return out.sort((a, b) => porHora(a.orden, b.orden) || a.sesion.materia.nombre.localeCompare(b.sesion.materia.nombre, "es")).map((x) => x.sesion);
}

export function sesionesDelPeriodo(materias: MateriaAsistencia[], registros: Registros, periodo: Periodo, ahora: Date): Sesion[] {
  return diasDelPeriodo(periodo).flatMap((d) => sesionesDelDia(materias, registros, d, ahora));
}

// ---------------------------------------------------------------- estadísticas

export type AsistenciaStats = {
  presentes: number;
  faltas: number;
  sinClase: number;
  pendientes: number;
  // presentes + faltas: las clases sobre las que el % tiene sentido.
  total: number;
  pct: number | null;
};

export function resumir(sesiones: Sesion[]): AsistenciaStats {
  let presentes = 0;
  let faltas = 0;
  let sinClase = 0;
  let pendientes = 0;
  for (const s of sesiones) {
    if (s.estado === "asistio") presentes += 1;
    else if (s.estado === "no_asistio") faltas += 1;
    else if (s.estado === "no_hubo_clase") sinClase += 1;
    else if (s.estado === "pendiente") pendientes += 1;
  }
  const total = presentes + faltas;
  return { presentes, faltas, sinClase, pendientes, total, pct: total ? Math.round((presentes / total) * 100) : null };
}

export type AsistenciaPorMateria = { materia: MateriaAsistencia; sesiones: Sesion[]; stats: AsistenciaStats };

// Una entrada por materia que tenga al menos una clase en el período (por
// horario o por registro), en el orden en que vienen las materias.
export function porMateria(materias: MateriaAsistencia[], sesiones: Sesion[]): AsistenciaPorMateria[] {
  const grupos = new Map<string, Sesion[]>();
  for (const s of sesiones) {
    const g = grupos.get(s.materia.id);
    if (g) g.push(s);
    else grupos.set(s.materia.id, [s]);
  }
  return materias.filter((m) => grupos.has(m.id)).map((m) => ({ materia: m, sesiones: grupos.get(m.id)!, stats: resumir(grupos.get(m.id)!) }));
}

export type SemanaPunto = { lunes: Date; sesiones: Sesion[]; stats: AsistenciaStats };

// Una entrada por semana (lunes) entre `periodo.desde` y `periodo.hasta`,
// también las que no tuvieron ninguna clase: el gráfico semanal conserva el
// tiempo real en el eje.
export function serieSemanal(sesiones: Sesion[], periodo: Periodo): SemanaPunto[] {
  const porLunes = new Map<string, Sesion[]>();
  for (const s of sesiones) {
    const k = toISODate(lunesDe(fechaDeISO(s.fecha)));
    const g = porLunes.get(k);
    if (g) g.push(s);
    else porLunes.set(k, [s]);
  }
  const puntos: SemanaPunto[] = [];
  const ultimo = lunesDe(periodo.hasta).getTime();
  for (let lunes = lunesDe(periodo.desde); lunes.getTime() <= ultimo; lunes = addDias(lunes, 7)) {
    const ss = porLunes.get(toISODate(lunes)) ?? [];
    puntos.push({ lunes, sesiones: ss, stats: resumir(ss) });
  }
  return puntos;
}

// Diferencia en puntos porcentuales; null si falta alguno de los dos.
export function deltaPct(actual: number | null, anterior: number | null): number | null {
  return actual == null || anterior == null ? null : actual - anterior;
}

// ---------------------------------------------------------------- pendientes

// Días con clase que todavía tienen alguna materia sin registrar, del más
// viejo al más nuevo (así se pregunta primero lo atrasado) — puerto de
// maybeOfrecerAsistencia() sin acotarse a "hoy". "Hoy" entra recién cuando
// terminó la última clase del día. Acotado a `maxDiasAtras` a propósito: es
// lo que se le pide activamente al usuario (aviso diario y banner); el resto
// del historial se completa a mano desde el calendario.
export function diasPendientes(materias: MateriaAsistencia[], registros: Registros, hoy: Date, maxDiasAtras = 14, ahora: Date = new Date()): Date[] {
  const dias: Date[] = [];
  for (let i = maxDiasAtras; i >= 0; i--) {
    const fecha = addDias(hoy, -i);
    if (sesionesDelDia(materias, registros, fecha, ahora).some((s) => s.estado === "pendiente")) dias.push(fecha);
  }
  return dias;
}

// ---------------------------------------------------------------- texto

const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatFechaLarga(fecha: Date): string {
  return capitalizar(`${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES_LARGOS[fecha.getMonth()]}`);
}

// "21 – 27 set" / "28 set – 4 oct".
export function formatRangoFechas(desde: Date, hasta: Date): string {
  if (desde.getMonth() === hasta.getMonth() && desde.getFullYear() === hasta.getFullYear()) {
    return `${desde.getDate()} – ${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]}`;
  }
  return `${desde.getDate()} ${MESES_CORTOS[desde.getMonth()]} – ${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]}`;
}

// "Setiembre 2026".
export function formatMesAnio(fecha: Date): string {
  return `${capitalizar(MESES_LARGOS[fecha.getMonth()]!)} ${fecha.getFullYear()}`;
}

export function plural(n: number, uno: string, otros: string): string {
  return `${n} ${n === 1 ? uno : otros}`;
}

// "2 faltas · 1 sin clase · 3 sin registrar" — sólo lo que no es cero. Es lo
// que explica de dónde sale el porcentaje.
export function desglose(stats: AsistenciaStats): string {
  const partes: string[] = [];
  if (stats.faltas) partes.push(plural(stats.faltas, "falta", "faltas"));
  if (stats.sinClase) partes.push(`${stats.sinClase} sin clase`);
  if (stats.pendientes) partes.push(`${stats.pendientes} sin registrar`);
  return partes.join(" · ");
}

// Descripción de un día para lectores de pantalla.
export function describirDia(fecha: Date, sesiones: Sesion[]): string {
  const cabecera = formatFechaLarga(fecha);
  if (!sesiones.length) return `${cabecera}, sin clases`;
  return `${cabecera}, ${sesiones.map((s) => `${s.materia.nombre} ${sesionEstadoLabel[s.estado]}`).join(", ")}`;
}
