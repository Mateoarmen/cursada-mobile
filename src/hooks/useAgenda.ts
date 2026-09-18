import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EventoAgenda } from "@/types/database";
import type { DemoAgendaItem, DemoEvaluacion } from "@/data/demoContent";
import { formatFechaAgenda } from "@/lib/agenda";

// Hook compartido por Agenda y Detalle de materia — ambas pantallas leen y
// escriben la misma tabla real `agenda`, así que el fetch/las mutaciones
// viven acá una sola vez (ver agendaToRow/rowToAgenda en el runtime.js de
// la web para el mapeo camelCase/snake_case que esto replica).
// Sin materiaId: todos los ítems del usuario (Agenda, sin acotar a semestre
// a propósito — ver README de la web, sección Semestres). Con materiaId:
// sólo los de esa materia (Detalle de materia).
// Edición completa (Detalle de ítem: "Editar evaluación") — a diferencia de
// marcarHecho/asignarNota, que son atajos de un solo campo, esto acepta
// cualquier subconjunto de columnas editables de la fila.
export type ActualizarAgendaInput = Partial<Pick<EventoAgenda, "titulo" | "tipo" | "fecha" | "hora" | "materia_id" | "nota_maxima">>;

export type NuevoAgendaInput = {
  materiaId: string;
  kind: "evaluacion" | "tarea";
  tipo: string;
  titulo: string;
  fecha: string;
  hora?: string;
  notaMaxima?: number | null;
};

// Vista para Agenda: mismo shape que DemoAgendaItem (kind fijo "materia",
// itemKind = agenda.kind) para no tocar la UI/lógica de agrupamiento
// existente (agendaBadgeInfo, groupAgenda, etc. en src/lib/agenda.ts).
function rowToDemoItem(r: EventoAgenda): DemoAgendaItem {
  return {
    id: r.id,
    kind: "materia",
    itemKind: r.kind,
    materiaId: r.materia_id ?? undefined,
    tipo: r.tipo,
    titulo: r.titulo,
    fecha: r.fecha,
    hora: r.hora || undefined,
    hecho: !!r.hecho,
    nota: r.nota,
    notaMaxima: r.nota_maxima ?? undefined,
  };
}

// Vista para Detalle de materia: mismo shape que DemoEvaluacion. escalaTotal
// es el fallback de notaMax cuando la fila no tiene nota_maxima propia (ej.
// creada sin especificarla) — así la barra/anillo de la materia no rompe.
export function rowToDemoEvaluacion(r: EventoAgenda, escalaTotalFallback: number): DemoEvaluacion {
  return {
    id: r.id,
    nombre: r.titulo,
    estado: r.hecho ? "aprobada" : "pendiente",
    nota: r.nota ?? undefined,
    notaMax: r.nota_maxima ?? escalaTotalFallback,
    fechaLabel: r.hecho ? undefined : formatFechaAgenda(r.fecha, r.hora || undefined),
  };
}

export function useAgenda(materiaId?: string) {
  const [rows, setRows] = useState<EventoAgenda[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    let query = supabase.from("agenda").select("*");
    if (materiaId) query = query.eq("materia_id", materiaId);
    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
      return;
    }
    setRows(data ?? []);
  }, [materiaId]);

  useEffect(() => {
    setRows(null);
    refetch();
  }, [refetch]);

  // Crear/actualizar/eliminar refrescan el estado local desde la fila que
  // devuelve Supabase (no mutan a ciegas) — así Agenda y Detalle de materia
  // nunca quedan mostrando algo distinto de lo que realmente quedó guardado.
  const crear = useCallback(async (input: NuevoAgendaInput) => {
    // RLS de `agenda` exige auth.uid() = user_id tanto en lectura como en
    // escritura (no hay default de columna) — sin esto el insert rompe la
    // policy. Mismo criterio que agendaToRow() en la web (CURRENT_USER.id).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("No hay sesión activa.");
      return false;
    }
    const { data, error: err } = await supabase
      .from("agenda")
      .insert({
        user_id: user.id,
        materia_id: input.materiaId,
        kind: input.kind,
        tipo: input.tipo,
        titulo: input.titulo,
        fecha: input.fecha,
        hora: input.hora || "",
        hecho: false,
        nota: null,
        nota_maxima: input.notaMaxima ?? null,
        notas: "",
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

  const marcarHecho = useCallback(async (id: string, hecho: boolean) => {
    const { data, error: err } = await supabase.from("agenda").update({ hecho }).eq("id", id).select().single();
    if (err || !data) {
      setError(err?.message ?? "No se pudo actualizar.");
      return false;
    }
    setRows((prev) => (prev ?? []).map((r) => (r.id === id ? data : r)));
    return true;
  }, []);

  // Cargar una nota marca la fila como hecha al mismo tiempo (mismo criterio
  // que abrirAsignarNotaModal/cargarNotaAplicarPaso en la web: no tiene
  // sentido tener nota sin estar rendida/entregada).
  const asignarNota = useCallback(async (id: string, nota: number) => {
    const { data, error: err } = await supabase.from("agenda").update({ nota, hecho: true }).eq("id", id).select().single();
    if (err || !data) {
      setError(err?.message ?? "No se pudo guardar la nota.");
      return false;
    }
    setRows((prev) => (prev ?? []).map((r) => (r.id === id ? data : r)));
    return true;
  }, []);

  const actualizar = useCallback(async (id: string, patch: ActualizarAgendaInput) => {
    const { data, error: err } = await supabase.from("agenda").update(patch).eq("id", id).select().single();
    if (err || !data) {
      setError(err?.message ?? "No se pudo actualizar el ítem.");
      return false;
    }
    setRows((prev) => (prev ?? []).map((r) => (r.id === id ? data : r)));
    return true;
  }, []);

  const eliminar = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("agenda").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return false;
    }
    setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
    return true;
  }, []);

  return {
    rows,
    hasRows: !!rows && rows.length > 0,
    error,
    items: (rows ?? []).map(rowToDemoItem),
    crear,
    marcarHecho,
    asignarNota,
    actualizar,
    eliminar,
    refetch,
  };
}
