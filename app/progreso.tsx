import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, estadoLabel, estadoTone, materiaColors, radii, spacing, tone, type EstadoMateria, type MateriaColorId, type Tone } from "@/theme/tokens";
import { AppIcon, AppText, BackButton, BottomSheet, Pill, PressableScale, PrimaryButton, ProgressRing } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { today } from "@/lib/agenda";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { useAgenda } from "@/hooks/useAgenda";
import { semestresOrdenados } from "@/lib/semestres";
import {
  computeMaterias,
  computeProgresoPorSemestre,
  computeProgresoSemestreActivo,
  formatValor,
  materiasAprobadasCount,
  materiasAprobadasSinNota,
  resolverPendienteSiCorresponde,
  type MateriaComputada,
  type ProgresoSemestrePunto,
} from "@/lib/materias";
import type { Materia, Semestre } from "@/types/database";

const TONE_COLOR: Record<Tone, string> = {
  success: colors.successText,
  warning: colors.warningText,
  danger: colors.dangerText,
  neutral: colors.textTertiary,
};

const ESTADOS_ORDEN: EstadoMateria[] = ["cursando", "aprobada", "recursando", "pendiente"];

function colorDeMateria(raw: Materia): string {
  const colorId = (raw.color_id && raw.color_id in materiaColors ? raw.color_id : "gris") as MateriaColorId;
  return materiaColors[colorId].strong;
}

type SemestreMateriaFila = { id: string; nombre: string; color: string; notaTxt: string; aprobTxt: string; tone: Tone };

type SemestreModalData = {
  id: string;
  nombre: string;
  activo: boolean;
  aprobadas: number;
  exoneradas: number;
  total: number;
  materias: SemestreMateriaFila[];
};

