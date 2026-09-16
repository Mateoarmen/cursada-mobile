// Contenido de muestra para poder previsualizar el diseño "premium" con datos
// reales de la carrera. El schema actual de Supabase (ver src/types/database.ts)
// todavía no tiene columnas para progreso/nota/créditos/aula — cuando se agreguen,
// estas pantallas deberían leer de `materias`/`agenda`/`horario` en vez de acá.
// TODO(backend): reemplazar por fetch real una vez extendido el schema.

import { colors, materiaColors, type EstadoMateria, type MateriaColorId, type Tone } from "@/theme/tokens";

export type DemoEvaluacion = {
  id: string;
  nombre: string;
  estado: "aprobada" | "pendiente";
  nota?: number;
  notaMax: number;
  fechaLabel?: string;
};

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
  escalaTotal: number; // 12 = "Nota 0–12", 100 = "Porcentaje", otro = "Puntaje N"
  escalaAprob: number;
  escalaExon?: number;
  progreso: number; // 0-1, avance hacia exoneración/aprobación
  promedio: number;
  horarioResumen: string;
  ubicacionResumen: string;
  evaluaciones: DemoEvaluacion[];
};

function accentOf(colorId: MateriaColorId) {
  return materiaColors[colorId].strong;
}

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
    escalaTotal: 12,
    escalaAprob: 6,
    escalaExon: 9,
    progreso: 0.7,
    promedio: 8.4,
    horarioResumen: "Lun 18:00–20:00",
    ubicacionResumen: "Central · Aula 402",
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
    escalaTotal: 12,
    escalaAprob: 6,
    progreso: 0.55,
    promedio: 6.1,
    horarioResumen: "Mié 19:00–21:00",
    ubicacionResumen: "Cuareim · Aula 210",
    evaluaciones: [
      { id: "est-p1", nombre: "Parcial 1", estado: "aprobada", nota: 6, notaMax: 12 },
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
    escalaTotal: 12,
    escalaAprob: 6,
    progreso: 0.4,
    promedio: 5.0,
    horarioResumen: "Jue 18:00–20:00",
    ubicacionResumen: "Central · Aula 118",
    evaluaciones: [
      { id: "der-p1", nombre: "Parcial 1", estado: "aprobada", nota: 5, notaMax: 12 },
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
    escalaTotal: 12,
    escalaAprob: 6,
    escalaExon: 9,
    progreso: 0.85,
    promedio: 9.1,
    horarioResumen: "Mar 21:00–23:00",
    ubicacionResumen: "Pocitos · Aula 305",
    evaluaciones: [
      { id: "mkt-p1", nombre: "Parcial 1", estado: "aprobada", nota: 9, notaMax: 12 },
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
    escalaTotal: 12,
    escalaAprob: 6,
    progreso: 0.3,
    promedio: 7.8,
    horarioResumen: "Vie 18:00–20:00",
    ubicacionResumen: "Central · Aula 210",
    evaluaciones: [
      { id: "fin-p1", nombre: "Parcial 1", estado: "aprobada", nota: 8, notaMax: 12 },
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
    escalaTotal: 100,
    escalaAprob: 70,
    progreso: 0,
    promedio: 0,
    horarioResumen: "Sin horario aún",
    ubicacionResumen: "Sin salón asignado",
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
  materias: [
    { id: "der-330", nombre: "Derecho Comercial", color: colors.danger, notaTxt: "5.0", aprob: 6, tone: "danger" },
    { id: "est-118", nombre: "Estadística Aplicada", color: colors.cyan, notaTxt: "6.1", aprob: 6, tone: "warning" },
    { id: "fin-260", nombre: "Finanzas Corporativas", color: colors.success, notaTxt: "7.8", aprob: 6, tone: "success" },
    { id: "con-201", nombre: "Contabilidad II", color: colors.accent, notaTxt: "8.4", aprob: 6, tone: "success" },
    { id: "mkt-212", nombre: "Marketing Estratégico", color: colors.purple, notaTxt: "9.1", aprob: 6, tone: "success" },
  ] as DemoProgresoMateria[],
};
