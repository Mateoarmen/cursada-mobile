// Tipos de las tablas reales de Supabase relevantes para auth/onboarding
// (columnas confirmadas contra el proyecto real vía MCP) — el resto del
// schema (agenda, event_tags, asistencias, etc.) todavía no tiene tipos acá,
// ver src/data/demoContent.ts para el modelo "de muestra" que usan las
// pantallas que no leen Supabase todavía.
//   npx supabase gen types typescript --project-id <tu-project-id> > src/types/database.ts
// reemplaza esto por los tipos generados reales cuando se necesite más cobertura.

export type Profile = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  foto_url: string | null;
  edad: number | null;
  birth_date: string | null;
  carrera: string | null;
  carrera_id: string | null;
  university_id: string | null;
  university_other: string | null;
  telefono: string | null;
  telefono_e164: string | null;
  telefono_pais: string | null;
  materias_carrera: number | null;
  margen_riesgo: number | null;
  push_prompt_snoozed_until: string | null;
  asistencia_ultima_fecha_completada: string | null;
  created_at: string;
  updated_at: string;
};

export type University = { id: string; nombre: string; created_at: string };

export type Semestre = {
  id: string;
  user_id: string;
  nombre: string;
  activo: boolean;
  orden: number | null;
  periodo: string | null;
  historico: boolean;
  created_at: string;
  updated_at: string;
};

export type EscalaTipo = "nota" | "puntos" | "pct";
export type EscalaMateria = { tipo: EscalaTipo; total: number; aprob: number; exoneracion: number | null };

export type Materia = {
  id: string;
  user_id: string;
  semestre_id: string | null;
  nombre: string;
  doc: string | null;
  color_id: string | null;
  salon: string | null;
  bloques: { dia: number; ini: number; fin: number }[];
  esc: EscalaMateria | Record<string, never>;
  estado: "cursando" | "aprobada" | "recursando" | "pendiente";
  catalogo_materia_id: string | null;
  catalogo_dictado_id: string | null;
  componentes_fijos: { id: string; titulo: string; puntajeMax: number; valor: number | null }[];
  created_at: string;
  updated_at: string;
};

export type EventoAgenda = {
  id: string;
  user_id: string;
  materia_id: string | null;
  kind: "evaluacion" | "tarea";
  tipo: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  hecho: boolean;
  nota: number | null;
  nota_maxima: number | null;
  notas: string | null;
  tag_id: string | null;
  catalogo_hito_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BloqueHorario = {
  id: string;
  materia_id: string;
  dia_semana: number; // 0-6
  hora_inicio: string;
  hora_fin: string;
};
