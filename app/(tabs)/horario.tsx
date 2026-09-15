import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, PressableScale } from "@/components/ui";
import { demoHorarioPorDia, demoHorarioSemana } from "@/data/demoContent";

export default function HorarioScreen() {
  const [diaSeleccionado, setDiaSeleccionado] = useState(2); // martes, como en el diseño

  const bloques = demoHorarioPorDia[diaSeleccionado] ?? [];
  const resumen = useMemo(() => {
    if (bloques.length === 0) return "Sin clases este día";
    const horas = bloques.reduce((acc, b) => {
      const [h1] = b.horaInicio.split(":").map(Number);
      const [h2] = b.horaFin.split(":").map(Number);
      return acc + (h2 - h1);
    }, 0);
    return `${bloques.length} ${bloques.length === 1 ? "clase" : "clases"} · ${horas} h · primera ${bloques[0].horaInicio}`;
  }, [bloques]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6 }}>
            Horario
          </AppText>
          <AppText style={{ fontSize: 12, color: colors.textTertiary }}>2026 · 2.º semestre</AppText>
        </View>

        <View style={{ flexDirection: "row", gap: 7 }}>
          {demoHorarioSemana.map((d) => {
            const active = d.dia === diaSeleccionado;
            return (
              <PressableScale
                key={d.key}
                scaleTo={0.95}
                onPress={() => setDiaSeleccionado(d.dia)}
                style={{
                  flex: 1,
                  height: 58,
                  borderRadius: 14,
                  backgroundColor: active ? colors.accent : colors.surfaceSofter,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <AppText
                  weight="600"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    color: active ? "rgba(255,255,255,0.75)" : colors.textTertiary,
                  }}
                >
                  {d.label}
                </AppText>
                <AppText weight={active ? "700" : "600"} style={{ fontSize: 16, color: active ? colors.white : colors.text }}>
                  {d.dia}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
        <AppText style={{ fontSize: 14, color: colors.textSecondary }}>{resumen}</AppText>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {bloques.length === 0 ? (
          <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
            No hay clases cargadas para este día.
          </AppText>
        ) : (
          bloques.map((b, i) => (
            <View key={b.id} style={{ flexDirection: "row", gap: spacing.lg, paddingTop: i === 0 ? spacing.sm : spacing.md + 2 }}>
              <AppText mono style={{ width: 44, fontSize: 12, color: colors.textGhost }}>
                {b.horaInicio}
              </AppText>
              <View
                style={{
                  flex: 1,
                  backgroundColor: b.accentSoft,
                  borderLeftWidth: 3,
                  borderLeftColor: b.accentColor,
                  borderRadius: 0,
                  borderTopRightRadius: radii.md,
                  borderBottomRightRadius: radii.md,
                  padding: spacing.lg,
                  gap: 5,
                  minHeight: 110,
                }}
              >
                <AppText weight="600" style={{ fontSize: 16, letterSpacing: -0.1 }}>
                  {b.materiaNombre}
                </AppText>
                <AppText mono style={{ fontSize: 13, color: colors.textSecondary }}>
                  {b.horaInicio}–{b.horaFin}
                </AppText>
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{b.ubicacion}</AppText>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
