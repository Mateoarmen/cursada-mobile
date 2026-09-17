import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase";
import type { Materia, Semestre } from "@/types/database";
import { colors, materiaColors, radii, spacing, type Tone } from "@/theme/tokens";
import { AppText, Avatar, Pill, PressableScale, PrimaryButton, ProgressRing } from "@/components/ui";
import { demoHome } from "@/data/demoContent";
import { computeKpis, computeMaterias, computeProgresoSemestreActivo, formatValor } from "@/lib/materias";
import { getSemestreActivoId, semestresOrdenados } from "@/lib/semestres";
import { useAgenda } from "@/hooks/useAgenda";

const hoy = new Date();
const fechaLabel = hoy
  .toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" })
  .replace(/^\w/, (c) => c.toUpperCase());

const TONE_COLOR: Record<Tone, string> = {
  success: colors.successText,
  warning: colors.warningText,
  danger: colors.dangerText,
  neutral: colors.textTertiary,
};

export default function InicioScreen() {
  const { session } = useSession();
  const email = session?.user?.email ?? "";
  const nombre = email ? email.split("@")[0] : "";
  const initial = email ? email[0]!.toUpperCase() : "?";

  // KPIs/materias en riesgo/progreso del semestre: mismo cálculo real que
  // Materias/Detalle (ver computeKpis/computeMaterias/
  // computeProgresoSemestreActivo en lib/materias.ts), en vez de
  // demoInicioKpis/demoMateriasRiesgo/demoProgresoSemestre.
  const [materiasAll, setMateriasAll] = useState<Materia[] | null>(null);
  const [semestres, setSemestres] = useState<Semestre[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const agenda = useAgenda();

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      (async () => {
        const [{ data: materias }, sems, id] = await Promise.all([supabase.from("materias").select("*"), semestresOrdenados(), getSemestreActivoId()]);
        if (cancelado) return;
        setMateriasAll(materias ?? []);
        setSemestres(sems);
        setActiveId(id);
      })();
      return () => {
        cancelado = true;
      };
    }, [])
  );

  const materiasDelActivo = useMemo(
    () => (materiasAll && agenda.rows ? computeMaterias(materiasAll, agenda.rows, activeId) : null),
    [materiasAll, agenda.rows, activeId]
  );
  const kpis = useMemo(() => (materiasAll && agenda.rows ? computeKpis(materiasAll, agenda.rows, activeId) : null), [materiasAll, agenda.rows, activeId]);
  const materiasRiesgo = useMemo(
    () => (materiasDelActivo ?? []).filter((m) => m.tone === "danger" || m.tone === "warning"),
    [materiasDelActivo]
  );
  const cursandoCount = useMemo(() => (materiasDelActivo ?? []).filter((m) => m.raw.estado === "cursando").length, [materiasDelActivo]);
  const progresoSemestre = useMemo(
    () => (materiasAll && agenda.rows && semestres ? computeProgresoSemestreActivo(materiasAll, agenda.rows, semestres, activeId) : null),
    [materiasAll, agenda.rows, semestres, activeId]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: 120, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ gap: 3, flexShrink: 1 }}>
            <AppText weight="600" style={{ fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint }}>
              {fechaLabel}
            </AppText>
            <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6, lineHeight: 32 }}>
              Hola{nombre ? `, ${nombre}` : ""}
            </AppText>
          </View>
          <PressableScale scaleTo={0.94} onPress={() => router.push("/perfil")}>
            <Avatar initial={initial} />
          </PressableScale>
        </View>

        {/* Lo próximo */}
        <LinearGradient
          colors={[colors.accent, "rgba(44,123,255,0.15)", "rgba(255,255,255,0.06)"]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ borderRadius: radii.xxl, padding: 1.5 }}
        >
          <View style={{ borderRadius: radii.xxl - 1.5, backgroundColor: colors.surfaceRaised, padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText weight="700" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.accentText }}>
                Lo próximo
              </AppText>
              <Pill label={demoHome.proximo.diasLabel} color={colors.warningText} background={colors.warningSoft} mono />
            </View>
            <View style={{ gap: spacing.xs }}>
              <AppText weight="700" style={{ fontSize: 23, letterSpacing: -0.4, lineHeight: 26 }}>
                {demoHome.proximo.titulo}
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary }}>{demoHome.proximo.detalle}</AppText>
            </View>
            <View style={{ gap: spacing.sm }}>
              <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
                <View
                  style={{
                    width: `${demoHome.proximo.progreso * 100}%`,
                    height: "100%",
                    borderRadius: radii.round,
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{demoHome.proximo.progresoLabel}</AppText>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <PrimaryButton label="Abrir materia" flex style={{ height: 40 }} />
              <PrimaryButton label="Ver en agenda" variant="ghost" style={{ height: 40, paddingHorizontal: spacing.lg }} onPress={() => router.push("/(tabs)/agenda")} />
            </View>
          </View>
        </LinearGradient>

        {/* KPIs — réplica de computeKpis() (runtime.js): "Cursando" es un
            agregado propio de mobile (no existe en la web), las otras 3 sí
            (Próxima evaluación se OCULTA sin nada pendiente, Promedio
            general cae a estado vacío con CTA en vez de ocultarse,
            Pendientes esta semana nunca se oculta). */}
        {kpis ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.smd }}>
            <KpiCard icon="school-outline" label="Cursando" valor={String(cursandoCount)} sub="este semestre" />
            {kpis.proximaEvaluacion ? (
              <KpiCard icon="alert-circle-outline" label="Próxima evaluación" valor={kpis.proximaEvaluacion.valor} sub={kpis.proximaEvaluacion.sub} tone="warning" />
            ) : null}
            {kpis.promedioGeneral.empty ? (
              <KpiCard icon="stats-chart-outline" label="Promedio general" valor="—" sub={kpis.promedioGeneral.ctaTexto} />
            ) : (
              <KpiCard icon="stats-chart-outline" label="Promedio general" valor={kpis.promedioGeneral.valor} sub={kpis.promedioGeneral.sub} tone="success" />
            )}
            <KpiCard
              icon="list-outline"
              label="Pendientes esta semana"
              valor={kpis.pendientesSemana.valor}
              sub={kpis.pendientesSemana.sub}
              tone={kpis.pendientesSemana.tone}
            />
          </View>
        ) : null}

        {/* Accesos rápidos */}
        <View>
          <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2, paddingBottom: spacing.sm }}>
            Accesos rápidos
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing.smd }}>
            <AccesoButton icon="folder-outline" label="Materia" onPress={() => router.push("/(tabs)/materias")} />
            <AccesoButton icon="checkmark-done-outline" label={"Tarea o\nevaluación"} onPress={() => router.push("/(tabs)/agenda")} />
            <AccesoButton icon="calendar-outline" label={"Evento\npersonal"} onPress={() => {}} />
            <AccesoButton icon="checkbox-outline" label="Asistencia" onPress={() => router.push("/asistencia")} />
          </View>
        </View>

        {/* Próximos 7 días */}
        <View>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.sm }}>
            <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
              Próximos 7 días
            </AppText>
            <AppText weight="500" style={{ fontSize: 14, color: colors.accent }} onPress={() => router.push("/(tabs)/agenda")}>
              Ver agenda
            </AppText>
          </View>
          {demoHome.proximosDias.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.borderSoft,
              }}
            >
              <View style={{ width: 3, height: 30, borderRadius: radii.round, backgroundColor: item.color }} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText weight="500" style={{ fontSize: 15 }}>
                  {item.titulo}
                </AppText>
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{item.detalle}</AppText>
              </View>
            </View>
          ))}
        </View>

        {/* Materias en riesgo — réplica del panel #riesgo-panel (runtime.js):
            computeMateriasDelActivo() filtrado a tone danger/warning. */}
        {materiasRiesgo.length > 0 ? (
          <View>
            <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2, paddingBottom: spacing.sm }}>
              Materias en riesgo
            </AppText>
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.lg }}>
              {materiasRiesgo.map((m, i) => (
                <PressableScale
                  key={m.raw.id}
                  scaleTo={0.98}
                  onPress={() => router.push(`/materia/${m.raw.id}`)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.lg,
                    paddingVertical: spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.borderSoft,
                  }}
                >
                  <ProgressRing
                    progress={(m.actual ?? 0) / m.esc.total}
                    size={56}
                    strokeWidth={5}
                    color={TONE_COLOR[m.tone]}
                    centerValue={formatValor(m.actual ?? 0, m.esc.tipo)}
                    centerLabel={`/${formatValor(m.esc.aprob, m.esc.tipo)}`}
                    valueFontSize={14}
                    labelFontSize={10}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText weight="600" style={{ fontSize: 15 }}>
                      {m.raw.nombre}
                    </AppText>
                    <AppText style={{ fontSize: 13, color: TONE_COLOR[m.tone] }}>{m.riesgoTxt}</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}

        {/* Progreso del semestre — réplica de progreso-semestre-card
            (computeProgresoSemestreActivo en runtime.js): delta vs. el
            semestre cronológicamente anterior + evaluaciones calificadas/
            esperadas + desglose por materia, peor encaminada primero. */}
        {progresoSemestre && progresoSemestre.materias.length > 0 ? (
          <View>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.sm }}>
              <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
                Progreso del semestre
              </AppText>
              {progresoSemestre.deltaVsAnterior != null && progresoSemestre.nombreAnterior ? (
                <AppText
                  mono
                  weight="600"
                  style={{ fontSize: 13, color: TONE_COLOR[progresoSemestre.deltaVsAnterior > 0 ? "success" : progresoSemestre.deltaVsAnterior < 0 ? "danger" : "neutral"] }}
                >
                  {(progresoSemestre.deltaVsAnterior > 0 ? "▲ " : progresoSemestre.deltaVsAnterior < 0 ? "▼ " : "— ") +
                    Math.abs(progresoSemestre.deltaVsAnterior) +
                    ` pts vs. ${progresoSemestre.nombreAnterior}`}
                </AppText>
              ) : null}
            </View>
            <PressableScale
              scaleTo={0.98}
              onPress={() => router.push("/progreso")}
              style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, flexDirection: "row", gap: spacing.xl, alignItems: "center", flexWrap: "wrap" }}
            >
              <ProgressRing
                progress={progresoSemestre.evaluacionesEsperadas > 0 ? progresoSemestre.evaluacionesCalificadas / progresoSemestre.evaluacionesEsperadas : 0}
                size={96}
                strokeWidth={9}
                color={colors.accent}
                centerValue={`${progresoSemestre.evaluacionesCalificadas}/${progresoSemestre.evaluacionesEsperadas}`}
                centerLabel="notas"
                valueFontSize={17}
                labelFontSize={11}
              />
              <View style={{ flex: 1, minWidth: 180, gap: spacing.sm }}>
                {progresoSemestre.materias.map((m) => {
                  const colorId = m.raw.color_id && m.raw.color_id in materiaColors ? (m.raw.color_id as keyof typeof materiaColors) : "gris";
                  return (
                    <View key={m.raw.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: materiaColors[colorId].strong }} />
                      <AppText style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
                        {m.raw.nombre}
                      </AppText>
                      <AppText mono weight="600" style={{ fontSize: 12, color: TONE_COLOR[m.tone] }}>
                        {m.actual != null ? formatValor(m.actual, m.esc.tipo) : "—"}/{formatValor(m.esc.aprob, m.esc.tipo)}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </PressableScale>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({
  icon,
  label,
  valor,
  sub,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valor: string;
  sub: string;
  tone?: Tone;
}) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
      <View style={{ width: 30, height: 30, borderRadius: radii.sm, backgroundColor: colors.accentSofter, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <View style={{ gap: 2 }}>
        <AppText mono weight="600" style={{ fontSize: 21, letterSpacing: -0.4, lineHeight: 24 }}>
          {valor}
        </AppText>
        <AppText style={{ fontSize: 12, color: colors.textFaint }}>{label}</AppText>
        <AppText style={{ fontSize: 11.5, color: TONE_COLOR[tone] }} numberOfLines={1}>
          {sub}
        </AppText>
      </View>
    </View>
  );
}

function AccesoButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center", gap: spacing.xs }}
    >
      <View style={{ width: 34, height: 34, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={17} color={colors.text} />
      </View>
      <AppText weight="500" style={{ fontSize: 11, textAlign: "center", color: colors.textSecondary, lineHeight: 13 }}>
        {label}
      </AppText>
    </PressableScale>
  );
}
