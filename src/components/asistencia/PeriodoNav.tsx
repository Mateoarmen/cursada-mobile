import { View } from "react-native";
import { radii } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";

function BotonFlecha({ icono, onPress, disabled, label }: { icono: "chevron-back" | "chevron-forward"; onPress: () => void; disabled?: boolean; label: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.9}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}
    >
      <AppIcon name={icono} size={16} color={colors.text} />
    </PressableScale>
  );
}

// Semana o mes a la vista, con flechas para recorrer el historial y un
// atajo para volver al período actual cuando se está en otro. No se puede
// avanzar más allá de hoy: no hay nada que registrar en el futuro.
export function PeriodoNav({
  titulo,
  labelAnterior,
  labelSiguiente,
  onAnterior,
  onSiguiente,
  siguienteDeshabilitado,
  volver,
}: {
  titulo: string;
  labelAnterior: string;
  labelSiguiente: string;
  onAnterior: () => void;
  onSiguiente: () => void;
  siguienteDeshabilitado: boolean;
  volver?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <BotonFlecha icono="chevron-back" onPress={onAnterior} label={labelAnterior} />
      <View style={{ alignItems: "center", flex: 1, paddingHorizontal: 8 }}>
        <AppText weight="600" style={{ fontSize: 16, letterSpacing: -0.2 }} numberOfLines={1} accessibilityRole="header">
          {titulo}
        </AppText>
        {volver ? (
          <PressableScale scaleTo={0.97} onPress={volver.onPress} hitSlop={8}>
            <AppText weight="500" style={{ fontSize: 13, color: colors.accentText }}>
              {volver.label}
            </AppText>
          </PressableScale>
        ) : null}
      </View>
      <BotonFlecha icono="chevron-forward" onPress={onSiguiente} disabled={siguienteDeshabilitado} label={labelSiguiente} />
    </View>
  );
}
