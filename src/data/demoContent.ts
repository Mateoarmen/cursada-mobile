// Contenido de muestra para poder previsualizar el diseño "premium" con datos
// reales de la carrera. Las columnas que hacen falta para el cálculo real
// (materias.esc/estado/componentes_fijos, agenda.nota/hecho, etc.) YA
// EXISTEN en Supabase — Materias, Detalle de materia, los KPIs/riesgo/
// progreso de Inicio y Horario ya no usan nada de este archivo, calculan
// todo en vivo (ver src/lib/materias.ts, puerto de runtime.js). Lo que
// sigue leyendo de acá:
// - app/progreso.tsx (pantalla "Progreso" completa: historial de
//   semestres, pendientes, meta de carrera) y app/asistencia.tsx +
//   AsistenciaRow/AsistenciaDiarioGate (asistencia) — fuera de alcance de
//   este paso, no tienen fetch real todavía.
// - app/(tabs)/agenda.tsx: sólo los eventos "personales" (demoAgenda
//   filtrado a kind:"personal"), como punto de partida editable — no hay
//   tabla `personal` en Supabase todavía.

import { colors, materiaColors, type EstadoMateria, type MateriaColorId, type Tone } from "@/theme/tokens";
import { nombreDesdePeriodo, PERIODO_ACTUAL, type Bloque } from "@/lib/catalog";
import { formatFechaAgenda } from "@/lib/agenda";
import type { EscalaTipo } from "@/types/database";

export type DemoEvaluacion = {
  id: string;
  nombre: string;
  estado: "aprobada" | "pendiente";
  nota?: number;
  notaMax: number;
  fechaLabel?: string;
};

// Puntos del curso sin fecha (ej. "Participación en clase") que el
// estudiante carga a mano — cuentan para el total/aprobación igual que una
// evaluación, pero no tienen "próxima instancia" que rendir. Réplica de
// `componentes_fijos` en el schema real (ver types/database.ts).
export type DemoComponenteFijo = {
  id: string;
  titulo: string;
  puntajeMax: number;
  valor: number | null;
};

export type DemoAsistenciaRango = { pct: number; presentes: number; total: number };

export type DemoMateria = {
  id: string;
  nombre: string;
  codigo: string;
  creditos: number;
  color: string;
  colorId: MateriaColorId;
  docente: string;
  estado: EstadoMateria;
  // Tono académico del ring/nota — independiente del badge de estado (ver
  // tokens.ts: "cursando" con buen promedio es tone:"success" igual, el
  // badge sigue gris). Replica `toneDe()` de runtime.js, calculado acá a
  // mano porque es data de muestra fija.
  tone: Tone;
  salon: string;
  periodoLabel: string;
  // El TIPO de escala lo define el usuario al cargar la materia (esc.tipo
  // en Supabase) — nunca se infiere del total. Una materia "puntos" puede
  // perfectamente totalizar 100 sin ser porcentaje (ver lib/materias.ts).
  escalaTipo: EscalaTipo;
  escalaTotal: number;
  escalaAprob: number;
  escalaExon?: number;
  progreso: number; // 0-1, avance hacia exoneración/aprobación
  promedio: number;
  horarioResumen: string;
  ubicacionResumen: string;
  bloques: Bloque[];
  componentesFijos: DemoComponenteFijo[];
  asistencia: { semana: DemoAsistenciaRango; mes: DemoAsistenciaRango; semestre: DemoAsistenciaRango } | null;
  evaluaciones: DemoEvaluacion[];
};

function accentOf(colorId: MateriaColorId) {
  return materiaColors[colorId].strong;
}

const PERIODO_LABEL = nombreDesdePeriodo(PERIODO_ACTUAL);

