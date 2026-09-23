// Carga de evaluaciones por semana del semestre — datos del widget "Curva
// del semestre" (Inicio). Lógica pura, sin RN ni Supabase: el caller pasa la
// agenda ya acotada al semestre (agendaDeSemestre) y esto sólo agrupa.
import type { EventoAgenda, Materia, Semestre } from "@/types/database";
import { diffDias, MESES_CORTOS, parseISODate, today } from "@/lib/agenda";

// Un semestre "estándar" tiene 16 semanas (diseño 1B); si hay evaluaciones u
// "hoy" más allá, la ventana crece hasta SEMANAS_MAX para no tirar datos.
export const SEMANAS_MIN = 16;
export const SEMANAS_MAX = 26;

export type EvaluacionCarga = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  hora: string | null;
  hecho: boolean;
  nota: number | null;
  notaMaxima: number | null;
  materiaId: string | null;
  materiaNombre: string;
  colorId: string | null;
};

export type SemanaCarga = {
  // Número de semana, 1-based (lo que ve el usuario: "S6").
  n: number;
  inicio: Date; // lunes
  fin: Date; // domingo
  evaluaciones: EvaluacionCarga[];
};

export type CargaSemestre = {
  semanas: SemanaCarga[];
  total: number;
  // Índices 0-based dentro de `semanas`; null si no aplica.
  hoy: number | null;
  pico: number | null;
  libre: number | null; // próxima semana sin evaluaciones desde hoy
  maxCantidad: number;
  proxima: { evaluacion: EvaluacionCarga; dias: number } | null;
};

function addDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Lunes de la semana que contiene `d` (semana lun–dom, como la Agenda).
function lunesDe(d: Date): Date {
  return addDias(d, -((d.getDay() + 6) % 7));
}

function primerLunesDesde(d: Date): Date {
  return addDias(d, (8 - d.getDay()) % 7);
}

// TODO(backend): `semestres` no guarda fecha de inicio/fin. Hasta que exista,
// se usa la convención del calendario ORT: `periodo` "AAAA-1" arranca en
// marzo y "AAAA-2" en agosto (primer lunes del mes).
function inicioNominal(periodo: string | null | undefined): Date | null {
  const m = /^(\d{4})-([12])$/.exec(periodo ?? "");
  if (!m) return null;
  return primerLunesDesde(new Date(Number(m[1]), m[2] === "1" ? 2 : 7, 1));
}

const minFecha = (fechas: Date[]) => fechas.reduce((a, b) => (b < a ? b : a));
const maxFecha = (fechas: Date[]) => fechas.reduce((a, b) => (b > a ? b : a));

export type SegmentoMes = {
  mesIdx: number; // 0-11
  anio: number;
  // Índices 0-based dentro de `semanas`, inclusive.
  desde: number;
  hasta: number;
};

// Agrupa semanas consecutivas por su mes "dominante": el del jueves de esa
// semana (lun–dom), mismo criterio que usa la semana ISO para asignar mes/año
// cuando la semana cruza un límite de mes — la mayoría de sus 7 días caen ahí.
// Sirve para dibujar un eje de meses en vez de números de semana (una semana
// sola no dice mucho; el mes sí da noción de "qué tan lejos" está algo).
export function segmentosPorMes(semanas: Pick<SemanaCarga, "inicio">[]): SegmentoMes[] {
  const out: SegmentoMes[] = [];
  semanas.forEach((s, i) => {
    const jueves = addDias(s.inicio, 3);
    const mesIdx = jueves.getMonth();
    const anio = jueves.getFullYear();
    const last = out[out.length - 1];
    if (last && last.mesIdx === mesIdx && last.anio === anio) {
      last.hasta = i;
    } else {
      out.push({ mesIdx, anio, desde: i, hasta: i });
    }
  });
  return out;
}

export function mesCortoLabel(mesIdx: number): string {
  const m = MESES_CORTOS[mesIdx]!;
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export function formatRangoSemana(inicio: Date, fin: Date): string {
  const mes = (d: Date) => MESES_CORTOS[d.getMonth()]!;
  return inicio.getMonth() === fin.getMonth()
    ? `${inicio.getDate()}–${fin.getDate()} ${mes(fin)}`
    : `${inicio.getDate()} ${mes(inicio)} – ${fin.getDate()} ${mes(fin)}`;
}

export function computeCargaSemestre(
  agendaDelSemestre: EventoAgenda[],
  materias: Pick<Materia, "id" | "nombre" | "color_id">[],
  semestre: Pick<Semestre, "periodo" | "created_at"> | null,
  t: Date = today()
): CargaSemestre {
  const materiaPorId = new Map(materias.map((m) => [m.id, m]));
  const evaluaciones: EvaluacionCarga[] = agendaDelSemestre
    .filter((e) => e.kind === "evaluacion")
    .map((e) => {
      const m = e.materia_id ? materiaPorId.get(e.materia_id) : undefined;
      return {
        id: e.id,
        titulo: e.titulo,
        tipo: e.tipo,
        fecha: e.fecha,
        hora: e.hora,
        hecho: e.hecho,
        nota: e.nota,
        notaMaxima: e.nota_maxima,
        materiaId: e.materia_id,
        materiaNombre: m?.nombre ?? "",
        colorId: m?.color_id ?? null,
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""));

  const fechas = evaluaciones.map((e) => parseISODate(e.fecha));
  const primera = fechas.length ? minFecha(fechas) : null;
  const ultima = fechas.length ? maxFecha(fechas) : null;

  let inicio = inicioNominal(semestre?.periodo);
  if (!inicio) {
    const creado = semestre?.created_at ? parseISODate(semestre.created_at.slice(0, 10)) : null;
    const anclas = [creado, primera].filter((d): d is Date => d != null);
    inicio = lunesDe(anclas.length ? minFecha(anclas) : t);
  }
  // Nunca dejar una evaluación antes de la semana 1.
  if (primera && primera < inicio) inicio = lunesDe(primera);

  const semanaDe = (d: Date) => Math.floor(diffDias(d, inicio!) / 7);
  let n = SEMANAS_MIN;
  if (ultima) n = Math.max(n, semanaDe(ultima) + 1);
  if (t >= inicio) n = Math.max(n, semanaDe(t) + 1);
  n = Math.min(n, SEMANAS_MAX);

  const semanas: SemanaCarga[] = Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    inicio: addDias(inicio!, i * 7),
    fin: addDias(inicio!, i * 7 + 6),
    evaluaciones: [],
  }));
  let total = 0;
  evaluaciones.forEach((e) => {
    const i = semanaDe(parseISODate(e.fecha));
    if (i < 0 || i >= n) return;
    semanas[i]!.evaluaciones.push(e);
    total++;
  });

  const hoyIdx = t >= inicio ? semanaDe(t) : -1;
  const hoy = hoyIdx >= 0 && hoyIdx < n ? hoyIdx : null;

  let maxCantidad = 0;
  let pico: number | null = null;
  semanas.forEach((s, i) => {
    if (s.evaluaciones.length > maxCantidad) {
      maxCantidad = s.evaluaciones.length;
      pico = i;
    }
  });

  let libre: number | null = null;
  for (let i = hoy ?? 0; i < n; i++) {
    if (!semanas[i]!.evaluaciones.length) {
      libre = i;
      break;
    }
  }

  const sig = evaluaciones.find((e) => !e.hecho && diffDias(parseISODate(e.fecha), t) >= 0);
  const proxima = sig ? { evaluacion: sig, dias: diffDias(parseISODate(sig.fecha), t) } : null;

  return { semanas, total, hoy, pico, libre, maxCantidad, proxima };
}
