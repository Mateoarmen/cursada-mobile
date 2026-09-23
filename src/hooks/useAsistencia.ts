import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { materiaColors, type MateriaColorId } from "@/theme/tokens";
import type { Asistencia, Materia, Semestre } from "@/types/database";
import { claveRegistro, toISODate, type AsistenciaEstado, type MateriaAsistencia, type Registros } from "@/lib/asistencia";

// Estado de Asistencia — una sola instancia compartida (ver
// AsistenciaContext.tsx) entre la pantalla, el aviso diario y el detalle de
// materia. Antes cada uno tenía su propia copia: lo que se marcaba en la
// pantalla no llegaba al aviso (que volvía a preguntar lo ya contestado) ni
// al revés. Upsert por (user_id, materia_id, fecha), igual que
// guardarAsistenciaModal() en runtime.js (web).

export type NuevoRegistro = { fecha: string; materiaId: string; estado: AsistenciaEstado };

type FilaAGuardar = { fecha: string; materia_id: string; semestre_id: string; estado: AsistenciaEstado };

export type AsistenciaDatos = { semestre: Semestre | null; materias: Materia[]; rows: Asistencia[] };

// Costura entre el estado (optimista, con cola de escrituras) y la
// persistencia. La de producción habla con Supabase; es una interfaz para
// poder ejercitar el estado real sin red.
export type AsistenciaRepo = {
  userId: string;
  cargar(): Promise<AsistenciaDatos>;
  guardar(filas: FilaAGuardar[]): Promise<void>;
  borrar(fecha: string, materiaId: string): Promise<void>;
};

export function crearRepoSupabase(userId: string): AsistenciaRepo {
  return {
    userId,
    async cargar() {
      // Mismo criterio que Horario/Materias: sólo las materias del semestre
      // activo (sin semestre activo, todas). Los registros vienen de TODOS los
      // semestres — el detalle de una materia vieja también los necesita.
      const [sem, asis] = await Promise.all([
        supabase.from("semestres").select("*").eq("user_id", userId).eq("activo", true).maybeSingle(),
        supabase.from("asistencias").select("*").eq("user_id", userId),
      ]);
      if (sem.error) throw sem.error;
      if (asis.error) throw asis.error;
      const semestre = (sem.data as Semestre | null) ?? null;
      let consulta = supabase.from("materias").select("*").eq("user_id", userId);
      if (semestre) consulta = consulta.eq("semestre_id", semestre.id);
      const mat = await consulta;
      if (mat.error) throw mat.error;
      return { semestre, materias: (mat.data ?? []) as Materia[], rows: (asis.data ?? []) as Asistencia[] };
    },
    async guardar(filas) {
      const { error } = await supabase
        .from("asistencias")
        .upsert(
          filas.map((f) => ({ user_id: userId, ...f })),
          { onConflict: "user_id,materia_id,fecha" }
        );
      if (error) throw error;
    },
    // Tocar el estado ya seleccionado lo deshace (ver EstadoSegmentado en
    // AsistenciaRow.tsx): la tabla no tiene un estado "ninguno", así que se
    // borra la fila.
    async borrar(fecha, materiaId) {
      const { error } = await supabase.from("asistencias").delete().eq("user_id", userId).eq("materia_id", materiaId).eq("fecha", fecha);
      if (error) throw error;
    },
  };
}

function materiaAAsistencia(m: Materia): MateriaAsistencia {
  const colorId = (m.color_id && m.color_id in materiaColors ? m.color_id : "gris") as MateriaColorId;
  return {
    id: m.id,
    nombre: m.nombre,
    color: materiaColors[colorId].strong,
    estado: m.estado,
    bloques: m.bloques ?? [],
    creadaEl: m.created_at ? toISODate(new Date(m.created_at)) : undefined,
  };
}

function upsertLocal(rows: Asistencia[], userId: string, filas: FilaAGuardar[]): Asistencia[] {
  const claves = new Set(filas.map((f) => claveRegistro(f.fecha, f.materia_id)));
  const otros = rows.filter((r) => !claves.has(claveRegistro(r.fecha, r.materia_id)));
  return [...otros, ...filas.map((f) => ({ id: `local-${claveRegistro(f.fecha, f.materia_id)}`, user_id: userId, ...f }))];
}

export type AsistenciaState = {
  listo: boolean;
  error: string | null;
  semestre: Semestre | null;
  // Materias del semestre activo, cualquier estado. Vacío mientras no hay datos.
  materias: MateriaAsistencia[];
  registros: Registros;
  refetch: () => Promise<void>;
  marcar: (fecha: string, materiaId: string, estado: AsistenciaEstado) => Promise<boolean>;
  marcarVarias: (items: NuevoRegistro[]) => Promise<boolean>;
  desmarcar: (fecha: string, materiaId: string) => Promise<boolean>;
};

