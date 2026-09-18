import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { setSemestreActivo } from "@/lib/semestres";
import type { Semestre } from "@/types/database";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppIcon, AppText, BackButton, PressableScale, Reveal, Spotlight } from "@/components/ui";

// Los semestres históricos (creados por el paso "progreso anterior" del
// wizard de onboarding, ver src/lib/wizardReconcile.ts) nunca aparecen acá
// ni se pueden activar — mismo criterio que semestresPropiosOrdenados() en
// runtime.js.
export default function SemestreActivoScreen() {
  const [semestres, setSemestres] = useState<Semestre[] | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const cargar = () => {
    supabase
      .from("semestres")
      .select("*")
      .eq("historico", false)
      .order("orden", { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) {
          setFetchError(true);
          return;
        }
        setFetchError(false);
        setSemestres((data as Semestre[]) ?? []);
      });
  };

  useEffect(() => {
    cargar();
  }, []);

  const activarSemestre = async (id: string) => {
    const anterior = semestres;
    setSemestres((prev) => (prev ?? []).map((s) => ({ ...s, activo: s.id === id })));
    try {
      await setSemestreActivo(id);
    } catch (e) {
      setSemestres(anterior);
      console.warn("Cursada: no se pudo activar el semestre", e);
    }
  };

  const dataReady = semestres !== null;
  const showError = !dataReady && fetchError;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={240} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
          Semestre activo
        </AppText>
      </View>

      {showError ? (
        <View
          accessible
          accessibilityLabel="No pudimos cargar tus semestres. Revisá tu conexión y volvé a esta pantalla para reintentar."
          style={{
            marginHorizontal: spacing.xl,
            marginBottom: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            backgroundColor: colors.dangerSofter,
            borderRadius: radii.md,
            padding: spacing.lg,
          }}
        >
          <AppIcon name="alert-circle-outline" size={18} color={colors.dangerText} />
          <AppText style={{ flex: 1, fontSize: 13, color: colors.dangerText }}>
            No pudimos cargar tus semestres. Revisá tu conexión y volvé a esta pantalla para reintentar.
          </AppText>
        </View>
      ) : null}

      {!dataReady ? (
        <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>Cargando…</AppText>
      ) : (
        <Reveal style={{ flex: 1 }}>
          <FlatList
            data={semestres}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.smd }}
            renderItem={({ item }) => (
              <PressableScale
                scaleTo={0.98}
                onPress={() => activarSemestre(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: item.activo }}
                accessibilityLabel={`${item.nombre}${item.activo ? ", activo" : ""}`}
                style={{
                  backgroundColor: item.activo ? colors.accentSoft : colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.md,
                }}
              >
                <AppText weight="600" style={{ fontSize: 16, color: item.activo ? colors.accentText : colors.text }}>
                  {item.nombre}
                </AppText>
                {item.activo ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppIcon name="checkmark-circle-outline" size={16} color={colors.accentText} />
                    <AppText weight="500" style={{ fontSize: 13, color: colors.accentText }}>
                      Activo
                    </AppText>
                  </View>
                ) : null}
              </PressableScale>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.xxxl }}>
                <View style={{ width: 48, height: 48, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                  <AppIcon name="calendar-outline" size={22} color={colors.textFaint} />
                </View>
                <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center" }}>No hay semestres cargados todavía.</AppText>
              </View>
            }
          />
        </Reveal>
      )}
    </SafeAreaView>
  );
}
