import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@/hooks/useSession";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, Avatar, Pill, PressableScale, PrimaryButton } from "@/components/ui";
import { demoHome } from "@/data/demoContent";

const hoy = new Date();
const fechaLabel = hoy
  .toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" })
  .replace(/^\w/, (c) => c.toUpperCase());

export default function InicioScreen() {
  const { session } = useSession();
  const email = session?.user?.email ?? "";
  const nombre = email ? email.split("@")[0] : "";
  const initial = email ? email[0]!.toUpperCase() : "?";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: 120, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ gap: 3, flexShrink: 1 }}>
            <AppText weight="600" style={{ fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint }}>
              {fechaLabel}
            </AppText>
            <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6, lineHeight: 32 }}>
              Hola{nombre ? `, ${nombre}` : ""}
            </AppText>
          </View>
          <PressableScale scaleTo={0.94} onPress={() => router.push("/perfil")}>
            <Avatar initial={initial} />
          </PressableScale>
        </View>

        {/* Lo próximo */}
        <LinearGradient
          colors={[colors.accent, "rgba(44,123,255,0.15)", "rgba(255,255,255,0.06)"]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ borderRadius: radii.xxl, padding: 1.5 }}
        >
          <View style={{ borderRadius: radii.xxl - 1.5, backgroundColor: colors.surfaceRaised, padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText weight="700" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.accentText }}>
                Lo próximo
              </AppText>
              <Pill label={demoHome.proximo.diasLabel} color={colors.warningText} background={colors.warningSoft} mono />
            </View>
            <View style={{ gap: spacing.xs }}>
              <AppText weight="700" style={{ fontSize: 23, letterSpacing: -0.4, lineHeight: 26 }}>
                {demoHome.proximo.titulo}
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary }}>{demoHome.proximo.detalle}</AppText>
            </View>
            <View style={{ gap: spacing.sm }}>
              <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
                <View
                  style={{
                    width: `${demoHome.proximo.progreso * 100}%`,
                    height: "100%",
                    borderRadius: radii.round,
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{demoHome.proximo.progresoLabel}</AppText>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <PrimaryButton label="Abrir materia" flex style={{ height: 40 }} />
              <PrimaryButton label="Posponer" variant="ghost" style={{ height: 40, paddingHorizontal: spacing.lg }} />
            </View>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: spacing.smd }}>
          <StatCard value={demoHome.stats.promedioGeneral.toFixed(1)} label={"Promedio\ngeneral"} />
          <StatCard value={String(demoHome.stats.pendientesSemana)} label={"Pendientes\nesta semana"} color={colors.warningText} />
          <StatCard value={String(demoHome.stats.materiasCursando)} label={"Materias\ncursando"} />
        </View>

        {/* Próximos 7 días */}
        <View>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.sm }}>
            <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
              Próximos 7 días
            </AppText>
            <PressableRow onPress={() => router.push("/(tabs)/agenda")} />
          </View>
          {demoHome.proximosDias.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.borderSoft,
              }}
            >
              <View style={{ width: 3, height: 30, borderRadius: radii.round, backgroundColor: item.color }} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText weight="500" style={{ fontSize: 15 }}>
                  {item.titulo}
                </AppText>
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{item.detalle}</AppText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PressableRow({ onPress }: { onPress: () => void }) {
  return (
    <AppText weight="500" style={{ fontSize: 14, color: colors.accent }} onPress={onPress}>
      Ver agenda
    </AppText>
  );
}

function StatCard({ value, label, color = colors.text }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs }}>
      <AppText mono weight="600" style={{ fontSize: 25, letterSpacing: -0.5, lineHeight: 26, color }}>
        {value}
      </AppText>
      <AppText style={{ fontSize: 12, lineHeight: 15, color: colors.textTertiary }}>{label}</AppText>
    </View>
  );
}
