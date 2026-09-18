import { useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Semestre } from "@/types/database";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BackButton, PressableScale, Reveal, Spotlight } from "@/components/ui";

// Semestres propios (no sintéticos, ver obtenerOCrearSemestreHistorico) que
// ya no están activos — el semestre activo se ve/edita desde
// /semestre-activo, acá sólo lo cerrado. Mismo filtro `historico=false`
// que esa pantalla, más `activo=false`.
export default function SemestreHistorialScreen() {
  const { colors } = useTheme();
  const [semestres, setSemestres] = useState<Semestre[] | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    supabase
      .from("semestres")
      .select("*")
      .eq("historico", false)
      .eq("activo", false)
      .order("orden", { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) {
          setFetchError(true);
          return;
        }
        setSemestres((data as Semestre[]) ?? []);
      });
  }, []);

  const dataReady = semestres !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={240} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
          Historial de semestres
        </AppText>
      </View>

      {!dataReady ? (
        <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
          {fetchError ? "No pudimos cargar tu historial. Volvé a intentar." : "Cargando…"}
        </AppText>
      ) : (
        <Reveal style={{ flex: 1 }}>
          <FlatList
            data={semestres}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.smd }}
            renderItem={({ item }) => (
              <PressableScale
                scaleTo={0.98}
                onPress={() => router.push(`/semestre-historial/${item.id}`)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.md,
                }}
              >
                <AppText weight="600" style={{ fontSize: 16, color: colors.text }}>
                  {item.nombre}
                </AppText>
                <AppIcon name="chevron-forward" size={16} color={colors.textFaint} />
              </PressableScale>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.xxxl }}>
                <View style={{ width: 48, height: 48, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                  <AppIcon name="time-outline" size={22} color={colors.textFaint} />
                </View>
                <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center" }}>
                  Todavía no cerraste ningún semestre.
                </AppText>
              </View>
            }
          />
        </Reveal>
      )}
    </SafeAreaView>
  );
}