export const demoMaterias: DemoMateria[] = [
  {
    id: "con-201",
    nombre: "Contabilidad II",
    codigo: "CON-201",
    creditos: 8,
    colorId: "azul",
    color: accentOf("azul"),
    docente: "Prof. Andrea Ríos",
    estado: "cursando",
    tone: "success",
    salon: "Central · Aula 402",
    periodoLabel: PERIODO_LABEL,
    escalaTipo: "nota",
    escalaTotal: 12,
    escalaAprob: 6,
    escalaExon: 9,
    progreso: 0.7,
    promedio: 8.4,
    horarioResumen: "Lun 18:00–20:00",
    ubicacionResumen: "Central · Aula 402",
    bloques: [{ dia: 1, ini: 18, fin: 20 }],
    componentesFijos: [{ id: "con-fijo-1", titulo: "Participación en clase", puntajeMax: 10, valor: 8 }],
    asistencia: {
      semana: { pct: 100, presentes: 1, total: 1 },
      mes: { pct: 100, presentes: 4, total: 4 },
      semestre: { pct: 93, presentes: 13, total: 14 },
    },
    evaluaciones: [
      { id: "con-p1", nombre: "Parcial 1", estado: "aprobada", nota: 9, notaMax: 12 },
      { id: "con-p2", nombre: "Parcial 2", estado: "pendiente", notaMax: 12, fechaLabel: "mié 3 de set · 19:00" },
    ],
  },
  {
    id: "est-118",
    nombre: "Estadística Aplicada",
    codigo: "EST-118",
    creditos: 6,
    colorId: "turquesa",
    color: accentOf("turquesa"),
    docente: "Prof. Martín Souza",
    estado: "cursando",
    tone: "warning",
    salon: "Cuareim · Aula 210",
    periodoLabel: PERIODO_LABEL,
    escalaTipo: "nota",
    escalaTotal: 12,
    escalaAprob: 6,
    progreso: 0.55,
    promedio: 6.1,
    horarioResumen: "Mié 19:00–21:00",
    ubicacionResumen: "Cuareim · Aula 210",
    bloques: [{ dia: 3, ini: 19, fin: 21 }],
    componentesFijos: [],
    asistencia: {
      semana: { pct: 100, presentes: 1, total: 1 },
      mes: { pct: 75, presentes: 3, total: 4 },
      semestre: { pct: 79, presentes: 11, total: 14 },
    },
    evaluaciones: [
      { id: "est-p1", nombre: "Parcial 1", estado: "aprobada", nota: 6, notaMax: 12 },
      { id: "est-final", nombre: "Final", estado: "pendiente", notaMax: 12, fechaLabel: formatFechaAgenda(isoOffset(18), "14:00") },
    ],
  },
  {
    id: "der-330",
    nombre: "Derecho Comercial",
    codigo: "DER-330",
    creditos: 7,
    colorId: "coral",
    color: accentOf("coral"),
    docente: "Prof. Lucía Fernández",
    estado: "recursando",
    tone: "danger",
    salon: "Central · Aula 118",
    periodoLabel: PERIODO_LABEL,
    escalaTipo: "nota",
    escalaTotal: 12,
    escalaAprob: 6,
    progreso: 0.4,
    promedio: 5.0,
    horarioResumen: "Jue 18:00–20:00",
    ubicacionResumen: "Central · Aula 118",
    bloques: [{ dia: 4, ini: 18, fin: 20 }],
    componentesFijos: [],
    asistencia: {
      semana: { pct: 0, presentes: 0, total: 1 },
      mes: { pct: 50, presentes: 2, total: 4 },
      semestre: { pct: 64, presentes: 9, total: 14 },
    },
    evaluaciones: [
      { id: "der-p1", nombre: "Parcial 1", estado: "aprobada", nota: 5, notaMax: 12 },
      { id: "der-p2", nombre: "Parcial 1 · recuperatorio", estado: "pendiente", notaMax: 12, fechaLabel: formatFechaAgenda(isoOffset(-2), "18:00") },
    ],
  },
  {
    id: "mkt-212",
    nombre: "Marketing Estratégico",
    codigo: "MKT-212",
    creditos: 6,
    colorId: "indigo",
    color: accentOf("indigo"),
    docente: "Prof. Nicolás Bianchi",
    estado: "cursando",
    tone: "success",
    salon: "Pocitos · Aula 305",
    periodoLabel: PERIODO_LABEL,
    escalaTipo: "nota",
    escalaTotal: 12,
    escalaAprob: 6,
    escalaExon: 9,
    progreso: 0.85,
    promedio: 9.1,
    horarioResumen: "Mar 21:00–23:00",
    ubicacionResumen: "Pocitos · Aula 305",
    bloques: [{ dia: 2, ini: 21, fin: 23 }],
    componentesFijos: [],
    asistencia: {
      semana: { pct: 100, presentes: 1, total: 1 },
      mes: { pct: 100, presentes: 4, total: 4 },
      semestre: { pct: 100, presentes: 14, total: 14 },
    },
    evaluaciones: [
      { id: "mkt-p1", nombre: "Parcial 1", estado: "aprobada", nota: 9, notaMax: 12 },
      { id: "mkt-p2", nombre: "Parcial 2", estado: "pendiente", notaMax: 12 },
    ],
  },
  {
    id: "fin-260",
    nombre: "Finanzas Corporativas",
    codigo: "FIN-260",
    creditos: 8,
    colorId: "verde",
    color: accentOf("verde"),
    docente: "Prof. Camila Duarte",
    estado: "aprobada",
    tone: "success",
    salon: "Central · Aula 210",
    periodoLabel: "2026 · Primer semestre",
    escalaTipo: "nota",
    escalaTotal: 12,
    escalaAprob: 6,
    progreso: 0.3,
    promedio: 7.8,
    horarioResumen: "Vie 18:00–20:00",
    ubicacionResumen: "Central · Aula 210",
    bloques: [],
    componentesFijos: [],
    asistencia: null,
    evaluaciones: [
      { id: "fin-p1", nombre: "Parcial 1", estado: "aprobada", nota: 8, notaMax: 12 },
      { id: "fin-p2", nombre: "Parcial 2", estado: "aprobada", nota: 7.6, notaMax: 12 },
    ],
  },
  {
    id: "aud-140",
    nombre: "Auditoría I",
    codigo: "AUD-140",
    creditos: 6,
    colorId: "amarillo",
    color: accentOf("amarillo"),
    docente: "Prof. Diego Pereira",
    estado: "pendiente",
    tone: "neutral",
    salon: "Sin salón asignado",
    periodoLabel: "2026 · Primer semestre",
    escalaTipo: "pct",
    escalaTotal: 100,
    escalaAprob: 70,
    progreso: 0,
    promedio: 0,
    horarioResumen: "Sin horario aún",
    ubicacionResumen: "Sin salón asignado",
    bloques: [],
    componentesFijos: [],
    asistencia: null,
    evaluaciones: [],
  },
];

