import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@/hooks/useSession";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { supabase } from "@/lib/supabase";
import type { Materia, Personal, Semestre } from "@/types/database";
import { materiaColors, radii, spacing, tabBar, type MateriaColorId, type Tone } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import {
  AppIcon,
  AppText,
  Avatar,
  BrandMark,
  CtaGlow,
  Pill,
  PressableScale,
  PrimaryButton,
  ProgressRing,
  Reveal,
  Spotlight,
  type AppIconName,
} from "@/components/ui";
import { agendaDeSemestre, computeKpis, computeMateria, computeMaterias, computeProgresoSemestreActivo, formatValor, unidad } from "@/lib/materias";
import { getSemestreActivoId, semestresOrdenados } from "@/lib/semestres";
import { useAgenda } from "@/hooks/useAgenda";
import { agendaBadgeInfo, esCountdownUrgente, formatCountdown, formatFechaAgenda, PERSONAL_COLOR, today as agendaToday } from "@/lib/agenda";
import { computeProximos, type ProximoItem } from "@/lib/proximos";
import { configurarCanalAndroid, getNotifPrefs, sincronizarNotificaciones } from "@/lib/notifications";

const hoy = new Date();
const fechaLabel = hoy
  .toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" })
  .replace(/^\w/, (c) => c.toUpperCase());

function makeToneColor(colors: ReturnType<typeof useTheme>["colors"]): Record<Tone, string> {
  return {
    success: colors.successText,
    warning: colors.warningText,
    danger: colors.dangerText,
    neutral: colors.textTertiary,
  };
}

// Evita refetch de red completo si se vuelve a esta tab dentro de esta
// ventana (p.ej. Inicio → Materias → Inicio en pocos segundos); una vuelta
// real después de editar algo en otra pantalla sigue trayendo datos frescos.
const FOCUS_REFETCH_MIN_INTERVAL_MS = 5000;

