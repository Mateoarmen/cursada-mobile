import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, LayoutAnimation, PanResponder, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";
import { materiaColors, motionDuration, radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";
import { DIAS_CORTOS, formatCountdown, parseISODate } from "@/lib/agenda";
import { formatRangoSemana, type CargaSemestre, type EvaluacionCarga, type SemanaCarga } from "@/lib/cargaSemestre";

// Widget "Curva de carga" (diseño 1B, claude.ai/design → Cursada Widget Carga).
// Colapsado (diseño M): curva chica + próxima evaluación. Expandido (diseño L):
// la curva responde al dedo — la línea punteada se corre semana a semana y
// abajo se ven las evaluaciones que caen en esa semana — y "hoy" queda
// marcado aparte para compararlo con el punto que se está mirando.

const CHART_H_COLAPSADO = 88;
const CHART_H_EXPANDIDO = 150;
const PAD_TOP = 12;
const PAD_BOTTOM = 4;
const ROW_H = 56;
// Filas que se reservan siempre en el detalle para que el contenido de abajo
// no salte al pasar de una semana con 1 evaluación a otra con 3.
const FILAS_RESERVADAS_MAX = 2;

function conAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const formatNota = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Props = {
  carga: CargaSemestre;
  onOpenEvaluacion: (id: string) => void;
};

export function CargaSemestreWidget({ carga, onOpenEvaluacion }: Props) {
  const { colors } = useTheme();
  const n = carga.semanas.length;
  const reposo = carga.hoy ?? 0;
  const [expandido, setExpandido] = useState(false);
  const [seleccion, setSeleccion] = useState(reposo);
  const sel = Math.min(seleccion, n - 1);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        reduceMotionRef.current = v;
      })
      .catch(() => {});
  }, []);

  const toggle = () => {
    if (!reduceMotionRef.current) {
      LayoutAnimation.configureNext(LayoutAnimation.create(motionDuration.layout, "easeInEaseOut", "opacity"));
    }
    // Al plegar vuelve a "hoy": el widget colapsado siempre muestra dónde estás.
    if (expandido) setSeleccion(reposo);
    setExpandido(!expandido);
  };

  const counts = useMemo(() => carga.semanas.map((s) => s.evaluaciones.length), [carga.semanas]);
  const picoS = carga.pico != null ? carga.pico + 1 : null;
  const chipHoy = carga.hoy != null ? `Estás en S${carga.hoy + 1}` : "Fuera del semestre";

  if (!expandido) {
    const p = carga.proxima;
    const kicker = p ? `Próxima · ${p.dias === 0 ? "hoy" : p.dias === 1 ? "mañana" : `en ${p.dias} días`}` : null;
    return (
      <PressableScale
        scaleTo={0.985}
        onPress={toggle}
        accessibilityLabel={`Carga del semestre. ${carga.hoy != null ? `Estás en la semana ${carga.hoy + 1} de ${n}.` : ""} ${
          picoS ? `Semana más cargada: ${picoS}.` : ""
        } Expandir para ver las evaluaciones de cada semana.`}
        accessibilityState={{ expanded: false }}
        style={{ backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <AppText weight="600" style={{ fontSize: 15 }}>
            Curva del semestre
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <AppText weight="600" style={{ fontSize: 12, color: colors.textSecondary }}>
              {carga.hoy != null ? `S${carga.hoy + 1} / ${n}` : `${n} semanas`}
            </AppText>
            <AppIcon name="chevron-down" size={13} color={colors.textTertiary} />
          </View>
        </View>

        <CurvaChart carga={carga} counts={counts} sel={reposo} height={CHART_H_COLAPSADO} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            {p ? (
              <>
                <AppText weight="600" style={{ fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: colors.textTertiary }}>
                  {kicker}
                </AppText>
                <AppText weight="600" numberOfLines={1} style={{ fontSize: 14 }}>
                  {p.evaluacion.titulo}
                  {p.evaluacion.materiaNombre ? ` — ${p.evaluacion.materiaNombre}` : ""}
                </AppText>
              </>
            ) : (
              <AppText style={{ fontSize: 13, color: colors.textSecondary }}>Sin evaluaciones pendientes</AppText>
            )}
          </View>
          {picoS ? (
            <View style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.round, backgroundColor: colors.accentSoft }}>
              <AppText weight="600" style={{ fontSize: 12, color: colors.accentText }}>
                Pico S{picoS}
              </AppText>
            </View>
          ) : null}
        </View>
      </PressableScale>
    );
  }

  const semana = carga.semanas[sel]!;
  const filas = Math.min(Math.max(carga.maxCantidad, 1), FILAS_RESERVADAS_MAX);
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.xl }}>
      <View style={{ gap: spacing.xs }}>
        <PressableScale
          scaleTo={0.985}
          onPress={toggle}
          accessibilityLabel="Curva del semestre. Plegar."
          accessibilityState={{ expanded: true }}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}
        >
          <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
            Curva del semestre
          </AppText>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
            <AppIcon name="chevron-up" size={13} color={colors.textSecondary} />
          </View>
        </PressableScale>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <AppText style={{ fontSize: 13, color: colors.textSecondary, flexShrink: 1 }}>Evaluaciones por semana</AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.surfaceSoft, borderRadius: radii.round, paddingVertical: 6, paddingHorizontal: 12 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} />
            <AppText weight="600" style={{ fontSize: 12, color: colors.textBody }}>
              {chipHoy}
            </AppText>
          </View>
        </View>
      </View>

      <CurvaChart carga={carga} counts={counts} sel={sel} height={CHART_H_EXPANDIDO} interactive onSelect={setSeleccion} />

      <SemanaDetalle
        semana={semana}
        esHoy={sel === carga.hoy}
        esPico={sel === carga.pico}
        filasReservadas={filas}
        onOpen={onOpenEvaluacion}
      />

      <View style={{ flexDirection: "row", gap: spacing.smd }}>
        <Stat
          valor={picoS ? `S${picoS}` : "—"}
          label="semana más cargada"
          onPress={carga.pico != null ? () => setSeleccion(carga.pico!) : undefined}
          accessibilityLabel={picoS ? `Semana más cargada: ${picoS}. Ver esa semana.` : undefined}
        />
        <Stat
          valor={carga.libre != null ? `S${carga.libre + 1}` : "—"}
          label={carga.libre != null ? "semana libre" : "sin semanas libres"}
          onPress={carga.libre != null ? () => setSeleccion(carga.libre!) : undefined}
          accessibilityLabel={carga.libre != null ? `Próxima semana libre: ${carga.libre + 1}. Ver esa semana.` : undefined}
        />
        <Stat valor={String(carga.total)} label={carga.total === 1 ? "evaluación total" : "evaluaciones totales"} />
      </View>
    </View>
  );
}

