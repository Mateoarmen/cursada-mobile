import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, ScrollView, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { easing, estadoLabel, estadoTone, materiaColors, motionDuration, radii, spacing, type EstadoMateria, type MateriaColorId, type Tone } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BackButton, BottomSheet, CursadaLoader, Pill, PressableScale, PrimaryButton, ProgressRing, Reveal, Spotlight } from "@/components/ui";
import { supabase, usuarioActual } from "@/lib/supabase";
import { today, toISODate } from "@/lib/agenda";
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

function makeToneColor(colors: ReturnType<typeof useTheme>["colors"]): Record<Tone, string> {
  return {
    success: colors.successText,
    warning: colors.warningText,
    danger: colors.dangerText,
    neutral: colors.textTertiary,
  };
}

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
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.md }}>
      <AppText weight="700" style={{ fontSize: 21, letterSpacing: -0.5, lineHeight: 26 }}>
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
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>{children}</View>;
}

function BarraProgreso({ pct, color }: { pct: number; color: string }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", borderRadius: radii.round, backgroundColor: color }} />
    </View>
  );
}

// Antes esta barra siempre recibía colors.success sin mirar el valor real
// (un promedio de 38% se pintaba verde) — el color ahora refleja qué tan
// lejos está el promedio de aprobar, mismos cortes que el resto del
// producto usa para "en riesgo".
function colorPorPromedio(pct: number, colors: ReturnType<typeof useTheme>["colors"]): string {
  if (pct >= 70) return colors.success;
  if (pct >= 40) return colors.warning;
  return colors.danger;
}

