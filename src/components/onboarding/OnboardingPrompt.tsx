import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale, PrimaryButton, Reveal, Spotlight, type AppIconName } from "@/components/ui";

type Props = {
  icon: AppIconName;
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
  secondary?: string;
  onSecondary: () => void;
  error?: string | null;
};

// Pantalla-invitación de los pasos opcionales post-wizard (horario,
// progreso anterior, notas). Antes eran una pregunta ("¿Querés…?") pegada
// arriba con "Ahora no" / "Sí" del mismo peso; ahora es una llamada a la
// acción: bloque centrado en la pantalla, título en imperativo, un único
// botón principal y la salida como link secundario de menor jerarquía.
export function OnboardingPrompt({ icon, title, body, cta, onCta, secondary = "Lo hago después", onSecondary, error }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Spotlight />
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing.xxl }}>
        <Reveal style={{ gap: spacing.xxl }}>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.lg,
                backgroundColor: colors.accentSofter,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.sm,
              }}
            >
              <AppIcon name={icon} size={28} color={colors.accentText} weight="medium" />
            </View>
            <AppText weight="700" accessibilityRole="header" style={{ fontSize: 27, letterSpacing: -0.5, lineHeight: 32, textAlign: "center" }}>
              {title}
            </AppText>
            <AppText style={{ fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: "center" }}>{body}</AppText>
          </View>

          <View style={{ gap: spacing.xs, alignItems: "stretch" }}>
            <PrimaryButton label={cta} onPress={onCta} />
            <PressableScale
              scaleTo={0.97}
              onPress={onSecondary}
              accessibilityRole="button"
              style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}
            >
              <AppText weight="600" style={{ fontSize: 15, color: colors.textSecondary }}>
                {secondary}
              </AppText>
            </PressableScale>
          </View>

          {error ? <AppText style={{ fontSize: 13, color: colors.dangerText, textAlign: "center" }}>{error}</AppText> : null}
        </Reveal>
      </View>
    </SafeAreaView>
  );
}
