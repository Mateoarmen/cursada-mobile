// Placeholder de tipos. Reemplazar generando los tipos reales con:
//   npx supabase gen types typescript --project-id <tu-project-id> > src/types/database.ts
// Así los tipos quedan sincronizados con las tablas reales (materias, semestres, agenda, horario, etc).

export type Semestre = {
  id: string;
  user_id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
};

export type Materia = {
  id: string;
  semestre_id: string;
  nombre: string;
  color: string | null;
  created_at: string;
};

export type EventoAgenda = {
  id: string;
  materia_id: string;
  titulo: string;
  fecha: string;
  tipo: "parcial" | "entrega" | "final" | "otro";
  created_at: string;
};

export type BloqueHorario = {
  id: string;
  materia_id: string;
  dia_semana: number; // 0-6
  hora_inicio: string;
  hora_fin: string;
};
