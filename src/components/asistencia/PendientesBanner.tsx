import { View } from "react-native";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";

// Clases ya pasadas sin registrar (últimos 14 días, lo mismo que pide el
// aviso diario). Un solo toque lleva al día más viejo: el banner es el atajo
// de "registrar rápido" cuando se salteó el aviso.
export function PendientesBanner({ cantidad, onCompletar }: { cantidad: number; onCompletar: () => void }) {
  const { colors } = useTheme();
  const texto = `${cantidad} ${cantidad === 1 ? "clase sin registrar" : "clases sin registrar"}`;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onCompletar}
      accessibilityLabel={`${texto}, últimos 14 días. Completar`}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.accentSoft, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 56 }}
    >
      <AppIcon name="checkbox-outline" size={20} color={colors.accentText} />
      <View style={{ flex: 1 }}>
        <AppText weight="600" style={{ fontSize: 14 }}>
          {texto}
        </AppText>
        <AppText style={{ fontSize: 12, color: colors.textSecondary }}>Últimos 14 días</AppText>
      </View>
      <AppText weight="600" style={{ fontSize: 14, color: colors.accentText }}>
        Completar
      </AppText>
    </PressableScale>
  );
}
