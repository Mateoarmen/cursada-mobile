import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/hooks/useSession";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, Avatar, Pill, PressableScale, PrimaryButton, ProgressRing } from "@/components/ui";
import {
  demoHome,
  demoInicioKpis,
  demoMateriasRiesgo,
  demoProgresoSemestre,
  type DemoTone,
} from "@/data/demoContent";

const hoy = new Date();
const fechaLabel = hoy
  .toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" })
  .replace(/^\w/, (c) => c.toUpperCase());

const TONE_COLOR: Record<DemoTone, string> = {
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

        {/* KPIs */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.smd }}>
          <KpiCard icon="school-outline" label="Cursando" valor={demoInicioKpis.cursando.valor} sub={demoInicioKpis.cursando.sub} />
          <KpiCard
            icon="alert-circle-outline"
            label="Próxima evaluación"
            valor={demoInicioKpis.proximaEvaluacion.valor}
            sub={demoInicioKpis.proximaEvaluacion.sub}
            tone={demoInicioKpis.proximaEvaluacion.tone}
          />
          <KpiCard
            icon="stats-chart-outline"
            label="Promedio general"
            valor={demoInicioKpis.promedioGeneral.valor}
            sub={demoInicioKpis.promedioGeneral.sub}
            tone={demoInicioKpis.promedioGeneral.tone}
          />
          <KpiCard
            icon="list-outline"
            label="Pendientes esta semana"
            valor={demoInicioKpis.pendientesSemana.valor}
            sub={demoInicioKpis.pendientesSemana.sub}
            tone={demoInicioKpis.pendientesSemana.tone}
          />
        </View>

        {/* Accesos rápidos */}
        <View>
          <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2, paddingBottom: spacing.sm }}>
            Accesos rápidos
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing.smd }}>
            <AccesoButton icon="folder-outline" label="Materia" onPress={() => router.push("/(tabs)/materias")} />
            <AccesoButton icon="checkmark-done-outline" label={"Tarea o\nevaluación"} onPress={() => router.push("/(tabs)/agenda")} />
            <AccesoButton icon="calendar-outline" label={"Evento\npersonal"} onPress={() => {}} />
            <AccesoButton icon="time-outline" label="Ver horario" onPress={() => router.push("/(tabs)/horario")} />
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

        {/* Materias en riesgo */}
        {demoMateriasRiesgo.length > 0 ? (
          <View>
            <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2, paddingBottom: spacing.sm }}>
              Materias en riesgo
            </AppText>
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.lg }}>
              {demoMateriasRiesgo.map((m, i) => (
                <PressableScale
                  key={m.id}
                  scaleTo={0.98}
                  onPress={() => router.push(`/materia/${m.id}`)}
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
                    progress={m.actual / m.total}
                    size={56}
                    strokeWidth={5}
                    color={TONE_COLOR[m.tone]}
                    centerValue={m.actual.toFixed(1)}
                    centerLabel={`/${m.aprob}`}
                    valueFontSize={14}
                    labelFontSize={10}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText weight="600" style={{ fontSize: 15 }}>
                      {m.nombre}
                    </AppText>
                    <AppText style={{ fontSize: 13, color: TONE_COLOR[m.tone] }}>{m.riesgoTxt}</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}

        {/* Progreso del semestre */}
        <View>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.sm }}>
            <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
              Progreso del semestre
            </AppText>
            <AppText mono weight="600" style={{ fontSize: 13, color: TONE_COLOR[demoProgresoSemestre.deltaTone] }}>
              {demoProgresoSemestre.deltaLabel}
            </AppText>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, flexDirection: "row", gap: spacing.xl, alignItems: "center", flexWrap: "wrap" }}>
            <ProgressRing
              progress={demoProgresoSemestre.evaluacionesCalificadas / demoProgresoSemestre.evaluacionesEsperadas}
              size={96}
              strokeWidth={9}
              color={colors.accent}
              centerValue={`${demoProgresoSemestre.evaluacionesCalificadas}/${demoProgresoSemestre.evaluacionesEsperadas}`}
              centerLabel="notas"
              valueFontSize={17}
              labelFontSize={11}
            />
            <View style={{ flex: 1, minWidth: 180, gap: spacing.sm }}>
              {demoProgresoSemestre.materias.map((m) => (
                <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ width: 8, height: 8, borderRadius: radii.round, backgroundColor: m.color }} />
                  <AppText style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
                    {m.nombre}
                  </AppText>
                  <AppText mono weight="600" style={{ fontSize: 12, color: TONE_COLOR[m.tone as DemoTone] }}>
                    {m.notaTxt}/{m.aprob}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </View>
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
  tone?: DemoTone;
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