export default function ProgresoScreen() {
  const { colors, tone } = useTheme();
  const TONE_COLOR = useMemo(() => makeToneColor(colors), [colors]);
  const { profile } = useOnboardingStatusContext();
  const agenda = useAgenda();

  const [materiasAll, setMateriasAll] = useState<Materia[] | null>(null);
  const [semestresAll, setSemestresAll] = useState<Semestre[] | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const [semestreModal, setSemestreModal] = useState<SemestreModalData | null>(null);
  const [riesgoModalOpen, setRiesgoModalOpen] = useState(false);
  const [notaModal, setNotaModal] = useState<NotaModalData | null>(null);
  const [notaInput, setNotaInput] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [celebracion, setCelebracion] = useState<{ titulo: string; mensaje: string; promovida: boolean } | null>(null);

  const fetchMaterias = useCallback(async () => {
    try {
      const [{ data: materias }, sems] = await Promise.all([supabase.from("materias").select("*"), semestresOrdenados()]);
      setFetchError(false);
      setMateriasAll(materias ?? []);
      setSemestresAll(sems);
    } catch {
      setFetchError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      (async () => {
        try {
          const [{ data: materias }, sems] = await Promise.all([supabase.from("materias").select("*"), semestresOrdenados()]);
          if (cancelado) return;
          setFetchError(false);
          setMateriasAll(materias ?? []);
          setSemestresAll(sems);
        } catch {
          if (cancelado) return;
          setFetchError(true);
        }
      })();
      return () => {
        cancelado = true;
      };
    }, [])
  );

  // Celebración in-screen para el momento de mayor peak del producto
  // (aprobar una materia) — antes se entregaba como Alert.alert de sistema,
  // indistinguible visualmente de un error de guardado (ver critique P1).
  // motionDuration.focal + spring están reservados justo para esto: un
  // momento autoral único, no una acción repetida.
  const celebracionScale = useRef(new Animated.Value(0.92)).current;
  const celebracionOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!celebracion) return;
    celebracionScale.setValue(0.92);
    celebracionOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(celebracionScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(celebracionOpacity, { toValue: 1, duration: motionDuration.focal, easing: easing.out, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => setCelebracion(null), 3200);
    return () => clearTimeout(timer);
  }, [celebracion, celebracionScale, celebracionOpacity]);

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

  // Detalle detrás del bucket "En riesgo" — antes era un número terminal
  // sin a dónde ir; ahora abre la lista real de materias (ver critique P1:
  // Alex no podía llegar de "3 en riesgo" a cuáles son sin salir a Materias
  // y re-derivarlo a mano).
  const materiasEnRiesgo = useMemo(() => {
    if (!progresoActivo) return [];
    return progresoActivo.materias.filter((m) => m.actual != null && !(m.esc.exoneracion != null && m.actual >= m.esc.exoneracion) && m.actual < m.esc.aprob);
  }, [progresoActivo]);

  const dataReady = materiasAll !== null && semestresAll !== null && agenda.rows !== null;
  const showError = !dataReady && fetchError;

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
    const user = await usuarioActual();
    if (!user) {
      setGuardandoNota(false);
      Alert.alert("Error", "No hay sesión activa.");
      return;
    }

    const fecha = toISODate(today());
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
    if (resultado) {
      setCelebracion({ titulo: resultado.promovida ? "¡Aprobada!" : "Nota cargada", mensaje: resultado.mensaje, promovida: resultado.promovida });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={280} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
          Progreso
        </AppText>
      </View>

      {showError ? (
        <View
          accessible
          accessibilityLabel="No pudimos cargar tu progreso. Revisá tu conexión y volvé a esta pantalla para reintentar."
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
            No pudimos cargar tu progreso. Revisá tu conexión y volvé a esta pantalla para reintentar.
          </AppText>
        </View>
      ) : null}

      {celebracion ? (
        <PressableScale
          scaleTo={0.99}
          onPress={() => setCelebracion(null)}
          accessibilityLabel={`${celebracion.titulo}. ${celebracion.mensaje}. Tocá para cerrar.`}
          style={{ marginHorizontal: spacing.xl, marginBottom: spacing.md }}
        >
          <Animated.View style={{ opacity: celebracionOpacity, transform: [{ scale: celebracionScale }] }}>
            <LinearGradient
              colors={celebracion.promovida ? [colors.success, "rgba(52,199,89,0.15)", "rgba(255,255,255,0.06)"] : [colors.accent, "rgba(44,123,255,0.15)", "rgba(255,255,255,0.06)"]}
              locations={[0, 0.6, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ borderRadius: radii.xl, padding: 1.5 }}
            >
              <View style={{ borderRadius: radii.xl - 1.5, backgroundColor: colors.surfaceRaised, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <AppIcon
                  name={celebracion.promovida ? "checkmark-circle-outline" : "checkmark"}
                  size={22}
                  color={celebracion.promovida ? colors.successText : colors.accentText}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText weight="700" style={{ fontSize: 15 }}>
                    {celebracion.titulo}
                  </AppText>
                  <AppText style={{ fontSize: 13, color: colors.textSecondary }}>{celebracion.mensaje}</AppText>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </PressableScale>
      ) : null}

      {!dataReady ? (
        showError ? null : (
          <View style={{ paddingTop: spacing.xxxl * 2, alignItems: "center" }}>
            <CursadaLoader size={44} label="Cargando tu progreso…" />
          </View>
        )
      ) : (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
      <Reveal style={{ gap: spacing.xxl }}>
        {/* Aviso materias aprobadas sin nota — accionable: lleva a Materias a
            cargarla, mismo destino que ya usa el CTA análogo de Inicio
            (kpis.promedioGeneral, ver app/(tabs)/index.tsx). Banner plano,
            no CtaGlow: ese marco está reservado a sólo 3 lugares ya
            asignados (ver .claude/skills/cursada-mobile-design/SKILL.md). */}
        {aprobadasSinNota.length > 0 ? (
          <PressableScale
            scaleTo={0.98}
            onPress={() => router.push("/(tabs)/materias")}
            accessibilityLabel={`${aprobadasSinNota.length} ${aprobadasSinNota.length === 1 ? "materia aprobada sin nota cargada" : "materias aprobadas sin nota cargada"}. Completar`}
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
            <AppText weight="600" style={{ fontSize: 13, color: colors.warningText }}>
              Completar
            </AppText>
          </PressableScale>
        ) : null}
        {/* Progreso hacia el título — promovida al primer lugar: es el
            número emocionalmente más cargado de la pantalla ("¿voy a
            recibirme?") y antes pesaba lo mismo que "Semestres sin
            promedio" (ver critique P1). Tratamiento hero (gradient-border +
            surfaceRaised) sólo cuando hay una meta configurada; si no,
            queda como card simple con el CTA a Perfil. */}
        <View>
          <SectionTitle>Progreso hacia el título</SectionTitle>
          {metaCarrera ? (
            <LinearGradient
              colors={[colors.accent, "rgba(44,123,255,0.15)", "rgba(255,255,255,0.06)"]}
              locations={[0, 0.6, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ borderRadius: radii.xxl, padding: 1.5 }}
            >
              <View style={{ borderRadius: radii.xxl - 1.5, backgroundColor: colors.surfaceRaised, padding: spacing.xl, gap: spacing.sm }}>
                <View
                  accessible
                  accessibilityLabel={`${materiasAprobadasTotal} de ${metaCarrera} materias aprobadas, ${metaPct}%`}
                  style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}
                >
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexShrink: 1 }}>
                    <AppText weight="700" style={{ fontSize: 48, lineHeight: 52, letterSpacing: -1.5 }}>
                      {materiasAprobadasTotal}
                    </AppText>
                    <AppText weight="500" style={{ fontSize: 16, color: colors.textSecondary }}>
                      / {metaCarrera} materias
                    </AppText>
                  </View>
                  <Pill label={`${metaPct}%`} color={colors.successText} background={colors.successSoft} mono />
                </View>
                <View style={{ paddingTop: spacing.xs }}>
                  <BarraProgreso pct={metaPct} color={colors.success} />
                </View>
              </View>
            </LinearGradient>
          ) : (
            <Card>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Configurá tu carrera desde Perfil para ver tu progreso hacia el título.</AppText>
            </Card>
          )}
        </View>

        {/* Este semestre */}
        {progresoActivo && bucketsEsteSemestre && progresoActivo.materias.length > 0 ? (
          <View>
            <SectionTitle>Este semestre</SectionTitle>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
                <ProgressRing
                  progress={progresoActivo.evaluacionesEsperadas > 0 ? progresoActivo.evaluacionesCalificadas / progresoActivo.evaluacionesEsperadas : 0}
                  size={72}
                  strokeWidth={7}
                  color={colors.accent}
                  centerValue={`${progresoActivo.evaluacionesCalificadas}/${progresoActivo.evaluacionesEsperadas}`}
                  centerLabel="notas"
                  valueFontSize={15}
                  labelFontSize={10}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText weight="700" style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.2 }}>
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
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
                {bucketsEsteSemestre.map((b) => {
                  const esRiesgo = b.label === "En riesgo";
                  const Container = esRiesgo && b.value > 0 ? PressableScale : View;
                  return (
                    <Container
                      key={b.label}
                      {...(esRiesgo && b.value > 0 ? { scaleTo: 0.95, onPress: () => setRiesgoModalOpen(true), accessibilityLabel: `${b.label}: ${b.value}, ver detalle` } : {})}
                      style={{ alignItems: "center", gap: 2, flex: 1 }}
                    >
                      <AppText mono weight="700" style={{ fontSize: 24, color: esRiesgo && b.value > 0 ? colors.dangerText : colors.text }}>
                        {b.value}
                      </AppText>
                      <AppText style={{ fontSize: 12, color: colors.textTertiary, textAlign: "center" }} numberOfLines={2}>
                        {b.label}
                      </AppText>
                    </Container>
                  );
                })}
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
                <PressableScale
                  key={s.semestre.id}
                  scaleTo={0.98}
                  onPress={() => abrirSemestreModal(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.semestre.nombre}, promedio ${s.promedio}%, ${s.aprobadas} de ${s.total} aprobadas`}
                  style={{ gap: spacing.xs, paddingVertical: spacing.xs }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <AppText weight="500" style={{ fontSize: 13, color: colors.textSecondary }}>
                      {s.semestre.nombre}
                      {s.semestre.activo ? " · actual" : ""}
                    </AppText>
                    <AppText mono weight="600" style={{ fontSize: 13 }}>
                      {s.promedio}%
                    </AppText>
                  </View>
                  <BarraProgreso pct={s.promedio ?? 0} color={colorPorPromedio(s.promedio ?? 0, colors)} />
                  <AppText style={{ fontSize: 12, color: colors.textFaint }}>
                    {s.aprobadas}/{s.total} aprobadas{s.exoneradas ? ` · ${s.exoneradas} exoneradas` : ""}
                  </AppText>
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
                  style={{ gap: spacing.sm, paddingTop: gi === 0 ? 0 : spacing.md, borderTopWidth: gi === 0 ? 0 : 1, borderTopColor: colors.borderSoft }}
                >
                  <AppText weight="600" style={{ fontSize: 13, color: colors.textTertiary }}>
                    {grupo.semestreNombre}
                  </AppText>
                  {grupo.items.map((item) => (
                    <PressableScale
                      key={item.raw.id}
                      scaleTo={0.98}
                      onPress={() => abrirNotaModal(item)}
                      accessibilityLabel={`Cargar nota de ${item.raw.nombre}`}
                      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: colorDeMateria(item.raw) }} />
                      <AppText weight="500" style={{ fontSize: 15, flex: 1 }}>
                        {item.raw.nombre}
                      </AppText>
                      <AppText weight="500" style={{ fontSize: 13, color: colors.accentText }}>
                        Cargar nota
                      </AppText>
                      <AppIcon name="chevron-forward" size={13} color={colors.accentText} />
                    </PressableScale>
                  ))}
                </View>
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
                  accessibilityRole="button"
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}
                >
                  <View style={{ gap: 2 }}>
                    <AppText weight="500" style={{ fontSize: 15 }}>
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

      </Reveal>
      </ScrollView>
      )}

      {/* Modal: materias en riesgo este semestre */}
      <BottomSheet visible={riesgoModalOpen} onClose={() => setRiesgoModalOpen(false)}>
        <View style={{ gap: 2 }}>
          <AppText weight="700" style={{ fontSize: 18 }}>
            En riesgo
          </AppText>
          <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
            {materiasEnRiesgo.length} {materiasEnRiesgo.length === 1 ? "materia" : "materias"} por debajo de la nota de aprobación este semestre
          </AppText>
        </View>
        <View style={{ gap: spacing.sm }}>
          {materiasEnRiesgo.map((m, i) => (
            <View
              key={m.raw.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.borderSoft,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: colorDeMateria(m.raw) }} />
              <AppText style={{ fontSize: 15, flex: 1 }}>{m.raw.nombre}</AppText>
              <AppText mono weight="600" style={{ fontSize: 13, color: colors.dangerText }}>
                {formatValor(m.actual ?? 0, m.esc.tipo)}/{formatValor(m.esc.aprob, m.esc.tipo)}
              </AppText>
            </View>
          ))}
        </View>
      </BottomSheet>

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
                    <AppText style={{ fontSize: 15, flex: 1 }}>{m.nombre}</AppText>
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
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.lg,
                fontSize: 17,
                color: colors.text,
                fontFamily: "InstrumentSans_600SemiBold",
              }}
            />
            <PrimaryButton label="Guardar" onPress={guardarNota} disabled={guardandoNota || !notaInput.trim()} />
          </>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
