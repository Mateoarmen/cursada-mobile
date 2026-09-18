// Puerto de maybeOfrecerAsistencia() (web) al ciclo de vida de una app
// mobile: ahí alcanza con revisar una vez al cargar porque el usuario abre
// una pestaña nueva cada vez, acá hay que volver a revisar cada vez que la
// app vuelve a foreground (AppState) — si se salió a background el
// miércoles a la tarde y se vuelve el jueves a la mañana, la revisión de
// carga inicial (montada el miércoles) nunca se entera de que ya es otro
// día. También, a diferencia de la web, no se acota a "hoy": si quedó un
// día atrás sin contestar, entra primero en la cola (ver diasPendientes en
// src/lib/asistencia.ts) — el usuario los va resolviendo uno por uno.
import { useEffect, useMemo, useState } from "react";
import { AppState, View } from "react-native";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, BottomSheet, PrimaryButton } from "@/components/ui";
import { AsistenciaRow } from "@/components/AsistenciaRow";
import { supabase } from "@/lib/supabase";
import { getSemestreActivoId } from "@/lib/semestres";
import { materiaComputadaToRow } from "@/lib/materias";
import type { Materia } from "@/types/database";
import { diasPendientes, esMismoDia, formatFechaLarga, materiasConClaseEnFecha, toISODate, type AsistenciaEstado } from "@/lib/asistencia";
import { useAsistencia } from "@/hooks/useAsistencia";

function hoy(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function AsistenciaDiarioGate() {
  const { colors } = useTheme();
  const { registros, marcar, listo: asistenciaLista } = useAsistencia();
  const [supaMaterias, setSupaMaterias] = useState<Materia[] | null>(null);
  const [cola, setCola] = useState<Date[]>([]);
  const [seleccion, setSeleccion] = useState<Record<string, AsistenciaEstado>>({});

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const activeId = await getSemestreActivoId();
      let query = supabase.from("materias").select("*");
      if (activeId) query = query.eq("semestre_id", activeId);
      const { data } = await query;
      if (!cancelado) setSupaMaterias(data ?? []);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const materias = useMemo(() => (supaMaterias ?? []).map((m) => materiaComputadaToRow(m, [])), [supaMaterias]);
  // materia_id -> semestre_id de las materias reales (necesario para el
  // upsert de asistencias, ver mismo lookup en app/asistencia.tsx).
  const semestreIdPorMateria = useMemo(
    () => new Map((supaMaterias ?? []).map((m) => [m.id, m.semestre_id])),
    [supaMaterias]
  );
  const listo = asistenciaLista && supaMaterias !== null;

  useEffect(() => {
    if (!listo) return;
    const recalcular = () => setCola(diasPendientes(materias, registros, hoy()));
    recalcular();
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") recalcular();
    });
    return () => sub.remove();
  }, [listo, materias, registros]);

  const activo = cola[0] ?? null;
  const materiasDia = useMemo(() => (activo ? materiasConClaseEnFecha(materias, activo) : []), [materias, activo]);
  const completo = activo != null && materiasDia.every((m) => seleccion[m.id] != null);

  const cerrar = () => {
    setCola((c) => c.slice(1));
    setSeleccion({});
  };

  const guardar = () => {
    if (!activo) return;
    const iso = toISODate(activo);
    materiasDia.forEach((m) => {
      const estado = seleccion[m.id];
      const semestreId = semestreIdPorMateria.get(m.id);
      if (estado && semestreId) marcar(iso, m.id, semestreId, estado);
    });
    cerrar();
  };

  return (
    <BottomSheet visible={activo != null} onClose={cerrar}>
      {activo ? (
        <>
          <View style={{ gap: 2 }}>
            <AppText weight="700" style={{ fontSize: 18 }}>
              {esMismoDia(activo, hoy()) ? "¿Fuiste a clase hoy?" : "¿Fuiste a clase ese día?"}
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{formatFechaLarga(activo)}</AppText>
          </View>
          <View style={{ gap: spacing.md }}>
            {materiasDia.map((m, i) => (
              <AsistenciaRow
                key={m.id}
                materia={m}
                isFirst={i === 0}
                estadoActual={seleccion[m.id] ?? null}
                onChange={(estado) =>
                  setSeleccion((s) => {
                    const next = { ...s };
                    if (estado == null) delete next[m.id];
                    else next[m.id] = estado;
                    return next;
                  })
                }
              />
            ))}
          </View>
          <PrimaryButton label="Guardar" onPress={guardar} disabled={!completo} />
        </>
      ) : null}
    </BottomSheet>
  );
}
