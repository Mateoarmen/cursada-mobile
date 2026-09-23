import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";

// Acción secundaria chica (atajos dentro de una tarjeta o un sheet). Para
// la acción principal está PrimaryButton.
export function Boton({ label, onPress, chevron }: { label: string; onPress: () => void; chevron?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={onPress}
      style={{ height: 40, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.xs }}
    >
      <AppText weight="600" style={{ fontSize: 13 }}>
        {label}
      </AppText>
      {chevron ? <AppIcon name="chevron-forward" size={11} color={colors.text} weight="semibold" /> : null}
    </PressableScale>
  );
}
