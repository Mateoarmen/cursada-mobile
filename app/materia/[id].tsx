import { useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, BackButton, Pill, ProgressRing } from "@/components/ui";
import { demoMaterias } from "@/data/demoContent";

export default function MateriaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const materia = demoMaterias.find((m) => m.id === id) ?? demoMaterias[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.sm,
            backgroundColor: materia.color,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppText weight="600" style={{ fontSize: 11, color: colors.white }}>
            {materia.codigo.split("-")[0] || materia.nombre.slice(0, 3).toUpperCase()}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="600" style={{ fontSize: 16, letterSpacing: -0.1 }} numberOfLines={1}>
            {materia.nombre}
          </AppText>
          <AppText style={{ fontSize: 12, color: colors.textTertiary }}>
            {materia.codigo} · {materia.creditos} créditos
          </AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.xxl, padding: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          <ProgressRing
            size={100}
            strokeWidth={9}
            progress={materia.progreso}
            color={materia.color}
            centerValue={materia.promedio.toFixed(1)}
            centerLabel="de 12"
            valueFontSize={27}
            labelFontSize={12}
          />
          <View style={{ flex: 1, gap: spacing.sm - 1 }}>
            <Pill label="Vas aprobando" color={colors.successText} background={colors.successSoft} />
            <AppText style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
              Con <AppText weight="700" style={{ fontSize: 14, color: colors.text }}>6.2</AppText> en el Parcial 2 exonerás.
            </AppText>
          </View>
        </View>

        <View>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.sm - 2 }}>
            <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
              Evaluaciones
            </AppText>
            <AppText weight="500" style={{ fontSize: 13, color: colors.accent }}>
              + Nueva
            </AppText>
          </View>
          {materia.evaluaciones.map((ev) => (
            <View
              key={ev.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.borderSoft,
              }}
            >
              {ev.estado === "aprobada" ? (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: colors.success,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppText weight="700" style={{ fontSize: 12, color: colors.bg }}>
                    ✓
                  </AppText>
                </View>
              ) : (
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.accent }} />
              )}

              {ev.estado === "aprobada" ? (
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText weight="500" style={{ fontSize: 15 }}>
                    {ev.nombre}
                  </AppText>
                  <View style={{ height: 5, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
                    <View
                      style={{
                        width: `${((ev.nota ?? 0) / ev.notaMax) * 100}%`,
                        height: "100%",
                        borderRadius: radii.round,
                        backgroundColor: colors.success,
                      }}
                    />
                  </View>
                </View>
              ) : (
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText weight="500" style={{ fontSize: 15 }}>
                    {ev.nombre}
                  </AppText>
                  {ev.fechaLabel ? (
                    <AppText style={{ fontSize: 12, color: colors.accentText }}>{ev.fechaLabel}</AppText>
                  ) : null}
                </View>
              )}

              {ev.estado === "aprobada" ? (
                <AppText mono weight="600" style={{ fontSize: 16 }}>
                  {ev.nota}
                  <AppText style={{ fontSize: 13, color: colors.textTertiary }}>/{ev.notaMax}</AppText>
                </AppText>
              ) : (
                <Pill label="Cargar nota" color={colors.accentText} background={colors.accentSoft} />
              )}
            </View>
          ))}
        </View>

        <View style={{ gap: spacing.smd }}>
          <AppText weight="700" style={{ fontSize: 12, letterSpacing: 0.7, textTransform: "uppercase", color: colors.textFaint }}>
            Cursado
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            <Pill label={materia.horarioResumen} background={colors.surfaceSoft} />
            <Pill label={materia.ubicacionResumen} background={colors.surfaceSoft} color={colors.textSecondary} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