export default function InicioScreen() {
  const { colors, tone } = useTheme();
  const TONE_COLOR = useMemo(() => makeToneColor(colors), [colors]);
  const insets = useSafeAreaInsets();
  // Espacio real de la tab bar flotante (altura + gap inferior + su propio
  // margen respecto al home indicator) en vez de un padding fijo adivinado.
  const tabBarClearance =
    insets.bottom + (Platform.OS === "ios" ? tabBar.bottomGapIOS : tabBar.bottomGapOther) + tabBar.height + spacing.lg;
  const { session } = useSession();
  const email = session?.user?.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "?";
  // Nombre real de profiles.nombre (ver database.ts) — antes usaba el
  // prefijo del email como aproximación; ahora que el saludo es un
  // subtítulo chico bajo el logo, no un título grande, vale la pena el
  // dato real en vez de la aproximación.
  const { profile } = useOnboardingStatusContext();
  const nombre = profile?.nombre?.trim() || "";

  // KPIs/materias en riesgo/progreso del semestre: mismo cálculo real que
  // Materias/Detalle (ver computeKpis/computeMaterias/
  // computeProgresoSemestreActivo en lib/materias.ts), en vez de
  // demoInicioKpis/demoMateriasRiesgo/demoProgresoSemestre.
  const [materiasAll, setMateriasAll] = useState<Materia[] | null>(null);
  const [semestres, setSemestres] = useState<Semestre[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Fetch de sólo-lectura de `personal` — sólo para que "Lo próximo"/
  // "Próximos días" no mezclen ítems reales con demoHome; crear/editar
  // eventos personales es una pantalla aparte, fuera de alcance acá.
  const [personalAll, setPersonalAll] = useState<Personal[] | null>(null);
  // Sólo importa mientras todavía no hay nada cargado: una vez que
  // materiasAll tiene datos (aunque sean de una vuelta anterior), un fallo
  // puntual en el refetch de foco no debe tapar contenido que ya se vio
  // como si la pantalla hubiese quedado en blanco.
  const [fetchError, setFetchError] = useState(false);
  const agenda = useAgenda();
  const lastFetchedAtRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchedAtRef.current < FOCUS_REFETCH_MIN_INTERVAL_MS) return;

      let cancelado = false;
      (async () => {
        try {
          const [{ data: materias }, { data: personal }, sems, id] = await Promise.all([
            supabase.from("materias").select("*"),
            supabase.from("personal").select("*"),
            semestresOrdenados(),
            getSemestreActivoId(),
          ]);
          if (cancelado) return;
          lastFetchedAtRef.current = Date.now();
          setFetchError(false);
          setMateriasAll(materias ?? []);
          setPersonalAll(personal ?? []);
          setSemestres(sems);
          setActiveId(id);
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

  // Recordatorios locales: se reconcilian acá (no en cada mutación
  // puntual de agenda/horario) porque Inicio es la pantalla que de
  // cualquier forma ya vuelve a traer materiasAll/agenda al reabrir la
  // app — recalcular toda la cola en ese momento es más simple y
  // confiable que perseguir cada punto de mutación por separado. Sólo
  // materias/agenda del semestre activo: no tiene sentido recordar una
  // clase o un examen de un semestre ya cerrado.
  useEffect(() => {
    if (!materiasAll || !agenda.rows) return;
    let cancelado = false;
    (async () => {
      const prefs = await getNotifPrefs();
      const materiasActivo = materiasAll.filter((m) => m.semestre_id === activeId);
      const agendaActivo = agendaDeSemestre(agenda.rows!, materiasAll, activeId);
      if (cancelado) return;
      await configurarCanalAndroid();
      await sincronizarNotificaciones(prefs, agendaActivo, materiasActivo);
    })();
    return () => {
      cancelado = true;
    };
  }, [materiasAll, agenda.rows, activeId]);

  const materiasDelActivo = useMemo(
    () => (materiasAll && agenda.rows ? computeMaterias(materiasAll, agenda.rows, activeId) : null),
    [materiasAll, agenda.rows, activeId]
  );
  const kpis = useMemo(() => (materiasAll && agenda.rows ? computeKpis(materiasAll, agenda.rows, activeId) : null), [materiasAll, agenda.rows, activeId]);
  const materiasRiesgo = useMemo(
    () => (materiasDelActivo ?? []).filter((m) => m.tone === "danger" || m.tone === "warning"),
    [materiasDelActivo]
  );

  // Evaluaciones ya rendidas (hecho=true) pero sin nota cargada (nota=null)
  // — mismo criterio que agendaBadgeInfo "Esperando nota" en Agenda, pero
  // acotado a evaluaciones (no tareas) del semestre activo, más reciente
  // primero para que lo recién rendido quede arriba.
  const esperandoNota = useMemo(() => {
    if (!materiasAll || !agenda.rows) return [];
    const agendaActivo = agendaDeSemestre(agenda.rows, materiasAll, activeId);
    const materiaNombre = new Map(materiasAll.map((m) => [m.id, m.nombre]));
    return agendaActivo
      .filter((e) => e.kind === "evaluacion" && e.hecho && e.nota == null)
      .map((e) => ({ id: e.id, materiaId: e.materia_id, materiaNombre: e.materia_id ? (materiaNombre.get(e.materia_id) ?? "") : "", titulo: e.titulo, fecha: e.fecha }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [materiasAll, agenda.rows, activeId]);
  const cursandoCount = useMemo(() => (materiasDelActivo ?? []).filter((m) => m.raw.estado === "cursando").length, [materiasDelActivo]);
  const progresoSemestre = useMemo(
    () => (materiasAll && agenda.rows && semestres ? computeProgresoSemestreActivo(materiasAll, agenda.rows, semestres, activeId) : null),
    [materiasAll, agenda.rows, semestres, activeId]
  );

  // "Lo próximo"/"Próximos días" — réplica de proximosEnRango()/
  // renderInicioHero() (runtime.js), ver src/lib/proximos.ts.
  const t7 = useMemo(() => agendaToday(), []);
  const proximos = useMemo(
    () => (materiasAll && agenda.rows && personalAll ? computeProximos(agenda.rows, materiasAll, personalAll, activeId, t7) : null),
    [materiasAll, agenda.rows, personalAll, activeId, t7]
  );
  const heroItem = proximos?.items[0] ?? null;
  const heroMateriaRaw = heroItem?.tipo === "materia" ? materiasAll?.find((m) => m.id === heroItem.item.materia_id) ?? null : null;
  const heroMateria = useMemo(
    () => (heroMateriaRaw && agenda.rows ? computeMateria(heroMateriaRaw, agenda.rows) : null),
    [heroMateriaRaw, agenda.rows]
  );
  const heroBadge =
    heroItem?.tipo === "materia" ? agendaBadgeInfo({ hecho: heroItem.item.hecho, itemKind: heroItem.item.kind, nota: heroItem.item.nota, fecha: heroItem.item.fecha }, t7) : null;
  const heroMeta =
    heroItem?.tipo === "materia"
      ? `${heroMateriaRaw ? heroMateriaRaw.nombre + " · " : ""}${heroItem.item.hora ? heroItem.item.hora + " · " : ""}${heroItem.item.tipo}`
      : heroItem?.tipo === "personal"
        ? heroItem.item.todo_el_dia
          ? "Todo el día"
          : heroItem.item.hora || ""
        : "";

  // Filas de "Próximos días" — mismo color de identidad (materia fuerte o
  // PERSONAL_COLOR) y meta que usa el hero de arriba, ver renderInicio()/
  // proximos-list en runtime.js. fecha/countdown se agregan acá (antes la
  // fila sólo mostraba materia/hora/tipo — el título de la sección puede caer
  // a "Este mes" o al nombre de otro mes sin que ninguna fila dijera qué día
  // era ni cuánto faltaba, ver computeProximos).
  const proximosDiasRows = useMemo(
    () =>
      (proximos?.items ?? []).map((p: ProximoItem) => {
        const hora = p.tipo === "materia" ? p.item.hora || undefined : p.item.todo_el_dia ? undefined : p.item.hora || undefined;
        const fechaLabel = formatFechaAgenda(p.item.fecha, hora);
        const countdown = formatCountdown(p.item.fecha, hora, new Date());
        const urgente = esCountdownUrgente(p.item.fecha);
        if (p.tipo === "materia") {
          const m = materiasAll?.find((mm) => mm.id === p.item.materia_id) ?? null;
          const colorId = m?.color_id && m.color_id in materiaColors ? (m.color_id as MateriaColorId) : "gris";
          return {
            id: p.item.id,
            titulo: p.item.titulo,
            detalle: `${m ? m.nombre + " · " : ""}${p.item.hora ? p.item.hora + " · " : ""}${p.item.tipo}`,
            color: materiaColors[colorId].strong,
            fechaLabel,
            countdown,
            urgente,
          };
        }
        return {
          id: p.item.id,
          titulo: p.item.titulo,
          detalle: p.item.todo_el_dia ? "Todo el día" : p.item.hora || "Personal",
          color: PERSONAL_COLOR,
          fechaLabel,
          countdown,
          urgente,
        };
      }),
    [proximos, materiasAll]
  );

  // Gatea la entrada única de contenido (Reveal) a que haya datos reales
  // para mostrar, en vez de dispararla al montar el componente — así la
  // animación coincide con el momento real en que el contenido aparece, no
  // con un punto arbitrario antes del fetch (ver critique P0).
  const dataReady = materiasAll !== null && agenda.rows !== null;
  // Error visible sólo mientras no hay nada previo cargado — un fallo en
  // un refetch de foco posterior no debe tapar contenido ya visto (ver
  // critique P2: antes un fetch fallido dejaba la pantalla casi en blanco
  // sin ningún mensaje, indistinguible de "no tenés nada pendiente").
  const showError = !dataReady && (fetchError || !!agenda.error);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: tabBarClearance, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ gap: 6, flexShrink: 1 }}>
            <AppText weight="600" style={{ fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint }}>
              {fechaLabel}
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <BrandMark size={26} />
              <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.4 }}>
                cursada
              </AppText>
            </View>
            {nombre ? (
              <AppText style={{ fontSize: 13, color: colors.textSecondary }}>Hola, {nombre}</AppText>
            ) : null}
          </View>
          <PressableScale scaleTo={0.94} onPress={() => router.push("/perfil")} accessibilityLabel="Abrir perfil">
            <Avatar initial={initial} />
          </PressableScale>
        </View>

        {showError ? (
          <View
            accessible
            accessibilityLabel="No pudimos cargar tu información. Revisá tu conexión y volvé a esta pantalla para reintentar."
            style={{
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
              No pudimos cargar tu información. Revisá tu conexión y volvé a esta pantalla para reintentar.
            </AppText>
          </View>
        ) : null}

        {/* Entrada única del contenido ya cargado (fade + translateY sutil,
            --ease-out) — se dispara cuando dataReady pasa de false a true,
            no al montar la pantalla, para que coincida con el momento real
            en que el contenido aparece (ver critique P0: antes todo
            aparecía de golpe sin transición). Un solo momento autoral para
            todo el bloque, no una entrada por sección. */}
        {dataReady ? (
          <Reveal style={{ gap: spacing.xl }}>
          {/* Lo próximo — réplica de renderInicioHero() (runtime.js): usa
              proximos[0] (ver src/lib/proximos.ts). Materia: badge de estado
              (mismo criterio que Agenda, agendaBadgeInfo), + barra de
              progreso/riesgoTxt si la materia ya tiene notas cargadas.
              Personal: badge fijo "Personal", sin barra de progreso. */}
          {heroItem ? (
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
                  {heroItem.tipo === "materia" && heroBadge ? (
                    <Pill label={heroBadge.label} color={tone[heroBadge.tone].text} background={tone[heroBadge.tone].soft} mono />
                  ) : (
                    <Pill label="Personal" color={tone.neutral.text} background={tone.neutral.soft} mono />
                  )}
                </View>
                <View style={{ gap: spacing.xs }}>
                  <AppText weight="700" style={{ fontSize: 23, letterSpacing: -0.4, lineHeight: 29 }}>
                    {heroItem.item.titulo}
                  </AppText>
                  <AppText style={{ fontSize: 14, color: colors.textSecondary }}>{heroMeta}</AppText>
                </View>
                {heroItem.tipo === "materia" && heroMateria && heroMateria.actual != null ? (
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
                      <View
                        style={{
                          width: `${Math.max(0, Math.min(100, (heroMateria.actual / heroMateria.esc.total) * 100))}%`,
                          height: "100%",
                          borderRadius: radii.round,
                          backgroundColor: TONE_COLOR[heroMateria.tone],
                        }}
                      />
                    </View>
                    <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
                      {heroMateria.riesgoTxt ||
                        `Vas aprobando · aprobás con ${formatValor(heroMateria.esc.aprob, heroMateria.esc.tipo)}${unidad(heroMateria.esc.tipo)}.`}
                    </AppText>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {heroItem.tipo === "materia" ? (
                    <PrimaryButton
                      label="Abrir materia"
                      flex
                      style={{ minHeight: 40 }}
                      onPress={() => heroMateriaRaw && router.push(`/materia/${heroMateriaRaw.id}`)}
                    />
                  ) : (
                    <PrimaryButton
                      label="Ver en agenda"
                      flex
                      style={{ minHeight: 40 }}
                      onPress={() => router.push(`/item/${heroItem.item.id}?kind=personal`)}
                    />
                  )}
                  {heroItem.tipo === "materia" ? (
                    <PrimaryButton
                      label="Ver en agenda"
                      variant="ghost"
                      style={{ minHeight: 40, paddingHorizontal: spacing.lg }}
                      onPress={() => router.push(`/item/${heroItem.item.id}?kind=materia`)}
                    />
                  ) : null}
                </View>
              </View>
            </LinearGradient>
          ) : null}
  
          {/* KPIs — réplica de computeKpis() (runtime.js): "Cursando" es un
              agregado propio de mobile (no existe en la web), las otras 3 sí
              (Próxima evaluación se OCULTA sin nada pendiente, Promedio
              general cae a estado vacío con CTA en vez de ocultarse,
              Pendientes esta semana nunca se oculta). */}
          {kpis ? (
            // Las 4 KPI tiles son una lista real (mismo shape, se leen en
            // conjunto) — el único lugar de esta pantalla donde el stagger
            // de animate.md aplica ("sibling stagger es apropiado cuando
            // una lista aparece como lista"). Delay total chico (0-135ms,
            // capeado) y en modo "pop" (fade+scale, sin translateY) para no
            // pisar el eje del Reveal "slide" que ya envuelve todo el
            // bloque. Todas navegan ahora — antes eran de sólo lectura.
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.smd }}>
              <Reveal mode="pop" delay={0} style={{ flexBasis: "47%", flexGrow: 0 }}>
                <KpiCard
                  icon="school-outline"
                  label="Cursando"
                  valor={String(cursandoCount)}
                  sub="este semestre"
                  onPress={() => router.push("/(tabs)/materias")}
                  style={{ flexBasis: "100%", flexGrow: 1 }}
                />
              </Reveal>
              {kpis.proximaEvaluacion ? (
                <Reveal mode="pop" delay={45} style={{ flexBasis: "47%", flexGrow: 0 }}>
                  <KpiCard
                    icon="alert-circle-outline"
                    label="Próxima evaluación"
                    valor={kpis.proximaEvaluacion.valor}
                    sub={kpis.proximaEvaluacion.sub}
                    tone="warning"
                    onPress={() => router.push(`/item/${kpis.proximaEvaluacion!.id}?kind=materia`)}
                    style={{ flexBasis: "100%", flexGrow: 1 }}
                  />
                </Reveal>
              ) : null}
              {kpis.promedioGeneral.empty ? (
                // Uno de los 3 lugares sancionados para .cta-glow en design.md
                // ("Cargá tu primera nota" ~ #btn-progreso-semestre-cargar):
                // primer uso, se ve una sola vez hasta cargar la primera nota.
                // Nota: a diferencia del panel aislado de la web, acá comparte
                // fila con otras KPI cards — no hay forma de lograr el mismo
                // "sin competencia visual" sin rediseñar la grilla de KPIs,
                // fuera de alcance de esta pasada (sólo Inicio).
                <Reveal mode="pop" delay={90} style={{ flexBasis: "47%", flexGrow: 0 }}>
                  <CtaGlow radius={radii.md}>
                    <KpiCard
                      icon="stats-chart-outline"
                      label="Promedio general"
                      valor="—"
                      sub={kpis.promedioGeneral.ctaTexto}
                      onPress={() => router.push("/(tabs)/materias")}
                      style={{ flexBasis: "100%", flexGrow: 1 }}
                    />
                  </CtaGlow>
                </Reveal>
              ) : (
                <Reveal mode="pop" delay={90} style={{ flexBasis: "47%", flexGrow: 0 }}>
                  <KpiCard
                    icon="stats-chart-outline"
                    label="Promedio general"
                    valor={kpis.promedioGeneral.valor}
                    sub={kpis.promedioGeneral.sub}
                    tone="success"
                    onPress={() => router.push("/progreso")}
                    style={{ flexBasis: "100%", flexGrow: 1 }}
                  />
                </Reveal>
              )}
              <Reveal mode="pop" delay={135} style={{ flexBasis: "47%", flexGrow: 0 }}>
                <KpiCard
                  icon="list-outline"
                  label="Pendientes esta semana"
                  valor={kpis.pendientesSemana.valor}
                  sub={kpis.pendientesSemana.sub}
                  tone={kpis.pendientesSemana.tone}
                  onPress={() => router.push("/(tabs)/agenda")}
                  style={{ flexBasis: "100%", flexGrow: 1 }}
                />
              </Reveal>
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
              {/* Crear evento personal desde acá queda fuera de alcance por
                  ahora (ver fetch de sólo-lectura de `personal` más arriba);
                  se deshabilita en vez de simular una acción que no hace nada. */}
              <AccesoButton icon="calendar-outline" label={"Evento\npersonal"} disabled disabledHint="Pronto" />
              <AccesoButton icon="checkbox-outline" label="Asistencia" onPress={() => router.push("/asistencia")} />
            </View>
          </View>
  
          {/* Próximos días — título cambia según la cascada de fallback de
              computeProximos() ("Próximos 7 días" / "Este mes" / nombre del
              mes siguiente), ver src/lib/proximos.ts. */}
          <View>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: spacing.sm }}>
              <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
                {proximos?.titulo ?? "Próximos 7 días"}
              </AppText>
              <PressableScale
                onPress={() => router.push("/(tabs)/agenda")}
                hitSlop={8}
                style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginVertical: -spacing.sm, marginHorizontal: -spacing.xs }}
              >
                <AppText weight="500" style={{ fontSize: 14, color: colors.accent }}>
                  Ver agenda
                </AppText>
              </PressableScale>
            </View>
            {proximos && !proximosDiasRows.length ? (
              <AppText style={{ fontSize: 13, color: colors.textTertiary, paddingVertical: spacing.md }}>
                {proximos.titulo === "Este mes" ? "No tenés nada agendado este mes." : "No tenés nada agendado para los próximos 7 días."}
              </AppText>
            ) : null}
            {proximosDiasRows.map((item) => (
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
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <AppText mono style={{ fontSize: 11, color: colors.textFaint }}>
                    {item.fechaLabel}
                  </AppText>
                  <AppText mono weight="600" style={{ fontSize: 12, color: item.urgente ? colors.warningText : colors.textFaint }}>
                    {item.countdown}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
  
          {/* Esperando nota — evaluaciones ya rendidas sin calificar todavía,
              para que no se pierdan de vista; tap abre directo la carga de
              nota en Detalle de materia (ver evaluacionId en materia/[id]). */}
          {esperandoNota.length > 0 ? (
            <View>
              <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2, paddingBottom: spacing.sm }}>
                Esperando nota
              </AppText>
              <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.lg }}>
                {esperandoNota.map((e, i) => (
                  <PressableScale
                    key={e.id}
                    scaleTo={0.98}
                    onPress={() => e.materiaId && router.push(`/materia/${e.materiaId}?evaluacionId=${e.id}`)}
                    accessibilityLabel={`Cargar nota de ${e.titulo}, ${e.materiaNombre}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingVertical: spacing.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderSoft,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.warningSoft, alignItems: "center", justifyContent: "center" }}>
                      <AppIcon name="alert-circle-outline" size={18} color={colors.warningText} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText weight="600" numberOfLines={1} style={{ fontSize: 15 }}>
                        {e.titulo}
                      </AppText>
                      <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textTertiary }}>
                        {e.materiaNombre}
                      </AppText>
                    </View>
                    <AppIcon name="chevron-forward" size={18} color={colors.textFaint} />
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

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
                    accessibilityLabel={`${m.raw.nombre}, ${m.riesgoTxt}`}
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
                    <AppIcon name="chevron-forward" size={18} color={colors.textFaint} />
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
              {/* Mismo tratamiento que la card "Este semestre" de Progreso
                  (mismo dato: computeProgresoSemestreActivo) — antes el
                  ring mostraba evaluaciones calificadas/esperadas como
                  número protagonista (una métrica de avance de carga, no
                  de rendimiento) y la lista de materias iba al costado con
                  flexWrap, sin relación clara con el resto de las cards de
                  Inicio. Ahora el promedio real lidera, y el desglose por
                  materia va debajo de un divisor, mismo patrón que
                  "Materias en riesgo". */}
              <PressableScale
                scaleTo={0.98}
                onPress={() => router.push("/progreso")}
                accessibilityLabel="Ver progreso del semestre"
                style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
                  <ProgressRing
                    progress={progresoSemestre.evaluacionesEsperadas > 0 ? progresoSemestre.evaluacionesCalificadas / progresoSemestre.evaluacionesEsperadas : 0}
                    size={80}
                    strokeWidth={8}
                    color={colors.accent}
                    centerValue={`${progresoSemestre.evaluacionesCalificadas}/${progresoSemestre.evaluacionesEsperadas}`}
                    centerLabel="notas"
                    valueFontSize={15}
                    labelFontSize={10}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText weight="700" style={{ fontSize: 26, letterSpacing: -0.4 }}>
                      {progresoSemestre.promedio != null ? `${progresoSemestre.promedio}%` : "—"}
                    </AppText>
                    <AppText style={{ fontSize: 13, color: colors.textSecondary }}>promedio del semestre</AppText>
                  </View>
                </View>
                <View style={{ gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
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
          </Reveal>
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
  onPress,
  style,
}: {
  icon: AppIconName;
  label: string;
  valor: string;
  sub: string;
  tone?: Tone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, tone: toneMap } = useTheme();
  const TONE_COLOR = useMemo(() => makeToneColor(colors), [colors]);
  // Pressable sólo cuando el caller pasa onPress — todas las KPI de Inicio
  // ahora navegan a algo (Materias/Agenda/Progreso), así que en la
  // práctica esto es casi siempre PressableScale; queda opcional para no
  // atar el componente a que SIEMPRE haya un destino.
  const Container = onPress ? PressableScale : View;
  // El chip de ícono toma el color del tono en vez de acento fijo siempre
  // — antes las 4 KPI cards eran visualmente idénticas salvo el número;
  // ahora "Próxima evaluación"/riesgo se leen naranja/rojo de un vistazo,
  // igual que el resto de la app (ver TONE_COLOR). "neutral" se queda con
  // el acento de marca (Cursando es un conteo, no un estado de alerta).
  const iconBg = tone === "neutral" ? colors.accentSofter : toneMap[tone].soft;
  const iconFg = tone === "neutral" ? colors.accent : toneMap[tone].text;
  return (
    <Container
      {...(onPress ? { onPress, scaleTo: 0.97 } : { accessible: true })}
      accessibilityLabel={`${label}: ${valor}, ${sub}`}
      // flexGrow:0 en vez de 1 — con 3 tarjetas visibles (proximaEvaluacion
      // oculta) el último ítem de la fila no debe estirarse a lo ancho.
      style={[
        { flexBasis: "47%", flexGrow: 0, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
        style,
      ]}
    >
      <View style={{ width: 30, height: 30, borderRadius: radii.sm, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <AppIcon name={icon} size={16} color={iconFg} />
      </View>
      <View style={{ gap: 2 }}>
        <AppText mono weight="600" style={{ fontSize: 21, letterSpacing: -0.4, lineHeight: 27 }}>
          {valor}
        </AppText>
        <AppText style={{ fontSize: 12, color: colors.textFaint }}>{label}</AppText>
        <AppText style={{ fontSize: 11.5, color: TONE_COLOR[tone] }} numberOfLines={1}>
          {sub}
        </AppText>
      </View>
    </Container>
  );
}

function AccesoButton({
  icon,
  label,
  onPress,
  disabled,
  disabledHint,
}: {
  icon: AppIconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const { colors } = useTheme();
  const flatLabel = label.replace("\n", " ");
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={disabled && disabledHint ? `${flatLabel} (${disabledHint})` : flatLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        paddingVertical: spacing.md,
        alignItems: "center",
        gap: spacing.xs,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <AppIcon name={icon} size={17} color={colors.text} />
      </View>
      <AppText weight="500" style={{ fontSize: 11, textAlign: "center", color: colors.textSecondary, lineHeight: 15 }}>
        {label}
      </AppText>
      {disabled && disabledHint ? (
        <AppText weight="600" style={{ fontSize: 9.5, textAlign: "center", color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {disabledHint}
        </AppText>
      ) : null}
    </PressableScale>
  );
}
