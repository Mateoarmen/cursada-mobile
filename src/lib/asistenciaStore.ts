// Store local mínimo (AsyncStorage) para poder marcar/deshacer asistencia y
// que tanto la pantalla de Asistencia como el aviso diario (ver
// AsistenciaDiarioGate) lean el mismo estado. El schema real de
// `asistencias` vive en Supabase (mismo backend que la web, ver
// runtime.js) pero el mobile todavía no lo lee/escribe — ver TODO en
// src/lib/asistencia.ts. Reemplazar por upsert real cuando corresponda.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import type { AsistenciaEstado } from "./asistencia";

const STORAGE_KEY = "cursada.asistencia.registros.v1";

// Clave `${fechaISO}|${materiaId}` — mismo formato en la pantalla y el aviso.
export type RegistrosAsistencia = Record<string, AsistenciaEstado>;

export function claveRegistro(fechaISO: string, materiaId: string): string {
  return `${fechaISO}|${materiaId}`;
}

async function leerRegistros(): Promise<RegistrosAsistencia> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RegistrosAsistencia) : {};
  } catch {
    return {};
  }
}

async function escribirRegistros(registros: RegistrosAsistencia): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
  } catch {
    // Guardado "mejor esfuerzo" — mismo criterio que el resto del estado local de la app.
  }
}

export function useAsistenciaRegistros() {
  const [registros, setRegistros] = useState<RegistrosAsistencia>({});
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    leerRegistros().then((r) => {
      if (!vivo) return;
      setRegistros(r);
      setListo(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // estado null borra el registro (deshacer un click) en vez de guardar "nada".
  const marcar = useCallback((fechaISO: string, materiaId: string, estado: AsistenciaEstado | null) => {
    setRegistros((prev) => {
      const next = { ...prev };
      const clave = claveRegistro(fechaISO, materiaId);
      if (estado == null) delete next[clave];
      else next[clave] = estado;
      escribirRegistros(next);
      return next;
    });
  }, []);

  return { registros, marcar, listo };
}
