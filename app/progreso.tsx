import { useMemo, useState } from "react";
import { Alert, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, estadoLabel, estadoTone, radii, spacing, tone, type EstadoMateria } from "@/theme/tokens";
import { AppText, BackButton, BottomSheet, Pill, PressableScale, PrimaryButton, ProgressRing } from "@/components/ui";
import {
  demoMaterias,
  demoProgresoAprobadasSinNota,
  demoProgresoHistorial,
  demoProgresoMeta,
  demoProgresoPendientes,
  demoProgresoSemestre,
  type DemoMateriaPendiente,
  type DemoSemestrePunto,
  type DemoTone,
} from "@/data/demoContent";

const TONE_COLOR: Record<DemoTone, string> = {
  success: colors.successText,
  warning: colors.warningText,
  danger: colors.dangerText,
  neutral: colors.textTertiary,
};

const ESTADOS_ORDEN: EstadoMateria[] = ["cursando", "aprobada", "recursando", "pendiente"];

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.sm }}>
      <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
        {children}
      </AppText>
      {hint ? (
        <AppText mono weight="600" style={{ fontSize: 13, color: colors.textTertiary }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>{children}</View>;
}

function BarraProgreso({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", borderRadius: radii.round, backgroundColor: color }} />
    </View>
  );
}

export default function ProgresoScreen() {
  const [semestreModal, setSemestreModal] = useState<DemoSemestrePunto | null>(null);
  const [notaModal, setNotaModal] = useState<DemoMateriaPendiente | null>(null);
  const [notaInput, setNotaInput] = useState("");

  const distribucion = useMemo(() => {
    const counts: Record<EstadoMateria, number> = { cursando: 0, aprobada: 0, recursando: 0, pendiente: 0 };
    demoMaterias.forEach((m) => {
      counts[m.estado] += 1;
    });
    return ESTADOS_ORDEN.map((estado) => ({ estado, count: counts[estado] })).filter((s) => s.count > 0);
  }, []);

  const totalMateriasDistribucion = distribucion.reduce((acc, s) => acc + s.count, 0);

  const semestresConPromedio = demoProgresoHistorial.filter((s) => s.promedio != null);
  const semestresSinPromedio = demoProgresoHistorial.filter((s) => s.promedio == null);

  const materiasAprobadasTotal = demoProgresoHistorial.reduce((acc, s) => acc + s.aprobadas, 0);
  const metaPct = demoProgresoMeta.materiasCarrera > 0 ? Math.round((materiasAprobadasTotal / demoProgresoMeta.materiasCarrera) * 100) : 0;

  const pendientesPorSemestre = useMemo(() => {
    const grupos = new Map<string, { semestreNombre: string; items: DemoMateriaPendiente[] }>();
    demoProgresoPendientes.forEach((p) => {
      const existente = grupos.get(p.semestreId);
      if (existente) existente.items.push(p);
      else grupos.set(p.semestreId, { semestreNombre: p.semestreNombre, items: [p] });
    });
    return Array.from(grupos.values());
  }, []);

  const bucketsEsteSemestre: { label: string; value: number }[] = [
    { label: "Encaminadas a exonerar", value: demoProgresoSemestre.buckets.exonerando },
    { label: "Aprobando", value: demoProgresoSemestre.buckets.aprobando },
    { label: "En riesgo", value: demoProgresoSemestre.buckets.enRiesgo },
  ];

  const semestreActual = demoProgresoHistorial.find((s) => s.activo) ?? null;

  const guardarNota = () => {
    if (!notaModal) return;
    const valor = notaInput.trim();
    if (!valor) {
      Alert.alert("Falta la nota", "Ingresá la nota obtenida para guardarla.");
      return;
    }
    setNotaModal(null);
    setNotaInput("");
    Alert.alert("Nota guardada", `${notaModal.nombre}: ${valor}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 16 }}>
          Progreso
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Este semestre */}
        {semestreActual ? (
          <View>
            <SectionTitle>Este semestre</SectionTitle>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
                <ProgressRing
                  progress={demoProgresoSemestre.evaluacionesCalificadas / demoProgresoSemestre.evaluacionesEsperadas}
                  size={80}
                  strokeWidth={8}
                  color={colors.accent}
                  centerValue={`${demoProgresoSemestre.evaluacionesCalificadas}/${demoProgresoSemestre.evaluacionesEsperadas}`}
                  centerLabel="notas"
                  valueFontSize={15}
                  labelFontSize={10}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText weight="700" style={{ fontSize: 26, letterSpacing: -0.4 }}>
                    {semestreActual.promedio}%
                  </AppText>
                  <AppText style={{ fontSize: 13, color: colors.textSecondary }}>promedio del semestre</AppText>
                  <AppText mono weight="600" style={{ fontSize: 12, color: TONE_COLOR[demoProgresoSemestre.deltaTone] }}>
                    {demoProgresoSemestre.deltaLabel}
                  </AppText>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
                {bucketsEsteSemestre.map((b) => (
                  <View key={b.label} style={{ alignItems: "center", gap: 2, flex: 1 }}>
                    <AppText mono weight="700" style={{ fontSize: 18 }}>
                      {b.value}
                    </AppText>
                    <AppText style={{ fontSize: 11, color: colors.textFaint, textAlign: "center" }} numberOfLines={2}>
                      {b.label}
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {/* Evolución de promedio */}
        <View>
          <SectionTitle>Evolución de promedio</SectionTitle>
          <Card>
            {semestresConPromedio.map((s) => (
              <PressableScale key={s.id} scaleTo={0.98} onPress={() => setSemestreModal(s)} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText weight="500" style={{ fontSize: 13, color: colors.textSecondary }}>
                    {s.nombre}
                    {s.activo ? " · actual" : ""}
                  </AppText>
                  <AppText mono weight="600" style={{ fontSize: 13 }}>
                    {s.promedio}%
                  </AppText>
                </View>
                <BarraProgreso pct={s.promedio ?? 0} color={colors.success} />
                <AppText style={{ fontSize: 12, color: colors.textFaint }}>
                  {s.aprobadas}/{s.total} aprobadas{s.exoneradas ? ` · ${s.exoneradas} exoneradas` : ""}
                </AppText>
              </PressableScale>
            ))}
          </Card>
        </View>

        {/* Semestres sin promedio graficable */}
        {semestresSinPromedio.length > 0 ? (
          <View>
            <SectionTitle>Semestres sin promedio</SectionTitle>
            <Card>
              {semestresSinPromedio.map((s) => (
                <PressableScale
                  key={s.id}
                  scaleTo={0.98}
                  onPress={() => setSemestreModal(s)}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <View style={{ gap: 2 }}>
                    <AppText weight="500" style={{ fontSize: 14 }}>
                      {s.nombre}
                    </AppText>
                    <AppText style={{ fontSize: 12, color: colors.textFaint }}>{s.aprobadas} aprobadas · sin nota cargada</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </PressableScale>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Materias pendientes */}
        {demoProgresoPendientes.length > 0 ? (
          <View>
            <SectionTitle hint={`${demoProgresoPendientes.length} ${demoProgresoPendientes.length === 1 ? "materia" : "materias"}`}>
              Materias pendientes
            </SectionTitle>
            <Card>
              {pendientesPorSemestre.map((grupo, gi) => (
                <View key={grupo.semestreNombre} style={{ gap: spacing.sm, paddingTop: gi === 0 ? 0 : spacing.sm, borderTopWidth: gi === 0 ? 0 : 1, borderTopColor: colors.borderSoft }}>
                  <AppText weight="600" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: colors.textFaint }}>
                    {grupo.semestreNombre}
                  </AppText>
                  {grupo.items.map((item) => (
                    <PressableScale
                      key={item.id}
                      scaleTo={0.98}
                      onPress={() => setNotaModal(item)}
                      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: item.color }} />
                      <AppText weight="500" style={{ fontSize: 14, flex: 1 }}>
                        {item.nombre}
                      </AppText>
                      <AppText style={{ fontSize: 12, color: colors.accent }}>Cargar nota ›</AppText>
                    </PressableScale>
                  ))}
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Distribución de estado */}
        <View>
          <SectionTitle>Distribución de materias</SectionTitle>
          <Card>
            <View style={{ flexDirection: "row", height: 10, borderRadius: radii.round, overflow: "hidden" }}>
              {distribucion.map((s) => (
                <View
                  key={s.estado}
                  style={{ flexGrow: s.count, backgroundColor: tone[estadoTone[s.estado]].strong }}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {distribucion.map((s) => (
                <View key={s.estado} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: tone[estadoTone[s.estado]].strong }} />
                  <AppText style={{ fontSize: 12, color: colors.textSecondary }}>
                    {estadoLabel[s.estado]} · {s.count}
                  </AppText>
                </View>
              ))}
            </View>
            <AppText style={{ fontSize: 11.5, color: colors.textFaint }}>{totalMateriasDistribucion} materias en total, todos los semestres.</AppText>
          </Card>
        </View>

        {/* Progreso hacia el título */}
        <View>
          <SectionTitle>Progreso hacia el título</SectionTitle>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText style={{ fontSize: 13, color: colors.textSecondary }}>
                {materiasAprobadasTotal} / {demoProgresoMeta.materiasCarrera} materias
              </AppText>
              <Pill label={`${metaPct}%`} color={colors.successText} background={colors.successSoft} mono />
            </View>
            <BarraProgreso pct={metaPct} color={colors.success} />
          </Card>
        </View>

        {/* Aviso materias aprobadas sin nota */}
        {demoProgresoAprobadasSinNota > 0 ? (
          <View
            style={{
              backgroundColor: colors.warningSoft,
              borderRadius: radii.md,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <Ionicons name="alert-circle-outline" size={20} color={colors.warningText} />
            <AppText style={{ fontSize: 13, color: colors.warningText, flex: 1 }}>
              Tenés {demoProgresoAprobadasSinNota} {demoProgresoAprobadasSinNota === 1 ? "materia aprobada sin nota cargada" : "materias aprobadas sin nota cargada"}.
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      {/* Modal: materias de un semestre */}
      <BottomSheet visible={semestreModal != null} onClose={() => setSemestreModal(null)}>
        {semestreModal ? (
          <>
            <View style={{ gap: 2 }}>
              <AppText weight="700" style={{ fontSize: 18 }}>
                {semestreModal.nombre}
              </AppText>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
                {semestreModal.aprobadas}/{semestreModal.total} aprobadas
                {semestreModal.exoneradas ? ` · ${semestreModal.exoneradas} exoneradas` : ""}
              </AppText>
            </View>
            <View style={{ gap: spacing.sm, maxHeight: 380 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {semestreModal.materias.map((m, i) => (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingVertical: spacing.sm,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderSoft,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: m.color }} />
                    <AppText style={{ fontSize: 14, flex: 1 }}>{m.nombre}</AppText>
                    <AppText mono weight="600" style={{ fontSize: 13, color: TONE_COLOR[m.tone] }}>
                      {m.notaTxt}/{m.aprob}
                    </AppText>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        ) : null}
      </BottomSheet>

      {/* Modal: cargar nota rápido (materia pendiente) */}
      <BottomSheet
        visible={notaModal != null}
        onClose={() => {
          setNotaModal(null);
          setNotaInput("");
        }}
      >
        {notaModal ? (
          <>
            <View style={{ gap: 2 }}>
              <AppText weight="700" style={{ fontSize: 18 }}>
                Cargar nota
              </AppText>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
                {notaModal.nombre} · aprobás con {notaModal.aprob}
              </AppText>
            </View>
            <TextInput
              value={notaInput}
              onChangeText={setNotaInput}
              placeholder="Nota obtenida"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              autoFocus
              style={{
                height: 48,
                borderRadius: radii.sm,
                backgroundColor: colors.surface,
                paddingHorizontal: spacing.lg,
                fontSize: 15,
                color: colors.text,
              }}
            />
            <PrimaryButton label="Guardar" onPress={guardarNota} />
          </>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
