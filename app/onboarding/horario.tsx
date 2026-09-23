import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { DIAS_BLOQUE, horaTexto, PERIODO_ACTUAL } from "@/lib/catalog";
import { obtenerOCrearSemestrePeriodo } from "@/lib/semestres";
import { guardarBloques, type MateriaBloqueInput } from "@/lib/materias";
import { FranjaSheet } from "@/components/materia/FranjaSheet";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, LoadingScreen, PressableScale, PrimaryButton, Reveal } from "@/components/ui";
import { OnboardingPrompt } from "@/components/onboarding/OnboardingPrompt";
import type { Materia } from "@/types/database";

function franjaLabel(b: MateriaBloqueInput): string {
  return `${DIAS_BLOQUE[b.dia - 1] ?? "?"} · ${horaTexto(b.ini)}–${horaTexto(b.fin)}`;
}

// Post-confirmación del wizard, sólo rama simple (carreras sin dictado en
// catálogo, ver app/onboarding/wizard.tsx): aplicar_plan() crea las
// materias elegidas con bloques:[] porque el catálogo no traía horario.
// Antes el wizard sólo avisaba "completá el horario vos después" — ahora
// se lo ofrece ahí mismo, materia por materia, con el mismo FranjaSheet que
// ya usa la edición de materia. Si no hay ninguna materia sin horario
// (activarSemestre con puro catálogo con dictado, o carrera vacía) se
// saltea directo al siguiente paso.
export default function OnboardingHorarioScreen() {
  const { colors } = useTheme();
  const { semestres } = useLocalSearchParams<{ semestres?: string }>();
  const siguiente = { pathname: "/onboarding/progreso-anterior" as const, params: { semestres: semestres ?? "[]" } };
  const [materias, setMaterias] = useState<Materia[] | null>(null);
  const [quiereCargar, setQuiereCargar] = useState(false);
  const [sheetPara, setSheetPara] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const semestreId = await obtenerOCrearSemestrePeriodo(PERIODO_ACTUAL);
        const { data, error: selErr } = await supabase.from("materias").select("*").eq("semestre_id", semestreId);
        if (selErr) throw selErr;
        const sinHorario = ((data as Materia[]) ?? []).filter((m) => !m.bloques?.length);
        if (!sinHorario.length) {
          router.replace(siguiente);
          return;
        }
        setMaterias(sinHorario);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar tus materias.");
        setMaterias([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agregarFranja = async (materiaId: string, b: MateriaBloqueInput) => {
    const materia = materias?.find((m) => m.id === materiaId);
    if (!materia) return;
    const nuevos = [...materia.bloques, b];
    try {
      const actualizada = await guardarBloques(materiaId, nuevos);
      setMaterias((prev) => (prev ? prev.map((m) => (m.id === materiaId ? actualizada : m)) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la franja.");
    }
  };

  const quitarFranja = async (materiaId: string, i: number) => {
    const materia = materias?.find((m) => m.id === materiaId);
    if (!materia) return;
    const nuevos = materia.bloques.filter((_, idx) => idx !== i);
    try {
      const actualizada = await guardarBloques(materiaId, nuevos);
      setMaterias((prev) => (prev ? prev.map((m) => (m.id === materiaId ? actualizada : m)) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo quitar la franja.");
    }
  };

  const continuar = () => router.replace(siguiente);

  if (materias === null) return <LoadingScreen label="Cargando tus materias…" />;

  if (!quiereCargar) {
    const cuantas = materias.length === 1 ? "tu materia" : `tus ${materias.length} materias`;
    return (
      <OnboardingPrompt
        icon="time-outline"
        title="Armá tu horario"
        body={`Tu carrera todavía no tiene horarios en el catálogo. Sumá los días y horas de ${cuantas} y tu semana queda lista desde el primer día.`}
        cta="Cargar horarios"
        onCta={() => setQuiereCargar(true)}
        onSecondary={continuar}
        error={error}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 140 }}>
        <Reveal style={{ gap: spacing.lg }}>
          <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.3 }}>
            Tus horarios
          </AppText>
          <AppText style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Tocá "Agregar franja" en cada materia. Las que dejes vacías las completás después desde Materias.
          </AppText>

          <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>
            {materias.map((m) => (
              <View key={m.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg, gap: spacing.sm }}>
                <AppText weight="600" style={{ fontSize: 15 }}>
                  {m.nombre}
                </AppText>
                {m.bloques.map((b, i) => (
                  <View
                    key={`${b.dia}-${b.ini}-${b.fin}-${i}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      height: 40,
                      borderRadius: radii.sm,
                      backgroundColor: colors.surfaceSoft,
                      paddingHorizontal: spacing.md,
                    }}
                  >
                    <AppText mono weight="600" style={{ fontSize: 13 }}>
                      {franjaLabel(b)}
                    </AppText>
                    <PressableScale scaleTo={0.9} onPress={() => quitarFranja(m.id, i)}>
                      <AppText style={{ fontSize: 13, color: colors.dangerText }}>Quitar</AppText>
                    </PressableScale>
                  </View>
                ))}
                <PressableScale scaleTo={0.98} onPress={() => setSheetPara(m.id)}>
                  <View
                    style={{
                      height: 40,
                      borderRadius: radii.sm,
                      borderWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText weight="600" style={{ fontSize: 13, color: colors.accentText }}>
                      + Agregar franja
                    </AppText>
                  </View>
                </PressableScale>
              </View>
            ))}
          </View>

          {error ? <AppText style={{ fontSize: 13, color: colors.dangerText }}>{error}</AppText> : null}
        </Reveal>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.borderFaint,
        }}
      >
        <PrimaryButton label="Continuar" onPress={continuar} />
      </View>

      <FranjaSheet visible={!!sheetPara} onClose={() => setSheetPara(null)} onAgregar={(b) => sheetPara && agregarFranja(sheetPara, b)} />
    </SafeAreaView>
  );
}
