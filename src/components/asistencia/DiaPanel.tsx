import { View } from "react-native";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, Pill, PressableScale } from "@/components/ui";
import { AsistenciaRow } from "@/components/AsistenciaRow";
import { formatFechaLarga, type AsistenciaEstado, type Sesion } from "@/lib/asistencia";
import { Boton } from "./Boton";
import { Card } from "./Card";

// Editor del día elegido, en la misma pantalla y debajo del calendario —
// no un modal: para completar varios días seguidos alcanza con tocar el
// siguiente. Cada toque guarda al instante (y tocar el estado ya elegido lo
// deshace), así que no hay un "Guardar" que se pueda olvidar.
export function DiaPanel({
  fecha,
  esHoy,
  sesiones,
  hayOtrosPendientes,
  onMarcar,
  onMarcarTodas,
  onSiguiente,
  onCerrar,
}: {
  fecha: Date;
  esHoy: boolean;
  sesiones: Sesion[];
  hayOtrosPendientes: boolean;
  onMarcar: (materiaId: string, estado: AsistenciaEstado | null) => void;
  onMarcarTodas: () => void;
  onSiguiente: () => void;
  onCerrar: () => void;
}) {
  const { colors } = useTheme();
  const sinResponder = sesiones.some((s) => s.estado === "pendiente" || s.estado === "futuro");
  return (
    <Card gap={spacing.md}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <AppText weight="600" style={{ fontSize: 16, letterSpacing: -0.2, flexShrink: 1 }} accessibilityRole="header">
          {formatFechaLarga(fecha)}
        </AppText>
        {esHoy ? <Pill label="Hoy" color={colors.accentText} background={colors.accentSoft} /> : null}
        <View style={{ flex: 1 }} />
        <PressableScale
          scaleTo={0.9}
          hitSlop={8}
          onPress={onCerrar}
          accessibilityLabel="Cerrar"
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}
        >
          <AppIcon name="close" size={13} color={colors.textSecondary} weight="semibold" />
        </PressableScale>
      </View>

      {sesiones.length === 0 ? (
        <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Ese día no hay clases para registrar.</AppText>
      ) : (
        <View style={{ gap: spacing.md }}>
          {sesiones.map((s, i) => (
            <AsistenciaRow
              key={s.materia.id}
              materia={s.materia}
              isFirst={i === 0}
              estadoActual={s.estado === "pendiente" || s.estado === "futuro" ? null : s.estado}
              onChange={(estado) => onMarcar(s.materia.id, estado)}
            />
          ))}
        </View>
      )}

      {(sinResponder && sesiones.length > 1) || hayOtrosPendientes ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.xs }}>
          {sinResponder && sesiones.length > 1 ? <Boton label="Asistí a todas" onPress={onMarcarTodas} /> : null}
          {hayOtrosPendientes ? <Boton label="Siguiente sin registrar" onPress={onSiguiente} chevron /> : null}
        </View>
      ) : null}
    </Card>
  );
}