function Stat({ valor, label, onPress, accessibilityLabel }: { valor: string; label: string; onPress?: () => void; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const Container = onPress ? PressableScale : View;
  return (
    <Container
      {...(onPress ? { onPress, scaleTo: 0.96, accessibilityLabel } : { accessible: true, accessibilityLabel: `${valor} ${label}` })}
      style={{ flex: 1, backgroundColor: colors.surfaceSofter, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: 3 }}
    >
      <AppText weight="700" style={{ fontSize: 20, letterSpacing: -0.4, lineHeight: 24 }}>
        {valor}
      </AppText>
      <AppText style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 15 }}>{label}</AppText>
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Curva
// ---------------------------------------------------------------------------

type ChartProps = {
  carga: CargaSemestre;
  counts: number[];
  sel: number;
  height: number;
  interactive?: boolean;
  onSelect?: (i: number) => void;
};

function CurvaChart({ carga, counts, sel, height, interactive = false, onSelect }: ChartProps) {
  const { colors } = useTheme();
  const n = counts.length;
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);
  const containerRef = useRef<View>(null);
  const lastRef = useRef(-1);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
    containerRef.current?.measure((_x, _y, _w, _h, pageX) => {
      pageXRef.current = pageX;
    });
  };

  const selectFromPageX = (pageX: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const i = Math.max(0, Math.min(n - 1, Math.floor(((pageX - pageXRef.current) / w) * n)));
    if (i === lastRef.current) return;
    lastRef.current = i;
    onSelectRef.current?.(i);
  };

  // Mismo criterio que RangeSlider: pageX (absoluto) medido una vez en vez de
  // locationX, que salta cuando el dedo pasa por una subvista. Tomar el toque
  // ya en el "grant" hace que un tap también seleccione. En iOS/Android el
  // ScrollView sólo arranca por arrastre vertical, así que el gesto horizontal
  // queda para la curva y el vertical sigue scrolleando la pantalla.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          lastRef.current = -1;
          selectFromPageX(e.nativeEvent.pageX);
        },
        onPanResponderMove: (e) => selectFromPageX(e.nativeEvent.pageX),
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );

  const yMax = Math.max(carga.maxCantidad, 4);
  const yBase = height - PAD_BOTTOM;
  const colW = width / n;
  const pts = useMemo(
    () => counts.map((c, i) => ({ x: (i + 0.5) * colW, y: yBase - (c / yMax) * (yBase - PAD_TOP) })),
    [counts, colW, yBase, yMax]
  );

  const accent = colors.accent;
  const hoy = carga.hoy;
  const pico = carga.pico;
  // Colapsado y sin "hoy" dentro del semestre no hay nada que marcar: sin cursor.
  const selPt = interactive || hoy != null ? pts[sel] : undefined;
  const hoyPt = hoy != null ? pts[hoy] : undefined;
  const picoPt = pico != null ? pts[pico] : undefined;
  const linea = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = pts.length ? `M${pts[0]!.x},${yBase} ${pts.map((p) => `L${p.x},${p.y}`).join(" ")} L${pts[pts.length - 1]!.x},${yBase} Z` : "";

  // Con más de 16 semanas se saltea una etiqueta por medio para que no se pisen.
  const paso = n > 16 ? 2 : 1;
  const ANCHO_PILDORA = 18;

  const a11yText = `Semana ${sel + 1}, ${plural(counts[sel] ?? 0, "evaluación", "evaluaciones")}`;
  const mover = (d: number) => {
    const i = Math.max(0, Math.min(n - 1, sel + d));
    if (i !== sel) onSelect?.(i);
  };

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      {...(interactive
        ? {
            ...pan.panHandlers,
            accessible: true,
            accessibilityRole: "adjustable" as const,
            accessibilityLabel: "Curva de carga por semana",
            accessibilityHint: "Deslizá hacia arriba o abajo para cambiar de semana",
            accessibilityValue: { text: a11yText },
            accessibilityActions: [{ name: "increment" as const }, { name: "decrement" as const }],
            onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => mover(e.nativeEvent.actionName === "increment" ? 1 : -1),
          }
        : {})}
    >
      <View style={{ height, width: "100%", pointerEvents: "none" }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[PAD_TOP, (PAD_TOP + yBase) / 2, yBase].map((y, i) => (
              <Line key={i} x1={0} x2={width} y1={y} y2={y} stroke={i === 2 ? colors.border : colors.borderFaint} strokeWidth={1} />
            ))}
            <Path d={area} fill={conAlpha(accent, 0.14)} />
            <Polyline points={linea} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {picoPt ? <Circle cx={picoPt.x} cy={picoPt.y} r={4} fill={accent} /> : null}
            {selPt ? <Line x1={selPt.x} x2={selPt.x} y1={PAD_TOP - 8} y2={yBase} stroke={colors.textGhost} strokeWidth={1} strokeDasharray="3 3" /> : null}
            {/* "Hoy" queda fijo aunque el cursor se mueva: tallo hasta la
                curva + punto lleno con aro del color de la tarjeta. */}
            {hoyPt && hoy !== sel ? (
              <>
                <Line x1={hoyPt.x} x2={hoyPt.x} y1={hoyPt.y} y2={yBase} stroke={conAlpha(accent, 0.55)} strokeWidth={1.5} />
                <Circle cx={hoyPt.x} cy={hoyPt.y} r={4.5} fill={accent} stroke={colors.surface} strokeWidth={2} />
              </>
            ) : null}
            {selPt ? <Circle cx={selPt.x} cy={selPt.y} r={3.5} fill={colors.bg} stroke={colors.text} strokeWidth={2} /> : null}
          </Svg>
        ) : null}
      </View>

      {interactive ? (
        <View style={{ flexDirection: "row", marginTop: spacing.sm, minHeight: 20, pointerEvents: "none" }}>
          {carga.semanas.map((s, i) => {
            const esHoy = i === hoy;
            const mostrar = esHoy || i === sel || s.n === 1 || s.n % paso === 0;
            return (
              <View key={s.n} style={{ width: colW || undefined, flex: colW ? undefined : 1, alignItems: "center" }}>
                {mostrar ? (
                  <View
                    style={{
                      minWidth: ANCHO_PILDORA,
                      height: 20,
                      borderRadius: 10,
                      paddingHorizontal: 2,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: esHoy ? accent : "transparent",
                    }}
                  >
                    <AppText
                      weight={esHoy || i === sel ? "700" : "600"}
                      style={{ fontSize: 11, color: esHoy ? colors.white : i === sel ? colors.text : colors.textTertiary }}
                    >
                      {s.n}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Detalle de la semana seleccionada
// ---------------------------------------------------------------------------

function SemanaDetalle({
  semana,
  esHoy,
  esPico,
  filasReservadas,
  onOpen,
}: {
  semana: SemanaCarga;
  esHoy: boolean;
  esPico: boolean;
  filasReservadas: number;
  onOpen: (id: string) => void;
}) {
  const { colors } = useTheme();
  const cant = semana.evaluaciones.length;
  return (
    <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexShrink: 1 }}>
            <AppText weight="700" style={{ fontSize: 17, letterSpacing: -0.2 }}>
              Semana {semana.n}
            </AppText>
            <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, flexShrink: 1 }}>
              {formatRangoSemana(semana.inicio, semana.fin)}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            {esHoy ? <Badge texto="Hoy" acento /> : null}
            {esPico ? <Badge texto="Pico" /> : null}
          </View>
        </View>
        <AppText style={{ fontSize: 13, color: colors.textSecondary }}>{cant ? plural(cant, "evaluación", "evaluaciones") : "Semana libre"}</AppText>
      </View>

      <View style={{ minHeight: filasReservadas * ROW_H }}>
        {semana.evaluaciones.map((e, i) => (
          <FilaEvaluacion key={e.id} e={e} primera={i === 0} onOpen={onOpen} />
        ))}
      </View>
    </View>
  );
}

function Badge({ texto, acento = false }: { texto: string; acento?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.round, backgroundColor: acento ? colors.accentSoft : colors.surfaceSoft }}>
      <AppText weight="600" style={{ fontSize: 12, color: acento ? colors.accentText : colors.textBody }}>
        {texto}
      </AppText>
    </View>
  );
}

function FilaEvaluacion({ e, primera, onOpen }: { e: EvaluacionCarga; primera: boolean; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const fecha = parseISODate(e.fecha);
  const colorId = e.colorId && e.colorId in materiaColors ? (e.colorId as keyof typeof materiaColors) : "gris";
  let estado: string;
  let estadoColor: string = colors.textTertiary;
  if (e.hecho) {
    estado = e.nota != null ? `${formatNota(e.nota)}${e.notaMaxima != null ? `/${formatNota(e.notaMaxima)}` : ""}` : "Sin nota";
    if (e.nota == null) estadoColor = colors.warningText;
  } else {
    estado = formatCountdown(e.fecha, e.hora ?? undefined, new Date());
    if (estado === "vencido") estadoColor = colors.dangerText;
  }
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => onOpen(e.id)}
      accessibilityLabel={`${e.titulo}${e.materiaNombre ? `, ${e.materiaNombre}` : ""}, ${DIAS_CORTOS[fecha.getDay()]} ${fecha.getDate()}, ${estado}`}
      style={{
        height: ROW_H,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderTopWidth: primera ? 0 : 1,
        borderTopColor: colors.borderSoft,
      }}
    >
      <View style={{ width: 3, height: 32, borderRadius: radii.round, backgroundColor: materiaColors[colorId].strong }} />
      <View style={{ width: 34, alignItems: "center" }}>
        <AppText weight="700" style={{ fontSize: 18, lineHeight: 21, letterSpacing: -0.3 }}>
          {fecha.getDate()}
        </AppText>
        <AppText weight="500" style={{ fontSize: 11, color: colors.textTertiary }}>
          {DIAS_CORTOS[fecha.getDay()]}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText weight="600" numberOfLines={1} style={{ fontSize: 15 }}>
          {e.titulo}
        </AppText>
        <AppText numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary }}>
          {[e.materiaNombre, e.hora].filter(Boolean).join(" · ")}
        </AppText>
      </View>
      <AppText mono weight="600" style={{ fontSize: 12, color: estadoColor }}>
        {estado}
      </AppText>
    </PressableScale>
  );
}
