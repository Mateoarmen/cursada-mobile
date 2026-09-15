// Contenido de muestra para poder previsualizar el diseño "premium" con datos
// reales de la carrera. El schema actual de Supabase (ver src/types/database.ts)
// todavía no tiene columnas para progreso/nota/créditos/aula — cuando se agreguen,
// estas pantallas deberían leer de `materias`/`agenda`/`horario` en vez de acá.
// TODO(backend): reemplazar por fetch real una vez extendido el schema.

import { colors } from "@/theme/tokens";

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
  progreso: number; // 0-1, avance hacia exoneración/aprobación
  promedio: number;
  horarioResumen: string;
  ubicacionResumen: string;
  evaluaciones: DemoEvaluacion[];
};

export const demoMaterias: DemoMateria[] = [
  {
    id: "con-201",
    nombre: "Contabilidad II",
    codigo: "CON-201",
    creditos: 8,
    color: colors.accent,
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
    color: colors.cyan,
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
    color: colors.danger,
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
    color: colors.purple,
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
    color: colors.success,
    progreso: 0.3,
    promedio: 7.8,
    horarioResumen: "Vie 18:00–20:00",
    ubicacionResumen: "Central · Aula 210",
    evaluaciones: [
      { id: "fin-p1", nombre: "Parcial 1", estado: "aprobada", nota: 8, notaMax: 12 },
    ],
  },
];

export type DemoAgendaItem = {
  id: string;
  titulo: string;
  materiaNombre: string;
  tipoLabel: string;
  grupo: "vencida" | "esta-semana" | "proximas";
  estadoLabel: string;
  accentColor: string;
};

export const demoAgenda: DemoAgendaItem[] = [
  {
    id: "ev-1",
    titulo: "Ejercicios de conciliación",
    materiaNombre: "Contabilidad II",
    tipoLabel: "Tarea",
    grupo: "vencida",
    estadoLabel: "hace 8 d",
    accentColor: colors.danger,
  },
  {
    id: "ev-2",
    titulo: "Parcial 2",
    materiaNombre: "Contabilidad II",
    tipoLabel: "mié 19:00",
    grupo: "esta-semana",
    estadoLabel: "en 2 d",
    accentColor: colors.accentDeep,
  },
  {
    id: "ev-3",
    titulo: "Entrega · Plan de medios",
    materiaNombre: "Marketing Estratégico",
    tipoLabel: "vie 23:59",
    grupo: "esta-semana",
    estadoLabel: "en 4 d",
    accentColor: colors.cyan,
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