// Réplica del modelo real de `agenda` (ver agendaToRow/rowToAgenda en
// runtime.js): kind materia/personal, itemKind evaluación/tarea sólo para
// materia, hecho + nota (nota sólo aplica a evaluaciones — agendaBadgeInfo
// en src/lib/agenda.ts distingue "Rendido" de "Esperando nota" con esto).
export type DemoAgendaItem = {
  id: string;
  kind: "materia" | "personal";
  itemKind?: "evaluacion" | "tarea"; // sólo si kind === "materia"
  materiaId?: string;
  tipo: string; // texto libre: "Parcial", "Entrega", "Final", "Personal"...
  titulo: string;
  fecha: string; // ISO yyyy-mm-dd
  hora?: string; // "HH:MM"
  todoElDia?: boolean; // sólo eventos personales
  hecho: boolean;
  nota?: number | null;
  notaMaxima?: number;
  tag?: { label: string; color: string };
};

// Fechas relativas a hoy para que la agenda de muestra siempre caiga en
// vencidas/esta-semana/próximamente de forma realista, sin fechas fijas
// que queden viejas.
function isoOffset(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const demoAgenda: DemoAgendaItem[] = [
  // Vencidas
  {
    id: "ag-1",
    kind: "materia",
    itemKind: "tarea",
    materiaId: "con-201",
    tipo: "Entrega",
    titulo: "Ejercicios de conciliación",
    fecha: isoOffset(-8),
    hecho: false,
  },
  {
    id: "ag-2",
    kind: "materia",
    itemKind: "evaluacion",
    materiaId: "der-330",
    tipo: "Recuperatorio",
    titulo: "Parcial 1 · recuperatorio",
    fecha: isoOffset(-2),
    hora: "18:00",
    hecho: false,
  },
  // Esta semana
  {
    id: "ag-3",
    kind: "materia",
    itemKind: "evaluacion",
    materiaId: "con-201",
    tipo: "Parcial",
    titulo: "Parcial 2",
    fecha: isoOffset(2),
    hora: "19:00",
    hecho: false,
  },
  {
    id: "ag-4",
    kind: "materia",
    itemKind: "tarea",
    materiaId: "mkt-212",
    tipo: "Entrega",
    titulo: "Entrega · Plan de medios",
    fecha: isoOffset(4),
    hora: "23:59",
    hecho: false,
    tag: { label: "Grupal", color: colors.purple },
  },
  {
    id: "ag-5",
    kind: "personal",
    tipo: "Personal",
    titulo: "Cumpleaños de mamá",
    fecha: isoOffset(5),
    todoElDia: true,
    hecho: false,
  },
  // Próximamente (dos meses distintos, para el separador de mes)
  {
    id: "ag-6",
    kind: "materia",
    itemKind: "evaluacion",
    materiaId: "est-118",
    tipo: "Final",
    titulo: "Final",
    fecha: isoOffset(18),
    hora: "14:00",
    hecho: false,
  },
  {
    id: "ag-7",
    kind: "materia",
    itemKind: "tarea",
    materiaId: "aud-140",
    tipo: "Entrega",
    titulo: "Informe final de auditoría",
    fecha: isoOffset(40),
    hecho: false,
    tag: { label: "Importante", color: colors.danger },
  },
  {
    id: "ag-8",
    kind: "personal",
    tipo: "Personal",
    titulo: "Vacaciones de invierno",
    fecha: isoOffset(55),
    todoElDia: true,
    hecho: false,
  },
  // Completadas
  {
    id: "ag-9",
    kind: "materia",
    itemKind: "evaluacion",
    materiaId: "con-201",
    tipo: "Parcial",
    titulo: "Parcial 1",
    fecha: isoOffset(-20),
    hecho: true,
    nota: 9,
    notaMaxima: 12,
  },
  {
    id: "ag-10",
    kind: "materia",
    itemKind: "evaluacion",
    materiaId: "est-118",
    tipo: "Parcial",
    titulo: "Parcial 1",
    fecha: isoOffset(-15),
    hecho: true,
    nota: null,
    notaMaxima: 12,
  },
  {
    id: "ag-11",
    kind: "materia",
    itemKind: "tarea",
    materiaId: "fin-260",
    tipo: "Entrega",
    titulo: "TP 1 · flujo de caja",
    fecha: isoOffset(-12),
    hecho: true,
  },
];

export type DemoHorarioBloque = {
  id: string;
  materiaNombre: string;
  horaInicio: string;
  horaFin: string;
  ubicacion: string;
  accentColor: string;
  accentSoft: string;
};

export const demoHorarioSemana = [
  { key: "lun", label: "Lun", dia: 1 },
  { key: "mar", label: "Mar", dia: 2 },
  { key: "mie", label: "Mié", dia: 3 },
  { key: "jue", label: "Jue", dia: 4 },
  { key: "vie", label: "Vie", dia: 5 },
];

export const demoHorarioPorDia: Record<number, DemoHorarioBloque[]> = {
  2: [
    {
      id: "hb-1",
      materiaNombre: "Microeconomía",
      horaInicio: "19:00",
      horaFin: "21:00",
      ubicacion: "Cuareim · Aula 210",
      accentColor: colors.danger,
      accentSoft: colors.dangerSofter,
    },
    {
      id: "hb-2",
      materiaNombre: "Marketing Estratégico",
      horaInicio: "21:00",
      horaFin: "23:00",
      ubicacion: "Pocitos · Aula 305",
      accentColor: colors.cyan,
      accentSoft: colors.cyanSoft,
    },
  ],
};

export const demoHome = {
  proximo: {
    titulo: "Parcial 2 · Contabilidad II",
    detalle: "mié 3 · 19:00 · Central, Aula 402",
    diasLabel: "en 2 días",
    progreso: 0.62,
    progresoLabel: "Llevás 8.4 de 12, con 6.2 acá exonerás.",
  },
  stats: {
    promedioGeneral: 8.4,
    pendientesSemana: 7,
    materiasCursando: 5,
  },
  proximosDias: [
    { id: "pd-1", titulo: "Parcial 2", detalle: "Contabilidad II · mié 19:00", color: colors.accentDeep },
    { id: "pd-2", titulo: "Entrega · Plan de medios", detalle: "Marketing Estratégico · vie 23:59", color: colors.cyan },
  ],
};

// KPIs, materias en riesgo y progreso del semestre de Inicio — mismo scope
// que computeKpis()/renderInicio() de la web (semestre activo, no
// histórico). Placeholder hasta que el schema de Supabase tenga
// progreso/nota (ver nota arriba de demoMaterias).
export type DemoTone = "success" | "warning" | "danger" | "neutral";

export const demoInicioKpis = {
  cursando: { valor: String(demoHome.stats.materiasCursando), sub: "este semestre" },
  proximaEvaluacion: { valor: "Mié 3", sub: "Parcial · Contabilidad II", tone: "warning" as DemoTone },
  promedioGeneral: { valor: demoHome.stats.promedioGeneral.toFixed(1), sub: "normalizado · 3 escalas", tone: "success" as DemoTone },
  pendientesSemana: { valor: String(demoHome.stats.pendientesSemana), sub: "1 vencida de antes", tone: "danger" as DemoTone },
};

export type DemoMateriaRiesgo = {
  id: string;
  nombre: string;
  color: string;
  actual: number;
  total: number;
  aprob: number;
  tone: DemoTone;
  riesgoTxt: string;
};

export const demoMateriasRiesgo: DemoMateriaRiesgo[] = [
  {
    id: "der-330",
    nombre: "Derecho Comercial",
    color: colors.danger,
    actual: 5.0,
    total: 12,
    aprob: 6,
    tone: "danger",
    riesgoTxt: "Necesitás 8.5 en lo que falta para aprobar.",
  },
  {
    id: "est-118",
    nombre: "Estadística Aplicada",
    color: colors.cyan,
    actual: 6.1,
    total: 12,
    aprob: 6,
    tone: "warning",
    riesgoTxt: "Justo en el límite — un mal parcial te deja abajo.",
  },
];

export type DemoProgresoMateria = {
  id: string;
  nombre: string;
  color: string;
  notaTxt: string;
  aprob: number;
  tone: DemoTone;
};

export const demoProgresoSemestre = {
  promedio: demoHome.stats.promedioGeneral,
  deltaLabel: "+0.6 pts vs. Otoño 2026",
  deltaTone: "success" as DemoTone,
  evaluacionesCalificadas: 5,
  evaluacionesEsperadas: 9,
  // "encaminada a exonerar" / "aprobando" / "en riesgo" — mismo desglose que
  // renderProgresoEsteSemestre() en runtime.js (m.actual vs. escalaExon/
  // escalaAprob de cada materia). Calculado a mano acá porque es data de
  // muestra fija: mkt-212 ya está sobre su exoneración (9.1≥9), con-201 y
  // fin-260/est-118 aprobando sin llegar a exonerar, der-330 por debajo del
  // mínimo de aprobación.
  buckets: { exonerando: 1, aprobando: 3, enRiesgo: 1 },
  materias: [
    { id: "der-330", nombre: "Derecho Comercial", color: colors.danger, notaTxt: "5.0", aprob: 6, tone: "danger" },
    { id: "est-118", nombre: "Estadística Aplicada", color: colors.cyan, notaTxt: "6.1", aprob: 6, tone: "warning" },
    { id: "fin-260", nombre: "Finanzas Corporativas", color: colors.success, notaTxt: "7.8", aprob: 6, tone: "success" },
    { id: "con-201", nombre: "Contabilidad II", color: colors.accent, notaTxt: "8.4", aprob: 6, tone: "success" },
    { id: "mkt-212", nombre: "Marketing Estratégico", color: colors.purple, notaTxt: "9.1", aprob: 6, tone: "success" },
  ] as DemoProgresoMateria[],
};

// ============================================================
// Pantalla Progreso — historial completo de semestres (no se acota al
// activo, ver cursada-conventions § Semestres), distribución de estado y
// meta de carrera. Mismo placeholder de datos que el resto de este archivo:
// reemplazar por fetch real una vez el schema tenga progreso/nota/créditos.
// ============================================================

export type DemoSemestreMateria = {
  id: string;
  nombre: string;
  color: string;
  notaTxt: string; // "—" si todavía no tiene nota cargada
  aprob: number;
  tone: DemoTone;
};

export type DemoSemestrePunto = {
  id: string;
  nombre: string;
  activo: boolean;
  promedio: number | null; // 0-100 normalizado; null = semestre sin ninguna nota cargada
  aprobadas: number;
  exoneradas: number;
  total: number;
  materias: DemoSemestreMateria[];
};

// Semestre actual: mismas 6 materias que demoMaterias arriba (total:6),
// aprobadas: sólo fin-260; exoneradas: sólo mkt-212 (única que llegó a su
// escalaExon). aud-140 (pendiente) entra igual con nota "—", no se excluye
// de "materias de este semestre" — sólo se excluye del desglose de riesgo.
const demoProgresoSemestreActualMaterias: DemoSemestreMateria[] = [
  { id: "con-201", nombre: "Contabilidad II", color: accentOf("azul"), notaTxt: "8.4", aprob: 6, tone: "success" },
  { id: "est-118", nombre: "Estadística Aplicada", color: accentOf("turquesa"), notaTxt: "6.1", aprob: 6, tone: "warning" },
  { id: "der-330", nombre: "Derecho Comercial", color: accentOf("coral"), notaTxt: "5.0", aprob: 6, tone: "danger" },
  { id: "mkt-212", nombre: "Marketing Estratégico", color: accentOf("indigo"), notaTxt: "9.1", aprob: 6, tone: "success" },
  { id: "fin-260", nombre: "Finanzas Corporativas", color: accentOf("verde"), notaTxt: "7.8", aprob: 6, tone: "success" },
  { id: "aud-140", nombre: "Auditoría I", color: accentOf("amarillo"), notaTxt: "—", aprob: 70, tone: "neutral" },
];

export const demoProgresoHistorial: DemoSemestrePunto[] = [
  {
    id: "sem-2024-2",
    nombre: "2024 · Segundo semestre",
    activo: false,
    promedio: null,
    aprobadas: 3,
    exoneradas: 0,
    total: 3,
    materias: [
      { id: "hist-1", nombre: "Introducción a la Economía", color: colors.cyan, notaTxt: "—", aprob: 6, tone: "neutral" },
      { id: "hist-2", nombre: "Matemática I", color: colors.purple, notaTxt: "—", aprob: 6, tone: "neutral" },
      { id: "hist-3", nombre: "Herramientas Informáticas", color: colors.success, notaTxt: "—", aprob: 6, tone: "neutral" },
    ],
  },
  {
    id: "sem-2025-1",
    nombre: "2025 · Primer semestre",
    activo: false,
    promedio: 68,
    aprobadas: 4,
    exoneradas: 1,
    total: 4,
    materias: [
      { id: "hist-4", nombre: "Matemática II", color: colors.accent, notaTxt: "7.2", aprob: 6, tone: "success" },
      { id: "hist-5", nombre: "Macroeconomía", color: colors.danger, notaTxt: "6.4", aprob: 6, tone: "success" },
      { id: "hist-6", nombre: "Derecho Civil", color: colors.cyan, notaTxt: "8.9", aprob: 6, tone: "success" },
      { id: "hist-7", nombre: "Comportamiento Organizacional", color: colors.purple, notaTxt: "6.0", aprob: 6, tone: "success" },
    ],
  },
  {
    id: "sem-2025-2",
    nombre: "2025 · Segundo semestre",
    activo: false,
    promedio: 75,
    aprobadas: 5,
    exoneradas: 2,
    total: 5,
    materias: [
      { id: "hist-8", nombre: "Contabilidad I", color: colors.accent, notaTxt: "9.0", aprob: 6, tone: "success" },
      { id: "hist-9", nombre: "Costos I", color: colors.success, notaTxt: "8.6", aprob: 6, tone: "success" },
      { id: "hist-10", nombre: "Estadística I", color: colors.cyan, notaTxt: "7.1", aprob: 6, tone: "success" },
      { id: "hist-11", nombre: "Derecho Comercial I", color: accentOf("coral"), notaTxt: "6.8", aprob: 6, tone: "success" },
      { id: "hist-12", nombre: "Inglés III", color: colors.purple, notaTxt: "9.4", aprob: 6, tone: "success" },
    ],
  },
  {
    id: "sem-2026-1",
    nombre: "2026 · Primer semestre",
    activo: false,
    promedio: 70,
    aprobadas: 3,
    exoneradas: 1,
    total: 4,
    materias: [
      { id: "hist-13", nombre: "Costos II", color: colors.accent, notaTxt: "9.3", aprob: 6, tone: "success" },
      { id: "hist-14", nombre: "Finanzas I", color: colors.success, notaTxt: "6.5", aprob: 6, tone: "success" },
      { id: "hist-15", nombre: "Estadística II", color: colors.cyan, notaTxt: "6.9", aprob: 6, tone: "success" },
      { id: "hist-16", nombre: "Comercio Exterior", color: accentOf("coral"), notaTxt: "—", aprob: 6, tone: "neutral" },
    ],
  },
  {
    id: "sem-2026-2",
    nombre: PERIODO_LABEL,
    activo: true,
    promedio: 71,
    aprobadas: 1,
    exoneradas: 1,
    total: 6,
    materias: demoProgresoSemestreActualMaterias,
  },
];

// "Materias pendientes" (estado 'pendiente' = debe rendir examen) de TODA
// la cuenta, agrupadas por semestre — mismo alcance histórico completo que
// el resto de Progreso (ver renderProgresoPendientes en runtime.js).
export type DemoMateriaPendiente = {
  id: string;
  materiaId: string;
  nombre: string;
  color: string;
  aprob: number;
  semestreId: string;
  semestreNombre: string;
};

export const demoProgresoPendientes: DemoMateriaPendiente[] = [
  {
    id: "pend-aud-140",
    materiaId: "aud-140",
    nombre: "Auditoría I",
    color: accentOf("amarillo"),
    aprob: 70,
    semestreId: "sem-2026-2",
    semestreNombre: PERIODO_LABEL,
  },
  {
    id: "pend-hist-16",
    materiaId: "hist-16",
    nombre: "Comercio Exterior",
    color: accentOf("coral"),
    aprob: 6,
    semestreId: "sem-2026-1",
    semestreNombre: "2026 · Primer semestre",
  },
];

// Materias aprobadas sin ninguna nota cargada todavía (típicamente las
// tildadas en el paso "progreso" del onboarding) — mismo criterio que
// materiasAprobadasSinNota() en runtime.js. Acá: las 3 del semestre
// "2024 · Segundo semestre" cargado como progreso previo.
export const demoProgresoAprobadasSinNota = demoProgresoHistorial[0]!.materias.length;

// Meta de carrera para "Progreso hacia el título" — configurable en
// Ajustes en la web (CURRENT_PROFILE.materias_carrera); acá fija porque
// Ajustes todavía no existe como pantalla en la app (ver inventario).
export const demoProgresoMeta = { materiasCarrera: 45 };
