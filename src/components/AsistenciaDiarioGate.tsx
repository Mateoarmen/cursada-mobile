// Aviso diario: puerto de maybeOfrecerAsistencia() (web) al ciclo de vida de
// una app mobile. Ahí alcanza con revisar una vez al cargar porque el
// usuario abre una pestaña nueva cada vez; acá se vuelve a revisar cuando la
// app vuelve a primer plano (si se salió el miércoles a la tarde y se vuelve
// el jueves, la revisión inicial nunca se entera de que ya es otro día) y al
// navegar. A diferencia de la web, no se acota a "hoy": si quedó un día atrás
// sin contestar, entra primero en la cola (ver diasPendientes en
// src/lib/asistencia.ts).
//
// Usa el estado compartido (useAsistencia): lo marcado en la pantalla de
// Asistencia deja de preguntarse acá, y guardar es UN pedido con todas las
// respuestas del día — antes eran N pedidos sueltos y la cola se recalculaba
// con el día a medio guardar, así que el aviso se reabría un instante.
import { useEffect, useMemo, useState } from "react";
import { AppState, View } from "react-native";
import { usePathname } from "expo-router";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, BottomSheet, PrimaryButton } from "@/components/ui";
import { AsistenciaRow } from "@/components/AsistenciaRow";
import { Boton } from "@/components/asistencia/Boton";
import { useAsistencia } from "@/hooks/AsistenciaContext";
import { diasPendientes, esMismoDia, formatFechaLarga, inicioDelDia, sesionesDelDia, toISODate, type AsistenciaEstado } from "@/lib/asistencia";

export function AsistenciaDiarioGate() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { listo, materias, registros, marcarVarias } = useAsistencia();
  const [ahora, setAhora] = useState(() => new Date());
  // "Más tarde" descarta un día sólo por hoy: cada día pendiente se pregunta
  // como mucho una vez por día calendario (mañana vuelve, si sigue sin contestar).
  const [descartados, setDescartados] = useState<{ dia: string; fechas: string[] }>({ dia: "", fechas: [] });
  const [seleccion, setSeleccion] = useState<Record<string, AsistenciaEstado>>({});

  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") setAhora(new Date());
    });
    return () => sub.remove();
  }, []);
  // Al navegar dentro de la app también se vuelve a evaluar (una clase pudo
  // terminar mientras tanto); y al salir de Asistencia reaparece lo pendiente.
  useEffect(() => {
    setAhora(new Date());
  }, [pathname]);

  const hoyISO = toISODate(ahora);
  const cola = useMemo(() => {
    if (!listo) return [];
    const ocultos = descartados.dia === hoyISO ? new Set(descartados.fechas) : null;
    return diasPendientes(materias, registros, inicioDelDia(ahora), 14, ahora).filter((f) => !ocultos?.has(toISODate(f)));
  }, [listo, materias, registros, ahora, descartados, hoyISO]);

  // En la pantalla de Asistencia no hace falta: ahí ya está el banner y el
  // editor del día, y dos superficies pidiendo lo mismo se pisan.
  const activo = pathname === "/asistencia" ? null : (cola[0] ?? null);
  const activoISO = activo ? toISODate(activo) : null;

  // Sólo se pregunta por lo que falta: lo que ya se contestó (desde la
  // pantalla, o en la web) no se vuelve a pedir ni se pisa.
  const pendientes = useMemo(() => (activo ? sesionesDelDia(materias, registros, activo, ahora).filter((s) => s.estado === "pendiente") : []), [activo, materias, registros, ahora]);
  const completo = pendientes.length > 0 && pendientes.every((s) => seleccion[s.materia.id] != null);

  useEffect(() => {
    setSeleccion({});
  }, [activoISO]);

  const postergar = () => {
    if (!activoISO) return;
    setDescartados((d) => ({ dia: hoyISO, fechas: [...(d.dia === hoyISO ? d.fechas : []), activoISO] }));
  };

  const guardar = () => {
    if (!activoISO || !completo) return;
    void marcarVarias(pendientes.map((s) => ({ fecha: activoISO, materiaId: s.materia.id, estado: seleccion[s.materia.id]! })));
  };

  const restantes = cola.length - 1;

  return (
    <BottomSheet visible={activo != null} onClose={postergar}>
      {activo ? (
        <>
          <View style={{ gap: 2 }}>
            <AppText weight="700" style={{ fontSize: 18 }}>
              {esMismoDia(activo, ahora) ? "¿Fuiste a clase hoy?" : "¿Fuiste a clase ese día?"}
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
              {formatFechaLarga(activo)}
              {restantes > 0 ? ` · ${restantes} ${restantes === 1 ? "día más" : "días más"} sin registrar` : ""}
            </AppText>
          </View>
          <View style={{ gap: spacing.md }}>
            {pendientes.map((s, i) => (
              <AsistenciaRow
                key={s.materia.id}
                materia={s.materia}
                isFirst={i === 0}
                estadoActual={seleccion[s.materia.id] ?? null}
                onChange={(estado) =>
                  setSeleccion((prev) => {
                    const next = { ...prev };
                    if (estado == null) delete next[s.materia.id];
                    else next[s.materia.id] = estado;
                    return next;
                  })
                }
              />
            ))}
          </View>
          {pendientes.length > 1 ? (
            <Boton
              label="Asistí a todas"
              onPress={() => setSeleccion(Object.fromEntries(pendientes.map((s) => [s.materia.id, "asistio" as const])))}
            />
          ) : null}
          <View style={{ gap: spacing.sm }}>
            <PrimaryButton label="Guardar" onPress={guardar} disabled={!completo} />
            <PrimaryButton label="Más tarde" variant="ghost" onPress={postergar} />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}
