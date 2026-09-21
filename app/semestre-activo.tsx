import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { obtenerOCrearSemestrePeriodo, setSemestreActivo } from "@/lib/semestres";
import { PERIODO_ACTUAL } from "@/lib/catalog";
import type { Semestre } from "@/types/database";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BackButton, BottomSheet, PickerField, PressableScale, PrimaryButton, Reveal, Spotlight } from "@/components/ui";

const [PERIODO_ANIO_ACTUAL, PERIODO_MITAD_ACTUAL] = PERIODO_ACTUAL.split("-");
const ANIO_OPTS = Array.from({ length: 6 }, (_, i) => {
  const y = Number(PERIODO_ANIO_ACTUAL ?? new Date().getFullYear()) - 2 + i;
  return { value: String(y), label: String(y) };
});
const MITAD_OPTS = [
  { value: "1", label: "Primer semestre" },
  { value: "2", label: "Segundo semestre" },
];

// Los semestres históricos (creados por el paso "progreso anterior" del
// wizard de onboarding, ver src/lib/wizardReconcile.ts) nunca aparecen acá
// ni se pueden activar — mismo criterio que semestresPropiosOrdenados() en
// runtime.js.
export default function SemestreActivoScreen() {
  const { colors } = useTheme();
  const [semestres, setSemestres] = useState<Semestre[] | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoAnio, setNuevoAnio] = useState(PERIODO_ANIO_ACTUAL ?? String(new Date().getFullYear()));
  const [nuevoMitad, setNuevoMitad] = useState(PERIODO_MITAD_ACTUAL ?? "1");
  const [creando, setCreando] = useState(false);

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

  const confirmarNuevoSemestre = async () => {
    const periodo = `${nuevoAnio}-${nuevoMitad}`;
    if (semestres?.some((s) => s.periodo === periodo)) {
      Alert.alert("Ese semestre ya existe", "Elegí otro año o mitad, o activalo desde la lista.");
      return;
    }
    setCreando(true);
    try {
      await obtenerOCrearSemestrePeriodo(periodo);
      setNuevoAbierto(false);
      cargar();
    } catch (e) {
      Alert.alert("No se pudo crear el semestre", "Revisá tu conexión e intentá de nuevo.");
      console.warn("Cursada: no se pudo crear el semestre", e);
    } finally {
      setCreando(false);
    }
  };

  const dataReady = semestres !== null;
  const activo = semestres?.find((s) => s.activo) ?? null;
  const otros = (semestres ?? []).filter((s) => !s.activo);
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
        showError ? null : <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>Cargando…</AppText>
      ) : (
        <Reveal style={{ flex: 1 }}>
          <FlatList
            data={otros}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl, gap: spacing.smd }}
            ListHeaderComponent={
              <View style={{ gap: spacing.xxl, paddingBottom: spacing.md }}>
                {activo ? (
                  <View
                    accessible
                    accessibilityLabel={`${activo.nombre}, semestre activo`}
                    style={{ backgroundColor: colors.accentSoft, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.md }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                      <AppIcon name="checkmark-circle-outline" size={16} color={colors.accentText} />
                      <AppText weight="600" style={{ fontSize: 14, color: colors.accentText }}>
                        Activo
                      </AppText>
                    </View>
                    <AppText weight="700" style={{ fontSize: 32, lineHeight: 36, letterSpacing: -0.8 }}>
                      {activo.nombre}
                    </AppText>
                  </View>
                ) : null}
                {otros.length > 0 ? (
                  <AppText weight="700" style={{ fontSize: 20, letterSpacing: -0.4 }}>
                    {activo ? "Otros semestres" : "Semestres"}
                  </AppText>
                ) : null}
              </View>
            }
            renderItem={({ item }) => (
              <PressableScale
                scaleTo={0.98}
                onPress={() => activarSemestre(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: false }}
                accessibilityLabel={`${item.nombre}, activar`}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  paddingHorizontal: spacing.lg,
                  minHeight: 60,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.md,
                }}
              >
                <AppText weight="600" style={{ fontSize: 16 }}>
                  {item.nombre}
                </AppText>
                <AppText weight="500" style={{ fontSize: 14, color: colors.accentText }}>
                  Activar
                </AppText>
              </PressableScale>
            )}
            ListEmptyComponent={
              !semestres?.length ? (
                <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.xl }}>
                  <View style={{ width: 48, height: 48, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                    <AppIcon name="calendar-outline" size={22} color={colors.textFaint} />
                  </View>
                  <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center" }}>No hay semestres cargados todavía.</AppText>
                </View>
              ) : null
            }
            ListFooterComponent={
              <View style={{ gap: spacing.smd, paddingTop: spacing.xxl }}>
                <PrimaryButton label="Nuevo semestre" onPress={() => setNuevoAbierto(true)} />
                <PressableScale
                  scaleTo={0.98}
                  onPress={() => router.push("/semestre-historial")}
                  accessibilityRole="button"
                  style={{ minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <AppIcon name="time-outline" size={18} color={colors.textSecondary} />
                    <AppText weight="500" style={{ fontSize: 16 }}>
                      Historial
                    </AppText>
                  </View>
                  <AppIcon name="chevron-forward" size={14} color={colors.textGhost} />
                </PressableScale>
              </View>
            }
          />
        </Reveal>
      )}

      <BottomSheet visible={nuevoAbierto} onClose={() => setNuevoAbierto(false)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Nuevo semestre
        </AppText>
        <AppText style={{ fontSize: 13, color: colors.textTertiary, lineHeight: 18 }}>
          El semestre activo actual queda cerrado y disponible en el historial.
        </AppText>
        <View style={{ flexDirection: "row", gap: spacing.smd }}>
          <PickerField label="Año" value={nuevoAnio} placeholder="Año" options={ANIO_OPTS} onSelect={setNuevoAnio} compact />
          <PickerField label="Mitad" value={nuevoMitad} placeholder="Mitad" options={MITAD_OPTS} onSelect={setNuevoMitad} compact />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setNuevoAbierto(false)} />
          <PrimaryButton label={creando ? "Creando…" : "Crear y activar"} flex disabled={creando} onPress={confirmarNuevoSemestre} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
