import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Personal } from "@/types/database";
import type { DemoAgendaItem } from "@/data/demoContent";

// Hook de Agenda para eventos personales — misma tabla real `personal` que ya
// lee el hero "Lo próximo" de Inicio (ver src/lib/proximos.ts), mismo patrón
// de crear/eliminar que useAgenda.ts. Sin acotar por semestre: los eventos
// personales nunca se acotan (mismo criterio que agendaDeSemestre/el fetch
// de Inicio).
export type NuevoPersonalInput = {
  titulo: string;
  fecha: string;
  todoElDia: boolean;
};

// No existe columna `hecho` en `personal` (ver personalToRow/rowToPersonal
// en cursada-design-system/src/runtime.js) — los eventos personales no
// tienen concepto de "completado" en el modelo de datos.
function personalToDemoItem(r: Personal): DemoAgendaItem {
  return {
    id: r.id,
    kind: "personal",
    tipo: "Personal",
    titulo: r.titulo,
    fecha: r.fecha,
    hecho: false,
    todoElDia: r.todo_el_dia,
  };
}

export function usePersonal() {
  const [rows, setRows] = useState<Personal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error: err } = await supabase.from("personal").select("*");
    if (err) {
      setError(err.message);
      return;
    }
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const crear = useCallback(async (input: NuevoPersonalInput) => {
    // RLS de `personal` exige auth.uid() = user_id (mismo criterio que
    // agenda.crear en useAgenda.ts).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("No hay sesión activa.");
      return false;
    }
    const { data, error: err } = await supabase
      .from("personal")
      .insert({
        user_id: user.id,
        titulo: input.titulo,
        fecha: input.fecha,
        hora: "",
        todo_el_dia: input.todoElDia,
        tag_id: null,
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "No se pudo crear el ítem.");
      return false;
    }
    setRows((prev) => [...(prev ?? []), data]);
    return true;
  }, []);

  const eliminar = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("personal").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return false;
    }
    setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
    return true;
  }, []);

  return {
    rows,
    error,
    items: (rows ?? []).map(personalToDemoItem),
    crear,
    eliminar,
    refetch,
  };
}
