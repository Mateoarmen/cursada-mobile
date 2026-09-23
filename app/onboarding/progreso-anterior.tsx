import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { catMateriasSugeridas, PERIODO_ACTUAL, type CatMateriaSugerida } from "@/lib/catalog";
import { obtenerOCrearSemestreHistorico } from "@/lib/semestres";
import { crearMateriasAprobadas, type MateriaAprobadaSel } from "@/lib/wizardReconcile";
import { escalaNotaFinal, guardarNotaFinal } from "@/lib/materias";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, LoadingScreen, PressableScale, PrimaryButton, Reveal } from "@/components/ui";
import { OnboardingPrompt } from "@/components/onboarding/OnboardingPrompt";
import type { Materia } from "@/types/database";

const SEMESTRES_RANGE = [1, 2, 3, 4, 5, 6, 7, 8];
type EstadoAnterior = "aprobada" | "recursando" | "pendiente";
const OPCIONES: { value: EstadoAnterior | "no_cursada"; label: string }[] = [
  { value: "aprobada", label: "Aprobada" },
  { value: "no_cursada", label: "No cursada" },
  { value: "recursando", label: "Recursando" },
  { value: "pendiente", label: "Debo examen" },
];

// Post-onboarding (después del wizard, y del tour cuando corresponde):
// pregunta el progreso en materias de la carrera que todavía no están
// cargadas — de todos los semestres hasta el más alto que se eligió (no sólo
// los anteriores al más bajo: con semestres 3 y 5 elegidos, el 4 también
// puede tener materias aprobadas), y dentro de los semestres elegidos las
// que no se están cursando ahora (ya cargadas por el wizard, se filtran).
// A diferencia del viejo paso "progreso" (adentro de wizard.tsx, ya
// retirado), acá hay 4 estados en vez de 2, y quien marca "aprobada" puede
// además cargar su nota final (0–100) — todo con dos gates opcionales
// encadenados, tal como se pidió.
export default function ProgresoAnteriorScreen() {
  const { colors } = useTheme();
  const status = useOnboardingStatusContext();
  const { semestres } = useLocalSearchParams<{ semestres?: string }>();
  const carreraId = status.profile?.carrera_id ?? null;

  const maximo = useMemo(() => {
    try {
      const arr = semestres ? (JSON.parse(semestres) as number[]) : [];
      return arr.length ? Math.max(...arr) : SEMESTRES_RANGE.length;
    } catch {
      return SEMESTRES_RANGE.length;
    }
  }, [semestres]);
  const semestresPrevios = useMemo(() => SEMESTRES_RANGE.filter((s) => s <= maximo), [maximo]);

  const [fase, setFase] = useState<"gate" | "cargando" | "seleccion" | "guardando" | "notas-gate" | "notas">("gate");
  const [porSemestre, setPorSemestre] = useState<Record<number, CatMateriaSugerida[]>>({});
  const [yaCargadasIds, setYaCargadasIds] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Record<string, EstadoAnterior>>({});
  const [error, setError] = useState<string | null>(null);
  const [aprobadasCreadas, setAprobadasCreadas] = useState<Materia[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  const [terminando, setTerminando] = useState(false);

  const terminar = async () => {
    setTerminando(true);
    await status.refresh();
    router.replace("/(tabs)");
  };

  const empezar = async () => {
    if (!carreraId || !semestresPrevios.length) {
      await terminar();
      return;
    }
    setFase("cargando");
    setError(null);
    try {
      const resultados = await Promise.all(semestresPrevios.map((s) => catMateriasSugeridas(carreraId, s, PERIODO_ACTUAL)));
      const { data } = await supabase.from("materias").select("catalogo_materia_id").not("catalogo_materia_id", "is", null);
      const cargadas = new Set<string>();
      (data ?? []).forEach((m) => {
        if (m.catalogo_materia_id) cargadas.add(m.catalogo_materia_id as string);
      });

      // Una materia puede venir repetida (una fila por dictado) y las ya
      // cargadas no se ofrecen: se resuelve acá para que un semestre sin
      // nada por preguntar no muestre ni el título.
      const porSem: Record<number, CatMateriaSugerida[]> = {};
      const vistas = new Set<string>();
      semestresPrevios.forEach((s, i) => {
        porSem[s] = resultados[i].filter((m) => {
          if (cargadas.has(m.materia_id) || vistas.has(m.materia_id)) return false;
          vistas.add(m.materia_id);
          return true;
        });
      });
      if (!vistas.size) {
        await terminar();
        return;
      }
      setPorSemestre(porSem);
      setYaCargadasIds(cargadas);
      setFase("seleccion");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el plan de tu carrera.");
      setFase("gate");
    }
  };

  function buscar(materiaId: string): CatMateriaSugerida | undefined {
    for (const arr of Object.values(porSemestre)) {
      const found = arr.find((m) => m.materia_id === materiaId);
      if (found) return found;
    }
    return undefined;
  }

  const confirmarSeleccion = async () => {
    setFase("guardando");
    setError(null);
    try {
      const porEstado = (estado: EstadoAnterior): MateriaAprobadaSel[] =>
        Object.entries(sel)
          .filter(([, v]) => v === estado)
          .map(([materiaId]) => {
            const f = buscar(materiaId);
            return { materiaId, nombre: f?.nombre ?? "", semestreSugerido: f?.semestre_sugerido ?? null };
          });

      const creadas = await crearMateriasAprobadas(
        porEstado("aprobada"),
        porEstado("pendiente"),
        porEstado("recursando"),
        yaCargadasIds,
        obtenerOCrearSemestreHistorico,
      );
      const aprobadas = creadas.filter((m) => m.estado === "aprobada");
      if (!aprobadas.length) {
        await terminar();
        return;
      }
      setAprobadasCreadas(aprobadas);
      setFase("notas-gate");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar tu progreso — intentá de nuevo.");
      setFase("seleccion");
    }
  };

  // Guarda de una todas las notas finales tipeadas (las vacías o inválidas
  // se saltean) al tocar "Terminar" — no en onEndEditing, que corre después
  // del tap y dejaba la última nota sin guardar si se salía enseguida.
  const guardarNotas = async () => {
    setGuardandoNotas(true);
    setError(null);
    try {
      await Promise.all(
        aprobadasCreadas.map(async (m) => {
          const raw = valores[m.id]?.trim().replace(",", ".");
          if (!raw) return;
          const valor = Number(raw);
          if (Number.isNaN(valor)) return;
          await guardarNotaFinal(m, valor);
        }),
      );
    } catch (e) {
      setGuardandoNotas(false);
      setError(e instanceof Error ? e.message : "No se pudieron guardar las notas — intentá de nuevo.");
      return;
    }
    setGuardandoNotas(false);
    await terminar();
  };

  if (terminando) return <LoadingScreen label="Preparando tu Inicio…" />;
  if (fase === "cargando") return <LoadingScreen label="Buscando el plan de tu carrera…" />;

  if (fase === "gate") {
    return (
      <OnboardingPrompt
        icon="school-outline"
        title="Sumá lo que ya cursaste"
        body="Marcá las materias de tu carrera que ya aprobaste, recursás o te falta rendir, y tu avance hacia el título arranca correcto desde hoy."
        cta="Cargar mi historial"
        onCta={empezar}
        onSecondary={terminar}
        error={error}
      />
    );
  }

  if (fase === "notas-gate") {
    const n = aprobadasCreadas.length;
    return (
      <OnboardingPrompt
        icon="create-outline"
        title="Cargá tus notas"
        body={`Marcaste ${n} ${n === 1 ? "materia aprobada" : "materias aprobadas"}. Con la nota final de cada una, tu promedio y tu avance de carrera quedan exactos.`}
        cta="Cargar notas"
        onCta={() => setFase("notas")}
        onSecondary={terminar}
        error={error}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 140 }}>
        <Reveal key={fase} style={{ gap: spacing.lg }}>
          {fase === "seleccion" || fase === "guardando" ? (
            <>
              <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.3 }}>
                Tus otras materias
              </AppText>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Tocá cada una — "No cursada" es la opción por defecto.</AppText>
              {semestresPrevios.map((s) => {
                const materias = porSemestre[s] ?? [];
                if (!materias.length) return null;
                return (
                  <View key={s} style={{ gap: spacing.sm }}>
                    <AppText weight="700" style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint }}>
                      Semestre {s}
                    </AppText>
                    {materias.map((m) => {
                      const activo = sel[m.materia_id] ?? "no_cursada";
                      return (
                        <View key={m.materia_id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
                          <AppText weight="500" style={{ fontSize: 14 }} numberOfLines={1}>
                            {m.nombre}
                          </AppText>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                            {OPCIONES.map((o) => {
                              const on = activo === o.value;
                              const tono =
                                o.value === "aprobada"
                                  ? { bg: colors.successSoft, text: colors.successText }
                                  : o.value === "recursando"
                                    ? { bg: colors.dangerSoft, text: colors.dangerText }
                                    : o.value === "pendiente"
                                      ? { bg: colors.warningSoft, text: colors.warningText }
                                      : { bg: colors.surfaceSoft, text: colors.textSecondary };
                              return (
                                <PressableScale
                                  key={o.value}
                                  scaleTo={0.97}
                                  onPress={() =>
                                    setSel((prev) => {
                                      const next = { ...prev };
                                      if (o.value === "no_cursada") delete next[m.materia_id];
                                      else next[m.materia_id] = o.value;
                                      return next;
                                    })
                                  }
                                  style={{
                                    flexGrow: 1,
                                    flexBasis: "45%",
                                    height: 34,
                                    borderRadius: radii.sm,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: on ? tono.bg : colors.surfaceSoft,
                                  }}
                                >
                                  <AppText weight="600" style={{ fontSize: 12, color: on ? tono.text : colors.textSecondary }}>
                                    {o.label}
                                  </AppText>
                                </PressableScale>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </>
          ) : null}

          {fase === "notas" ? (
            <>
              <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.3 }}>
                Cargá tus notas
              </AppText>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
                Sólo la nota final de cada materia. Podés dejar en blanco las que no recuerdes.
              </AppText>
              {aprobadasCreadas.map((m) => {
                const { max } = escalaNotaFinal(m.esc);
                return (
                  <View
                    key={m.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <AppText weight="600" style={{ fontSize: 14, flex: 1 }} numberOfLines={2}>
                      {m.nombre}
                    </AppText>
                    <TextInput
                      accessibilityLabel={`Nota final de ${m.nombre}, de 0 a ${max}`}
                      style={{
                        width: 64,
                        height: 40,
                        borderRadius: radii.sm,
                        backgroundColor: colors.surfaceSoft,
                        paddingHorizontal: spacing.sm,
                        textAlign: "center",
                        fontSize: 15,
                        color: colors.text,
                      }}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.textFaint}
                      maxLength={5}
                      value={valores[m.id] ?? ""}
                      onChangeText={(v) => setValores((prev) => ({ ...prev, [m.id]: v }))}
                    />
                    <AppText style={{ fontSize: 13, color: colors.textFaint }}>/ {max}</AppText>
                  </View>
                );
              })}
            </>
          ) : null}

          {error ? <AppText style={{ fontSize: 13, color: colors.dangerText }}>{error}</AppText> : null}
        </Reveal>
      </ScrollView>

      {fase === "seleccion" || fase === "guardando" ? (
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
          <PrimaryButton label={fase === "guardando" ? "Guardando…" : "Continuar"} onPress={confirmarSeleccion} disabled={fase !== "seleccion"} />
        </View>
      ) : null}

      {fase === "notas" ? (
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
          <PrimaryButton label={guardandoNotas ? "Guardando…" : "Terminar"} onPress={guardarNotas} disabled={guardandoNotas} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
