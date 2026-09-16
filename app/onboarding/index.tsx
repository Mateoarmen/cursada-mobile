import { useEffect } from "react";
import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, BrandMark, PrimaryButton } from "@/components/ui";

const PASOS = [
  { icon: "book-outline" as const, texto: "Cargá tus materias con horario, salón y nota de aprobación." },
  { icon: "checkmark-done-outline" as const, texto: "Agregá parciales, entregas y también tus planes personales." },
  { icon: "calendar-outline" as const, texto: "Mirá todo junto: calendario, horario y cómo vas de nota." },
];

// Puerto de mostrarOnboardingOCatalogo(): sólo ORT tiene catálogo cargado y
// sólo mientras el usuario no eligió carrera todavía — cualquier otro caso
// cae acá, al onboarding genérico (nunca un dropdown vacío).
export default function OnboardingIndex() {
  const status = useOnboardingStatusContext();

  useEffect(() => {
    if (!status.loading && status.eligibleForWizard) {
      router.replace("/onboarding/wizard");
    }
  }, [status.loading, status.eligibleForWizard]);

  if (status.loading || status.eligibleForWizard) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xxl, justifyContent: "center", gap: spacing.xxl }}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <BrandMark size={52} />
          <AppText weight="700" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: colors.accentText }}>
            Bienvenido
          </AppText>
          <AppText weight="700" style={{ fontSize: 27, letterSpacing: -0.5, textAlign: "center", lineHeight: 32 }}>
            Tu semestre entero en un solo lugar
          </AppText>
          <AppText style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: "center" }}>
            Materias, notas sobre 12, parciales, entregas y también lo tuyo: un asado, el gimnasio, el trabajo. Todo en el mismo calendario, sin planillas.
          </AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          {PASOS.map((p, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSofter, alignItems: "center", justifyContent: "center" }}>
                <AppText weight="700" style={{ fontSize: 13, color: colors.accentText }}>
                  {i + 1}
                </AppText>
              </View>
              <Ionicons name={p.icon} size={16} color={colors.textTertiary} />
              <AppText style={{ fontSize: 14, color: colors.textBody, flex: 1, lineHeight: 19 }}>{p.texto}</AppText>
            </View>
          ))}
        </View>

        <View style={{ gap: spacing.sm, alignItems: "center" }}>
          <PrimaryButton label="Crear mi primera materia" onPress={() => router.push("/(tabs)/materias")} style={{ width: "100%" }} />
          <AppText style={{ fontSize: 12, color: colors.textFaint }}>Toma 40 segundos · sin registro</AppText>
        </View>
        <AppText style={{ fontSize: 12, color: colors.textGhost, textAlign: "center" }}>Nota 0–12, puntaje o porcentaje · pensado para facultades uruguayas</AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