const SIN_MATERIAS: MateriaAsistencia[] = [];
const SIN_REGISTROS: Registros = {};

export function useAsistenciaState(repo: AsistenciaRepo | null): AsistenciaState {
  const [datos, setDatos] = useState<AsistenciaDatos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const datosRef = useRef(datos);
  datosRef.current = datos;

  // Guardados en vuelo y cambios locales: una lectura que estaba en camino
  // cuando se marcó algo puede traer datos anteriores al cambio y pisarlo — se
  // descarta (el cambio local es la verdad más reciente).
  const enVuelo = useRef(0);
  const cambios = useRef(0);
  const reconciliar = useRef(false);
  const cola = useRef<Promise<void>>(Promise.resolve());

  const cargar = useCallback(async () => {
    if (!repo) return;
    const version = cambios.current;
    try {
      const d = await repo.cargar();
      if (enVuelo.current > 0 || version !== cambios.current) return;
      setDatos(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la asistencia.");
    }
  }, [repo]);

  // Carga inicial y al volver a primer plano: el otro cliente (la web) escribe
  // en la misma tabla, y un cambio de día se entera solo.
  useEffect(() => {
    setDatos(null);
    setError(null);
    if (!repo) return;
    void cargar();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void cargar();
    });
    return () => sub.remove();
  }, [repo, cargar]);

  // Las escrituras se serializan: tocar rápido "Asistí → No asistí → Asistí"
  // manda tres pedidos que tienen que llegar en ese orden.
  const persistir = useCallback(
    async (tarea: () => Promise<void>): Promise<boolean> => {
      enVuelo.current += 1;
      const p = cola.current.then(tarea);
      cola.current = p.then(
        () => undefined,
        () => undefined
      );
      let ok = true;
      try {
        await p;
      } catch {
        ok = false;
      }
      enVuelo.current -= 1;
      if (!ok) {
        reconciliar.current = true;
        Alert.alert("No se pudo guardar la asistencia", "Revisá tu conexión e intentá de nuevo.");
      }
      // Si algo falló, se vuelve a leer lo que quedó de verdad en el servidor
      // (recién cuando no quedan otros guardados en vuelo).
      if (enVuelo.current === 0 && reconciliar.current) {
        reconciliar.current = false;
        void cargar();
      }
      return ok;
    },
    [cargar]
  );

  const marcarVarias = useCallback(
    async (items: NuevoRegistro[]): Promise<boolean> => {
      const d = datosRef.current;
      if (!repo || !d || !items.length) return false;
      const semestreDe = new Map(d.materias.map((m) => [m.id, m.semestre_id]));
      const filas: FilaAGuardar[] = items.flatMap((it) => {
        const semestre_id = semestreDe.get(it.materiaId) ?? d.semestre?.id;
        return semestre_id ? [{ fecha: it.fecha, materia_id: it.materiaId, semestre_id, estado: it.estado }] : [];
      });
      if (!filas.length) {
        Alert.alert("No se pudo guardar la asistencia", "Esa materia no tiene un semestre asignado.");
        return false;
      }
      cambios.current += 1;
      setDatos((prev) => (prev ? { ...prev, rows: upsertLocal(prev.rows, repo.userId, filas) } : prev));
      return persistir(() => repo.guardar(filas));
    },
    [repo, persistir]
  );

  const marcar = useCallback(
    (fecha: string, materiaId: string, estado: AsistenciaEstado) => marcarVarias([{ fecha, materiaId, estado }]),
    [marcarVarias]
  );

  const desmarcar = useCallback(
    async (fecha: string, materiaId: string): Promise<boolean> => {
      if (!repo || !datosRef.current) return false;
      cambios.current += 1;
      setDatos((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => !(r.materia_id === materiaId && r.fecha === fecha)) } : prev));
      return persistir(() => repo.borrar(fecha, materiaId));
    },
    [repo, persistir]
  );

  const materias = useMemo(() => (datos ? datos.materias.map(materiaAAsistencia) : SIN_MATERIAS), [datos?.materias]);
  const registros = useMemo<Registros>(
    () => (datos ? Object.fromEntries(datos.rows.map((r) => [claveRegistro(r.fecha, r.materia_id), r.estado])) : SIN_REGISTROS),
    [datos?.rows]
  );
  const listo = datos !== null;
  const semestre = datos?.semestre ?? null;

  return useMemo(
    () => ({ listo, error, semestre, materias, registros, refetch: cargar, marcar, marcarVarias, desmarcar }),
    [listo, error, semestre, materias, registros, cargar, marcar, marcarVarias, desmarcar]
  );
}
