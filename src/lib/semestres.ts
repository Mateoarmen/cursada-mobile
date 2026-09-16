// Puerto de obtenerOCrearSemestrePeriodo/obtenerOCrearSemestreHistorico/
// setSemestreActivo (runtime.js) — mismo invariante "a lo sumo un activo
// por usuario" (índice único parcial en la base), respetado acá con el
// mismo patrón en dos pasos: primero desactivar, después activar (nunca
// dos updates con activo:true en el mismo batch).
import { supabase } from "@/lib/supabase";
import { nombreDesdePeriodo } from "@/lib/catalog";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión.");
  return data.user.id;
}

async function desactivarTodos(userId: string) {
  const { error } = await supabase.from("semestres").update({ activo: false }).eq("user_id", userId).eq("activo", true);
  if (error) throw error;
}

async function proximoOrden(userId: string): Promise<number> {
  const { data, error } = await supabase.from("semestres").select("orden").eq("user_id", userId).order("orden", { ascending: false, nullsFirst: false }).limit(1);
  if (error) throw error;
  const max = data?.[0]?.orden;
  return (typeof max === "number" ? max : -1) + 1;
}

// Reusa el semestre existente con este período (reentrar al wizard no
// duplica) o crea uno nuevo y lo activa.
export async function obtenerOCrearSemestrePeriodo(periodo: string): Promise<string> {
  const userId = await currentUserId();
  const { data: existente, error } = await supabase
    .from("semestres")
    .select("id, activo")
    .eq("user_id", userId)
    .eq("periodo", periodo)
    .eq("historico", false)
    .maybeSingle();
  if (error) throw error;

  if (existente) {
    if (!existente.activo) {
      await desactivarTodos(userId);
      const { error: updErr } = await supabase.from("semestres").update({ activo: true }).eq("id", existente.id);
      if (updErr) throw updErr;
    }
    return existente.id as string;
  }

  await desactivarTodos(userId);
  const orden = await proximoOrden(userId);
  const { data: creado, error: insErr } = await supabase
    .from("semestres")
    .insert({ user_id: userId, nombre: nombreDesdePeriodo(periodo), activo: true, periodo, orden })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return creado.id as string;
}

// Semestre sintético que agrupa materias "aprobada"/"pendiente" cargadas
// desde el paso "progreso anterior" del wizard, agrupadas por el número de
// semestre del plan (1..8) — nunca activo, nunca aparece en el selector de
// semestres propios. Idempotente por nombre.
export async function obtenerOCrearSemestreHistorico(n: number): Promise<string> {
  const userId = await currentUserId();
  const nombre = `Semestre ${n} (antes de Cursada)`;
  const { data: existente, error } = await supabase
    .from("semestres")
    .select("id")
    .eq("user_id", userId)
    .eq("historico", true)
    .eq("nombre", nombre)
    .maybeSingle();
  if (error) throw error;
  if (existente) return existente.id as string;

  const { data: creado, error: insErr } = await supabase
    .from("semestres")
    .insert({ user_id: userId, nombre, activo: false, historico: true, orden: -1000 + n })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return creado.id as string;
}

export async function setSemestreActivo(id: string): Promise<void> {
  const userId = await currentUserId();
  await desactivarTodos(userId);
  const { error } = await supabase.from("semestres").update({ activo: true }).eq("id", id);
  if (error) throw error;
}
