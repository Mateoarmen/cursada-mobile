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
import { colors, spacing } from "@/theme/tokens";
import { AppText, BottomSheet, PrimaryButton } from "@/components/ui";
import { AsistenciaRow } from "@/components/AsistenciaRow";
import { demoMaterias } from "@/data/demoContent";
import { diasPendientes, esMismoDia, formatFechaLarga, materiasConClaseEnFecha, toISODate, type AsistenciaEstado } from "@/lib/asistencia";
import { useAsistenciaRegistros } from "@/lib/asistenciaStore";

function hoy(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function AsistenciaDiarioGate() {
  const { registros, marcar, listo } = useAsistenciaRegistros();
  const [cola, setCola] = useState<Date[]>([]);
  const [seleccion, setSeleccion] = useState<Record<string, AsistenciaEstado>>({});

  useEffect(() => {
    if (!listo) return;
    const recalcular = () => setCola(diasPendientes(demoMaterias, registros, hoy()));
    recalcular();
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") recalcular();
    });
    return () => sub.remove();
  }, [listo, registros]);

  const activo = cola[0] ?? null;
  const materiasDia = useMemo(() => (activo ? materiasConClaseEnFecha(demoMaterias, activo) : []), [activo]);
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
      if (estado) marcar(iso, m.id, estado);
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