type NotaModalData = { materiaId: string; materiaRaw: Materia; nombre: string; total: number; aprobTxt: string };

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
  const { profile } = useOnboardingStatusContext();
  const agenda = useAgenda();

  const [materiasAll, setMateriasAll] = useState<Materia[] | null>(null);
  const [semestresAll, setSemestresAll] = useState<Semestre[] | null>(null);

  const [semestreModal, setSemestreModal] = useState<SemestreModalData | null>(null);
  const [notaModal, setNotaModal] = useState<NotaModalData | null>(null);
  const [notaInput, setNotaInput] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);

  const fetchMaterias = useCallback(async () => {
    const [{ data: materias }, sems] = await Promise.all([supabase.from("materias").select("*"), semestresOrdenados()]);
    setMateriasAll(materias ?? []);
    setSemestresAll(sems);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      (async () => {
        const [{ data: materias }, sems] = await Promise.all([supabase.from("materias").select("*"), semestresOrdenados()]);
        if (cancelado) return;
        setMateriasAll(materias ?? []);
        setSemestresAll(sems);
      })();
      return () => {
        cancelado = true;
      };
    }, [])
  );

  const activeId = useMemo(() => semestresAll?.find((s) => s.activo)?.id ?? null, [semestresAll]);

  const materiasComputadas = useMemo(
    () => (materiasAll && agenda.rows ? computeMaterias(materiasAll, agenda.rows) : null),
    [materiasAll, agenda.rows]
  );

  const progresoActivo = useMemo(
    () => (materiasAll && agenda.rows && semestresAll ? computeProgresoSemestreActivo(materiasAll, agenda.rows, semestresAll, activeId) : null),
    [materiasAll, agenda.rows, semestresAll, activeId]
  );

  const bucketsEsteSemestre = useMemo(() => {
    if (!progresoActivo) return null;
    let exonerando = 0;
    let aprobando = 0;
    let enRiesgo = 0;
    progresoActivo.materias.forEach((m) => {
      if (m.actual == null) return;
      if (m.esc.exoneracion != null && m.actual >= m.esc.exoneracion) exonerando += 1;
      else if (m.actual >= m.esc.aprob) aprobando += 1;
      else enRiesgo += 1;
    });
    return [
      { label: "Encaminadas a exonerar", value: exonerando },
      { label: "Aprobando", value: aprobando },
      { label: "En riesgo", value: enRiesgo },
    ];
  }, [progresoActivo]);

  const progresoPorSemestre: ProgresoSemestrePunto[] = useMemo(
    () => (materiasAll && agenda.rows && semestresAll ? computeProgresoPorSemestre(semestresAll, materiasAll, agenda.rows) : []),
    [materiasAll, agenda.rows, semestresAll]
  );
  const semestresConPromedio = progresoPorSemestre.filter((p) => p.promedio != null);
  const semestresSinPromedio = progresoPorSemestre.filter((p) => p.promedio == null);

  const distribucion = useMemo(() => {
    if (!materiasComputadas) return [];
    const counts: Record<EstadoMateria, number> = { cursando: 0, aprobada: 0, recursando: 0, pendiente: 0 };
    materiasComputadas.forEach((m) => {
      counts[m.raw.estado] += 1;
    });
    return ESTADOS_ORDEN.map((estado) => ({ estado, count: counts[estado] })).filter((s) => s.count > 0);
  }, [materiasComputadas]);
  const totalMateriasDistribucion = distribucion.reduce((acc, s) => acc + s.count, 0);

  const materiasAprobadasTotal = materiasAll ? materiasAprobadasCount(materiasAll) : 0;
  const metaCarrera = profile?.materias_carrera ?? null;
  const metaPct = metaCarrera && metaCarrera > 0 ? Math.round((materiasAprobadasTotal / metaCarrera) * 100) : 0;

  const aprobadasSinNota = useMemo(
    () => (materiasAll && agenda.rows ? materiasAprobadasSinNota(materiasAll, agenda.rows) : []),
    [materiasAll, agenda.rows]
  );

  const pendientesPorSemestre = useMemo(() => {
    if (!materiasComputadas || !semestresAll) return [];
    const pendientes = materiasComputadas.filter((m) => m.raw.estado === "pendiente");
    const grupos = new Map<string, MateriaComputada[]>();
    const sinSemestre: MateriaComputada[] = [];
    pendientes.forEach((m) => {
      if (!m.raw.semestre_id) {
        sinSemestre.push(m);
        return;
      }
      const existente = grupos.get(m.raw.semestre_id);
      if (existente) existente.push(m);
      else grupos.set(m.raw.semestre_id, [m]);
    });
    const ordenados = semestresAll
      .filter((s) => grupos.has(s.id))
      .map((s) => ({ semestreId: s.id, semestreNombre: s.nombre, items: grupos.get(s.id)! }));
    if (sinSemestre.length) ordenados.push({ semestreId: "sin-semestre", semestreNombre: "Sin semestre", items: sinSemestre });
    return ordenados;
  }, [materiasComputadas, semestresAll]);
  const totalPendientes = pendientesPorSemestre.reduce((acc, g) => acc + g.items.length, 0);

  const abrirSemestreModal = (punto: ProgresoSemestrePunto) => {
    if (!materiasAll || !agenda.rows) return;
    const materias = computeMaterias(materiasAll, agenda.rows, punto.semestre.id)
      .slice()
      .sort((a, b) => a.raw.nombre.localeCompare(b.raw.nombre));
    setSemestreModal({
      id: punto.semestre.id,
      nombre: punto.semestre.nombre,
      activo: punto.semestre.activo,
      aprobadas: punto.aprobadas,
      exoneradas: punto.exoneradas,
      total: punto.total,
      materias: materias.map((m) => ({
        id: m.raw.id,
        nombre: m.raw.nombre,
        color: colorDeMateria(m.raw),
        notaTxt: m.actual != null ? formatValor(m.actual, m.esc.tipo) : "—",
        aprobTxt: formatValor(m.esc.aprob, m.esc.tipo),
        tone: m.tone,
      })),
    });
  };

  const abrirNotaModal = (m: MateriaComputada) => {
    setNotaModal({ materiaId: m.raw.id, materiaRaw: m.raw, nombre: m.raw.nombre, total: m.esc.total, aprobTxt: formatValor(m.esc.aprob, m.esc.tipo) });
    setNotaInput("");
  };

  const guardarNota = async () => {
    if (!notaModal || guardandoNota) return;
    const raw = notaInput.trim().replace(",", ".");
    if (!raw) {
      Alert.alert("Falta la nota", "Ingresá la nota obtenida para guardarla.");
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      Alert.alert("Nota inválida", "Ingresá un número válido.");
      return;
    }
    const n = Math.max(0, Math.min(notaModal.total, parsed));

    setGuardandoNota(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setGuardandoNota(false);
      Alert.alert("Error", "No hay sesión activa.");
      return;
    }

    const fecha = today().toISOString().slice(0, 10);
    const { error } = await supabase.from("agenda").insert({
      user_id: user.id,
      materia_id: notaModal.materiaId,
      kind: "evaluacion",
      tipo: "Examen",
      titulo: "Examen",
      fecha,
      hecho: true,
      nota: n,
      nota_maxima: notaModal.total,
    });
    if (error) {
      setGuardandoNota(false);
      Alert.alert("No se pudo guardar", "Revisá tu conexión e intentá de nuevo.");
      return;
    }

    const resultado = await resolverPendienteSiCorresponde(notaModal.materiaRaw, n);
    setGuardandoNota(false);
    setNotaModal(null);
    setNotaInput("");
    await Promise.all([fetchMaterias(), agenda.refetch()]);
    if (resultado) Alert.alert(resultado.promovida ? "¡Aprobada!" : "Nota cargada", resultado.mensaje);
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
        {progresoActivo && bucketsEsteSemestre && progresoActivo.materias.length > 0 ? (
          <View>
            <SectionTitle>Este semestre</SectionTitle>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
                <ProgressRing
                  progress={progresoActivo.evaluacionesEsperadas > 0 ? progresoActivo.evaluacionesCalificadas / progresoActivo.evaluacionesEsperadas : 0}
                  size={80}
                  strokeWidth={8}
                  color={colors.accent}
                  centerValue={`${progresoActivo.evaluacionesCalificadas}/${progresoActivo.evaluacionesEsperadas}`}
                  centerLabel="notas"
                  valueFontSize={15}
                  labelFontSize={10}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText weight="700" style={{ fontSize: 26, letterSpacing: -0.4 }}>
                    {progresoActivo.promedio != null ? `${progresoActivo.promedio}%` : "—"}
                  </AppText>
                  <AppText style={{ fontSize: 13, color: colors.textSecondary }}>promedio del semestre</AppText>
                  {progresoActivo.deltaVsAnterior != null && progresoActivo.nombreAnterior ? (
                    <AppText
                      mono
                      weight="600"
                      style={{
                        fontSize: 12,
                        color: TONE_COLOR[progresoActivo.deltaVsAnterior > 0 ? "success" : progresoActivo.deltaVsAnterior < 0 ? "danger" : "neutral"],
                      }}
                    >
                      {(progresoActivo.deltaVsAnterior > 0 ? "▲ " : progresoActivo.deltaVsAnterior < 0 ? "▼ " : "— ") +
                        Math.abs(progresoActivo.deltaVsAnterior) +
                        ` pts vs. ${progresoActivo.nombreAnterior}`}
                    </AppText>
                  ) : null}
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
        {semestresConPromedio.length > 0 ? (
          <View>
            <SectionTitle>Evolución de promedio</SectionTitle>
            <Card>
              {semestresConPromedio.map((s) => (
                <PressableScale key={s.semestre.id} scaleTo={0.98} onPress={() => abrirSemestreModal(s)} style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <AppText weight="500" style={{ fontSize: 13, color: colors.textSecondary }}>
                      {s.semestre.nombre}
                      {s.semestre.activo ? " · actual" : ""}
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
        ) : null}

        {/* Semestres sin promedio graficable */}
        {semestresSinPromedio.length > 0 ? (
          <View>
            <SectionTitle>Semestres sin promedio</SectionTitle>
            <Card>
              {semestresSinPromedio.map((s) => (
                <PressableScale
                  key={s.semestre.id}
                  scaleTo={0.98}
                  onPress={() => abrirSemestreModal(s)}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <View style={{ gap: 2 }}>
                    <AppText weight="500" style={{ fontSize: 14 }}>
                      {s.semestre.nombre}
                    </AppText>
                    <AppText style={{ fontSize: 12, color: colors.textFaint }}>{s.aprobadas} aprobadas · sin nota cargada</AppText>
                  </View>
                  <AppIcon name="chevron-forward" size={18} color={colors.textFaint} />
                </PressableScale>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Materias pendientes */}
        {totalPendientes > 0 ? (
          <View>
            <SectionTitle hint={`${totalPendientes} ${totalPendientes === 1 ? "materia" : "materias"}`}>Materias pendientes</SectionTitle>
            <Card>
              {pendientesPorSemestre.map((grupo, gi) => (
                <View
                  key={grupo.semestreId}
                  style={{ gap: spacing.sm, paddingTop: gi === 0 ? 0 : spacing.sm, borderTopWidth: gi === 0 ? 0 : 1, borderTopColor: colors.borderSoft }}
                >
                  <AppText weight="600" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: colors.textFaint }}>
                    {grupo.semestreNombre}
                  </AppText>
                  {grupo.items.map((item) => (
                    <PressableScale
                      key={item.raw.id}
                      scaleTo={0.98}
                      onPress={() => abrirNotaModal(item)}
                      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: colorDeMateria(item.raw) }} />
                      <AppText weight="500" style={{ fontSize: 14, flex: 1 }}>
                        {item.raw.nombre}
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
        {distribucion.length > 0 ? (
          <View>
            <SectionTitle>Distribución de materias</SectionTitle>
            <Card>
              <View style={{ flexDirection: "row", height: 10, borderRadius: radii.round, overflow: "hidden" }}>
                {distribucion.map((s) => (
                  <View key={s.estado} style={{ flexGrow: s.count, backgroundColor: tone[estadoTone[s.estado]].strong }} />
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
        ) : null}

        {/* Progreso hacia el título */}
        <View>
          <SectionTitle>Progreso hacia el título</SectionTitle>
          <Card>
            {metaCarrera ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText style={{ fontSize: 13, color: colors.textSecondary }}>
                    {materiasAprobadasTotal} / {metaCarrera} materias
                  </AppText>
                  <Pill label={`${metaPct}%`} color={colors.successText} background={colors.successSoft} mono />
                </View>
                <BarraProgreso pct={metaPct} color={colors.success} />
              </>
            ) : (
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Configurá tu carrera desde Perfil para ver tu progreso hacia el título.</AppText>
            )}
          </Card>
        </View>

        {/* Aviso materias aprobadas sin nota */}
        {aprobadasSinNota.length > 0 ? (
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
            <AppIcon name="alert-circle-outline" size={20} color={colors.warningText} />
            <AppText style={{ fontSize: 13, color: colors.warningText, flex: 1 }}>
              Tenés {aprobadasSinNota.length} {aprobadasSinNota.length === 1 ? "materia aprobada sin nota cargada" : "materias aprobadas sin nota cargada"}.
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
                      {m.notaTxt}/{m.aprobTxt}
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
                {notaModal.nombre} · aprobás con {notaModal.aprobTxt}
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
            <PrimaryButton label="Guardar" onPress={guardarNota} disabled={guardandoNota} />
          </>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
