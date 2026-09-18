import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Asistencia, AsistenciaEstadoDB } from "@/types/database";

// Hook de Asistencia — mismo patrón que usePersonal.ts, pero contra la
// tabla real `asistencias` (antes vivía sólo en AsyncStorage). Upsert por
// (user_id, materia_id, fecha), igual que guardarAsistenciaModal() en
// runtime.js (web).
export function useAsistencia() {
  const [rows, setRows] = useState<Asistencia[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error: err } = await supabase.from("asistencias").select("*");
    if (err) {
      setError(err.message);
      return;
    }
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const marcar = useCallback(async (fecha: string, materiaId: string, semestreId: string, estado: AsistenciaEstadoDB) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("No hay sesión activa.");
      return false;
    }
    const { data, error: err } = await supabase
      .from("asistencias")
      .upsert(
        { user_id: user.id, materia_id: materiaId, semestre_id: semestreId, fecha, estado },
        { onConflict: "user_id,materia_id,fecha" }
      )
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "No se pudo guardar la asistencia.");
      return false;
    }
    setRows((prev) => {
      const otros = (prev ?? []).filter((r) => !(r.materia_id === materiaId && r.fecha === fecha));
      return [...otros, data];
    });
    return true;
  }, []);

  // Tocar el estado ya seleccionado lo deshace (ver EstadoSegmentado en
  // AsistenciaRow.tsx) — a diferencia de marcar(), acá no hay upsert
  // posible (no hay estado "ninguno" en la tabla), así que se borra la fila.
  const desmarcar = useCallback(async (fecha: string, materiaId: string) => {
    const { error: err } = await supabase.from("asistencias").delete().eq("materia_id", materiaId).eq("fecha", fecha);
    if (err) {
      setError(err.message);
      return false;
    }
    setRows((prev) => (prev ?? []).filter((r) => !(r.materia_id === materiaId && r.fecha === fecha)));
    return true;
  }, []);

  return {
    rows,
    error,
    registros: Object.fromEntries((rows ?? []).map((r) => [`${r.fecha}|${r.materia_id}`, r.estado])),
    marcar,
    desmarcar,
    listo: rows !== null,
    refetch,
  };
}
