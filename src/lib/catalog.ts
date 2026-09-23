// Capa de acceso al catálogo académico real (esquema `catalogo` en
// Supabase, expuesto vía funciones RPC `cat_*`/`aplicar_*`) — puerto
// directo de los mismos contratos que usa el wizard de onboarding de la
// web (ver runtime.js, sección "WIZARD DE ONBOARDING"). El catálogo está
// cargado por universidad — cat_carreras_de(university_id) devuelve [] si
// esa universidad todavía no tiene datos, y el wizard usa eso para decidir
// si mostrarse.
import { supabase } from "@/lib/supabase";

export const PERIODO_ACTUAL = "2026-2";

export const DIAS_BLOQUE = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type Bloque = { dia: number; ini: number; fin: number };

export type CatCarrera = { id: string; nombre: string; facultad: string | null; slug: string | null; plan_version: string | null };
export type CatMateriaSugerida = {
  materia_id: string;
  codigo: string | null;
  nombre: string;
  creditos: number | null;
  semestre_sugerido: number | null;
  obligatoria: boolean | null;
  dictado_id: string | null;
  doc: string | null;
  salon: string | null;
  bloques: Bloque[];
};
export type CatGrupo = { id: string; codigo: string; turno: string | null; semestre: number | null; edificio: string | null; materias: number };
export type CatDictado = {
  dictado_id: string;
  materia_id: string;
  codigo: string | null;
  nombre: string;
  semestre_sugerido: number | null;
  obligatoria: boolean | null;
  grupo: string | null;
  turno: string | null;
  seccion: string | null;
  salon: string | null;
  estado: string | null;
  bloques: Bloque[];
};
export type CatElectiva = {
  dictado_id: string;
  materia_id: string;
  codigo: string | null;
  nombre: string;
  turno: string | null;
  seccion: string | null;
  estado: string | null;
  bloques: Bloque[];
};
export type CatConflicto = { dictado_a: string; materia_a: string; dictado_b: string; materia_b: string; dia: number; desde: number; hasta: number };
export type CatEsquemaFila = {
  sistema: string;
  min_aprobar: number;
  min_exonerar: number | null;
  instancia_id: string;
  orden: number;
  seccion: string | null;
  titulo: string;
  puntaje_max: number;
  computa: boolean;
  fechas: { etiqueta: string; fecha: string; hora: string | null; turno: string | null }[];
};

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return (data as T[]) ?? [];
}

export const catCarrerasDe = (universityId: string) => rpc<CatCarrera>("cat_carreras_de", { p_university_id: universityId });

export const catMateriasSugeridas = (carreraId: string, semestre?: number, periodo?: string) =>
  rpc<CatMateriaSugerida>("cat_materias_sugeridas", { p_carrera_id: carreraId, p_semestre: semestre ?? null, p_periodo: periodo ?? null });

export const catGrupos = (carreraId: string, periodo: string, semestre?: number) =>
  rpc<CatGrupo>("cat_grupos", { p_carrera_id: carreraId, p_periodo: periodo, p_semestre: semestre ?? null });

export const catDictados = (carreraId: string, periodo: string, semestres?: number[], turno?: string | null) =>
  rpc<CatDictado>("cat_dictados", { p_carrera_id: carreraId, p_periodo: periodo, p_semestres: semestres ?? null, p_turno: turno ?? null });

export const catElectivas = (universityId: string, periodo: string, turno?: string | null) =>
  rpc<CatElectiva>("cat_electivas", { p_university_id: universityId, p_periodo: periodo, p_turno: turno ?? null });

export const catConflictos = (dictadoIds: string[]) => rpc<CatConflicto>("cat_conflictos", { p_dictado_ids: dictadoIds });

export const catEsquema = (materiaId: string, periodo: string) => rpc<CatEsquemaFila>("cat_esquema", { p_materia_id: materiaId, p_periodo: periodo });

export async function aplicarDictados(semestreId: string, dictadoIds: string[]) {
  const { error } = await supabase.rpc("aplicar_dictados", { p_semestre_id: semestreId, p_dictado_ids: dictadoIds });
  if (error) throw error;
}

export async function aplicarPlan(semestreId: string, materiaIds: string[], periodo: string) {
  const { error } = await supabase.rpc("aplicar_plan", { p_semestre_id: semestreId, p_materia_ids: materiaIds, p_periodo: periodo });
  if (error) throw error;
}

export async function aplicarAgenda(semestreId: string, turno?: string | null) {
  const { error } = await supabase.rpc("aplicar_agenda", { p_semestre_id: semestreId, p_turno: turno ?? null });
  if (error) throw error;
}

export function horaTexto(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatHorario(bloques: Bloque[] | null | undefined): string {
  if (!bloques || !bloques.length) return "Sin horario aún";
  const groups = new Map<string, number[]>();
  const order: string[] = [];
  bloques.forEach((b) => {
    const key = `${b.ini}-${b.fin}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(b.dia);
  });
  const parts = order.map((key) => {
    const dias = [...groups.get(key)!].sort((a, b) => a - b);
    const labels = dias.map((d) => DIAS_BLOQUE[d - 1]);
    const diasTxt = labels.length <= 1 ? labels[0] : labels.length === 2 ? `${labels[0]} y ${labels[1]}` : `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
    const [ini, fin] = key.split("-").map(Number);
    return `${diasTxt} · ${horaTexto(ini)}–${horaTexto(fin)}`;
  });
  return parts.join(", ");
}

export function nombreDesdePeriodo(periodo: string): string {
  const [anio, mitad] = periodo.split("-");
  return `${anio ?? new Date().getFullYear()} · ${mitad === "1" ? "Primer semestre" : "Segundo semestre"}`;
}
