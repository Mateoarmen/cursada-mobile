import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Animated, LayoutAnimation, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { easing, estadoLabel, estadoTone, materiaColors, motionDuration, radii, spacing, type Tone } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BackButton, BottomSheet, Pill, PressableScale, PrimaryButton, ProgressRing, RangeSlider, type AppIconName } from "@/components/ui";
import type { DemoAsistenciaRango, DemoEvaluacion, DemoMateria } from "@/data/demoContent";
import { DIAS_BLOQUE, horaTexto } from "@/lib/catalog";
import { today } from "@/lib/agenda";
import {
  calcularSimulacion,
  escalaLabel,
  formatValor,
  guardarComponentesFijos,
  materiaComputadaToRow,
  resolverPendienteSiCorresponde,
  unidad,
  type ComponenteFijoSim,
  type EvaluacionSim,
} from "@/lib/materias";
import { useAgenda } from "@/hooks/useAgenda";

function isoToday() {
  return today().toISOString().slice(0, 10);
}

function nuevoIdLocal() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type RangoAsistencia = "semana" | "mes" | "semestre";

function materiaAbrev(nombre: string) {
  return (nombre.trim().split(/\s+/)[0] ?? "").slice(0, 4).toUpperCase();
}

// Callout de estado de aprobación — puerto directo de las 5 ramas de
// renderDetalle() (runtime.js): aprobada / debe-rendir-examen / sin-notas /
// vas-aprobando(-raspando) / te-faltan-X.
function calloutDe(m: DemoMateria): { titulo: string; texto: string } {
  // "count" son notas YA CARGADAS (evaluaciones con estado "aprobada"), no
  // el total de ítems — de ahí depende si dice "Debés rendir examen" /
  // "Todavía no cargaste notas" y el "con N notas cargadas" del texto.
  const count = m.evaluaciones.filter((e) => e.estado === "aprobada").length;
  const aprobTxt = `${formatValor(m.escalaAprob, m.escalaTipo)}${unidad(m.escalaTipo)}`;
  const exonTxt = m.escalaExon != null ? `${formatValor(m.escalaExon, m.escalaTipo)}${unidad(m.escalaTipo)}` : null;
  const escalaTxt = escalaLabel(m.escalaTipo, m.escalaTotal).toLowerCase();
  const totalTxt = `${formatValor(m.escalaTotal, m.escalaTipo)}${unidad(m.escalaTipo)}`;

  if (m.estado === "aprobada") {
    return { titulo: "Ya aprobaste esta materia", texto: `Se calificó por ${escalaTxt} sobre ${totalTxt} y aprobaba con ${aprobTxt}.` };
  }
  if (m.estado === "pendiente" && !count) {
    return {
      titulo: "Debés rendir examen",
      texto: `Cursaste esta materia pero todavía te falta el examen. El examen aprueba con ${aprobTxt}. Cargá la nota con "Cargar nota" — si llega al mínimo, la materia pasa a Aprobada sola.`,
    };
  }
  if (!count) {
    return {
      titulo: "Todavía no cargaste notas",
      texto: `Esta materia se califica por ${escalaTxt} sobre ${totalTxt} y aprueba con ${aprobTxt}.${exonTxt ? ` Exonera con ${exonTxt}.` : ""} Agregá tu primer parcial para ver la proyección.`,
    };
  }
  if (m.promedio >= m.escalaAprob) {
    return {
      titulo: m.tone === "warning" ? "Vas aprobando, pero raspando" : "Vas aprobando esta materia",
      texto: `Esta materia se califica por ${escalaTxt} sobre ${totalTxt} y aprueba con ${aprobTxt}. Con ${count} ${count === 1 ? "nota cargada" : "notas cargadas"} tu promedio es ${formatValor(m.promedio, m.escalaTipo)}${unidad(m.escalaTipo)}, por encima del mínimo.`,
    };
  }
  const necesita = `${formatValor(m.escalaAprob - m.promedio, m.escalaTipo)}${unidad(m.escalaTipo)}`;
  return {
    titulo: `Te faltan ${necesita} para llegar a la aprobación`,
    texto: `Esta materia se califica por ${escalaTxt} sobre ${totalTxt} y aprueba con ${aprobTxt}. Con ${count} ${count === 1 ? "nota cargada" : "notas cargadas"} tu promedio es ${formatValor(m.promedio, m.escalaTipo)}${unidad(m.escalaTipo)}, así que te faltan ${necesita} para llegar al mínimo.`,
  };
}

function Card({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  // `compact` — usado en la sección de menor densidad/importancia (Mini
  // horario) para que no pese lo mismo que Calificación/Evaluaciones (ver
  // critique P2). Sigue sin sombra/borde — la única diferenciación
  // permitida en el sistema "flat" es padding/radio, no elevación.
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: compact ? radii.md : radii.lg,
        padding: compact ? spacing.lg : spacing.xl,
        gap: spacing.lg,
      }}
    >
      {children}
    </View>
  );
}

const CALLOUT_ICON: Record<Tone, AppIconName> = {
  success: "checkmark-circle-outline",
  warning: "alert-circle-outline",
  danger: "close-circle-outline",
  neutral: "information-circle-outline",
};

// El veredicto de aprobación (calloutDe) es el dato más importante de toda
// la pantalla — antes vivía como un párrafo más adentro de la Card de
// Calificación, con el mismo peso visual que cualquier otro bloque (ver
// critique P0). Ahora es su propio contenedor, fuera de la Card, con
// ícono + tipografía de título — sigue sin sombra/glass (el sistema flat
// no cambia), la distinción es de tamaño/posición, no de elevación.
function Callout({ tone: t, titulo, texto }: { tone: Tone; titulo: string; texto: string }) {
  const { colors, tone } = useTheme();
  const c = tone[t];
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        alignItems: "flex-start",
        padding: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: c.soft,
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: radii.sm, backgroundColor: c.strong + "26", alignItems: "center", justifyContent: "center" }}>
        <AppIcon name={CALLOUT_ICON[t]} size={17} color={c.text} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText weight="700" style={{ fontSize: 18, letterSpacing: -0.3, lineHeight: 23 }}>
          {titulo}
        </AppText>
        <AppText style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 }}>{texto}</AppText>
      </View>
    </View>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
        {children}
      </AppText>
      {hint ? (
        <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export default function MateriaDetalleScreen() {
  const { colors, tone } = useTheme();
  const { id, evaluacionId } = useLocalSearchParams<{ id: string; evaluacionId?: string }>();
  const [supaMateria, setSupaMateria] = useState<Materia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [simuladorAbierto, setSimuladorAbierto] = useState(false);
  const [valoresSimulados, setValoresSimulados] = useState<Record<string, number>>({});
  const [rangoAsistencia, setRangoAsistencia] = useState<RangoAsistencia>("semana");
  const [cargarNotaAbierto, setCargarNotaAbierto] = useState(false);
  const [notaInputs, setNotaInputs] = useState<Record<string, string>>({});
  const [accionItem, setAccionItem] = useState<DemoEvaluacion | null>(null);
  const [editarNotaItem, setEditarNotaItem] = useState<DemoEvaluacion | null>(null);
  const abrioNotaDesdeParamRef = useRef(false);
  const [editarNotaValor, setEditarNotaValor] = useState("");
  const [agregarFijoAbierto, setAgregarFijoAbierto] = useState(false);
  const [agregarFijoTitulo, setAgregarFijoTitulo] = useState("");
  const [agregarFijoPuntaje, setAgregarFijoPuntaje] = useState("");
  const [cargarFijoItem, setCargarFijoItem] = useState<{ id: string; titulo: string; puntajeMax: number; valor: number | null } | null>(null);
  const [cargarFijoValor, setCargarFijoValor] = useState("");
  const [crearItemTipo, setCrearItemTipo] = useState<"evaluacion" | "tarea" | null>(null);
  const [crearItemTitulo, setCrearItemTitulo] = useState("");
  // Rotación del chevron de "Simular escenario" (0 = cerrado, 1 = abierto,
  // --ease-in-out portado — "algo que se mueve en pantalla"). El panel en
  // sí anima su aparición/desaparición vía LayoutAnimation (ver
  // toggleSimulador), no con este valor — RN no anima alto/opacidad de un
  // layout condicional sin medir manualmente, LayoutAnimation lo resuelve
  // gratis para este caso (antes no había ninguna transición, ver
  // critique P1).
  const chevronRotate = useRef(new Animated.Value(0)).current;

  const fetchMateria = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("materias").select("*").eq("id", id).maybeSingle();
    setSupaMateria(data ?? null);
    setCargando(false);
  }, [id]);

  // Refetch al enfocar (no sólo al montar) para que la edición hecha en
  // app/materia/form.tsx (o el auto-pasaje a "aprobada" de
  // resolverPendienteSiCorresponde, ver guardarNotas) se refleje acá al
  // volver, desde la respuesta real.
  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      fetchMateria();
    }, [fetchMateria])
  );

  // "Evaluaciones y tareas" lee/escribe la misma tabla real `agenda` que
  // Agenda (ver src/hooks/useAgenda.ts), acotada a esta materia — sin
  // fallback a datos de muestra: una materia real sin evaluaciones
  // cargadas todavía se ve vacía, no con notas de otra materia.
  const agenda = useAgenda(id);

  // Se resetea si cambia de materia.
  useEffect(() => {
    setValoresSimulados({});
    setSimuladorAbierto(false);
  }, [id]);

  // Réplica de computeMateriaById (runtime.js): esc/tone/promedio ya
  // calculados con paridad exacta a la web (ver materiaComputadaToRow en
  // lib/materias.ts) — el viejo `toRow()` + demoMaterias.find(...) como
  // fallback quedó eliminado, tapaba tanto la falta de cálculo real como
  // una materia inexistente/todavía-cargando con datos de muestra.
  const materia = useMemo<DemoMateria | null>(() => (supaMateria ? materiaComputadaToRow(supaMateria, agenda.rows ?? []) : null), [supaMateria, agenda.rows]);

  // Llegada desde el widget "Esperando nota" de Inicio (?evaluacionId=...)
  // — abre directo el sheet de cargar/editar nota en vez de dejar al
  // usuario buscar la fila. Sólo una vez por navegación (el ref evita
  // reabrirlo en cada refetch de foco mientras el sheet ya está abierto o
  // el usuario lo cerró).
  useEffect(() => {
    if (!materia || !evaluacionId || abrioNotaDesdeParamRef.current) return;
    const item = materia.evaluaciones.find((e) => e.id === evaluacionId);
    if (item) {
      abrioNotaDesdeParamRef.current = true;
      setEditarNotaValor(String(item.nota ?? ""));
      setEditarNotaItem(item);
    }
  }, [materia, evaluacionId]);

  if (!materia) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
          {cargando ? <ActivityIndicator color={colors.textTertiary} /> : <AppText style={{ fontSize: 14, color: colors.textTertiary }}>No se encontró la materia.</AppText>}
        </View>
      </SafeAreaView>
    );
  }

  const evaluaciones = materia.evaluaciones;
  const accent = materiaColors[materia.colorId];

  const evaluacionesSim: EvaluacionSim[] = evaluaciones.map((e) => ({
    id: e.id,
    notaMaxima: e.notaMax,
    nota: e.estado === "aprobada" ? e.nota ?? null : null,
  }));
  const componentesFijosSim: ComponenteFijoSim[] = materia.componentesFijos.map((c) => ({ id: c.id, puntajeMax: c.puntajeMax, valor: c.valor }));
  const sim = calcularSimulacion({ total: materia.escalaTotal, aprob: materia.escalaAprob, exoneracion: materia.escalaExon ?? null }, evaluacionesSim, valoresSimulados, componentesFijosSim);

  // Anillo de "Calificación y aprobación": mismo promedio/tone que
  // Materias (ver computeMateria en lib/materias.ts), ya calculados en
  // `materia` — no una proyección con los sliders del simulador de abajo.
  const t = tone[materia.tone];
  const notaTxt = materia.promedio > 0 ? formatValor(materia.promedio, materia.escalaTipo) : "—";
  const pct = materia.escalaTotal > 0 ? Math.max(0, Math.min(1, materia.promedio / materia.escalaTotal)) : 0;
  const callout = calloutDe(materia);

  const evaluacionesSinNota = evaluaciones.filter((e) => e.estado === "pendiente");
  const fijosSinValor = materia.componentesFijos.filter((c) => c.valor == null);
  const haySimulable = evaluacionesSinNota.length > 0 || fijosSinValor.length > 0;
  const simPct = sim.total > 0 ? Math.max(0, Math.min(1, sim.puntosProyectados / sim.total)) : 0;
  const simTone: Tone = sim.asegurado ? "success" : sim.imposible ? "danger" : sim.faltanAprobacion === 0 ? "success" : "warning";

  const notasList = evaluaciones.filter((e) => e.estado === "aprobada");

  const pendientesEvals = evaluaciones.filter((e) => e.estado === "pendiente");
  const completadasEvals = evaluaciones.filter((e) => e.estado === "aprobada");

  const bloquesPorDia = new Map(materia.bloques.map((b) => [b.dia, b]));
  const asistenciaActual: DemoAsistenciaRango | null = materia.asistencia ? materia.asistencia[rangoAsistencia] : null;

  const stub = (titulo: string) => Alert.alert(titulo, "Esta acción llega en una próxima iteración.");
  const avisarError = (titulo: string) => Alert.alert(titulo, "Revisá tu conexión e intentá de nuevo.");

  const toggleSimulador = () => {
    const next = !simuladorAbierto;
    LayoutAnimation.configureNext({
      duration: motionDuration.layout,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setSimuladorAbierto(next);
    Animated.timing(chevronRotate, { toValue: next ? 1 : 0, duration: motionDuration.routine, easing: easing.inOut, useNativeDriver: true }).start();
  };

  const abrirCargarNota = () => {
    if (!pendientesEvals.length) {
      stub("Cargar nota");
      return;
    }
    setNotaInputs({});
    setCargarNotaAbierto(true);
  };

  const guardarNotas = async () => {
    const cambios = pendientesEvals
      .map((e) => {
        const raw = notaInputs[e.id];
        if (!raw || !raw.trim()) return null;
        const n = Math.max(0, Math.min(e.notaMax, Number(raw.replace(",", "."))));
        return Number.isNaN(n) ? null : { id: e.id, n };
      })
      .filter((x): x is { id: string; n: number } => x !== null);

    if (!cambios.length) {
      setCargarNotaAbierto(false);
      return;
    }

    const resultados = await Promise.all(cambios.map((c) => agenda.asignarNota(c.id, c.n)));
    setCargarNotaAbierto(false);
    if (resultados.some((ok) => !ok)) {
      avisarError("No se pudieron guardar algunas notas");
      return;
    }

    // "Debo rendir examen": si la nota recién cargada llega al mínimo fijo
    // del examen, la materia pasa a "aprobada" sola (ver
    // resolverPendienteSiCorresponde en lib/materias.ts) — sólo aplica a la
    // primera nota cambiada, que es el caso real (una materia "pendiente"
    // normalmente tiene un solo examen por rendir a la vez).
    if (supaMateria && supaMateria.estado === "pendiente" && cambios[0]) {
      const resultado = await resolverPendienteSiCorresponde(supaMateria, cambios[0].n);
      if (resultado) {
        Alert.alert(resultado.promovida ? "¡Aprobada!" : "Nota cargada", resultado.mensaje);
        if (resultado.promovida) fetchMateria();
      }
    }
  };

  const guardarNotaEditada = async () => {
    if (!editarNotaItem) return;
    const raw = editarNotaValor.trim();
    if (!raw) return;
    const n = Math.max(0, Math.min(editarNotaItem.notaMax, Number(raw.replace(",", "."))));
    if (Number.isNaN(n)) return;
    const ok = await agenda.asignarNota(editarNotaItem.id, n);
    if (!ok) {
      avisarError("No se pudo guardar la nota");
      return;
    }
    setEditarNotaItem(null);
  };

  const abrirAgregarFijo = () => {
    setAgregarFijoTitulo("");
    setAgregarFijoPuntaje("");
    setAgregarFijoAbierto(true);
  };

  const confirmarAgregarFijo = async () => {
    if (!supaMateria) return;
    const titulo = agregarFijoTitulo.trim();
    const puntajeMax = Number(agregarFijoPuntaje.replace(",", "."));
    if (!titulo || !Number.isFinite(puntajeMax) || puntajeMax <= 0) return;
    const existentes = supaMateria.componentes_fijos ?? [];
    const actualizados = [...existentes, { id: nuevoIdLocal(), titulo, puntajeMax, valor: null }];
    try {
      const data = await guardarComponentesFijos(supaMateria.id, actualizados);
      setSupaMateria(data);
      setAgregarFijoAbierto(false);
    } catch {
      avisarError("No se pudo agregar el punto fijo");
    }
  };

  const abrirCargarFijo = (c: { id: string; titulo: string; puntajeMax: number; valor: number | null }) => {
    setCargarFijoValor(c.valor != null ? String(c.valor) : "");
    setCargarFijoItem(c);
  };

  const confirmarCargarFijo = async () => {
    if (!supaMateria || !cargarFijoItem) return;
    const raw = cargarFijoValor.trim();
    const valor = raw ? Math.max(0, Math.min(cargarFijoItem.puntajeMax, Number(raw.replace(",", ".")))) : null;
    if (raw && Number.isNaN(valor)) return;
    const existentes = supaMateria.componentes_fijos ?? [];
    const actualizados = existentes.map((c) => (c.id === cargarFijoItem.id ? { ...c, valor } : c));
    try {
      const data = await guardarComponentesFijos(supaMateria.id, actualizados);
      setSupaMateria(data);
      setCargarFijoItem(null);
    } catch {
      avisarError("No se pudo guardar el punto fijo");
    }
  };

  const abrirCrearItem = (tipo: "evaluacion" | "tarea") => {
    setCrearItemTitulo("");
    setCrearItemTipo(tipo);
  };

  const confirmarCrearItem = async () => {
    if (!crearItemTipo || !crearItemTitulo.trim()) return;
    const tipo = crearItemTipo === "evaluacion" ? "Parcial" : "Entrega";

    const ok = await agenda.crear({
      materiaId: materia.id,
      kind: crearItemTipo,
      tipo,
      titulo: crearItemTitulo.trim(),
      fecha: isoToday(),
      notaMaxima: crearItemTipo === "evaluacion" ? materia.escalaTotal : null,
    });
    if (!ok) {
      avisarError("No se pudo crear");
      return;
    }
    setCrearItemTipo(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <BackButton />
          <View
            style={{ width: 40, height: 40, borderRadius: radii.sm, backgroundColor: accent.strong, alignItems: "center", justifyContent: "center" }}
          >
            <AppText weight="600" style={{ fontSize: 12, color: colors.white }}>
              {materiaAbrev(materia.nombre)}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <AppText weight="600" numberOfLines={1} style={{ fontSize: 18, letterSpacing: -0.2, flexShrink: 1 }}>
                {materia.nombre}
              </AppText>
              <Pill label={estadoLabel[materia.estado]} background={tone[estadoTone[materia.estado]].soft} color={tone[estadoTone[materia.estado]].text} />
            </View>
            <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
              {materia.docente} · {escalaLabel(materia.escalaTipo, materia.escalaTotal).toLowerCase()}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.xxxl }}>
          <View style={{ gap: 1 }}>
            <AppText style={{ fontSize: 11, color: colors.textFaint }}>Salón</AppText>
            <AppText mono weight="600" style={{ fontSize: 13 }}>
              {materia.salon || "Sin salón asignado"}
            </AppText>
          </View>
          <View style={{ gap: 1 }}>
            <AppText style={{ fontSize: 11, color: colors.textFaint }}>Cursada</AppText>
            <AppText mono weight="600" style={{ fontSize: 13 }}>
              {materia.periodoLabel}
            </AppText>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <PressableScale scaleTo={0.97} onPress={() => (supaMateria ? router.push(`/materia/form?id=${supaMateria.id}`) : stub("Editar materia"))}>
            <Pill label="Editar materia" background={colors.surfaceSoft} style={{ height: 34, paddingHorizontal: 14 }} />
          </PressableScale>
          <PressableScale scaleTo={0.97} onPress={() => abrirCrearItem("tarea")}>
            <Pill label="+ Nueva tarea" background={colors.surfaceSoft} style={{ height: 34, paddingHorizontal: 14 }} />
          </PressableScale>
          <PressableScale scaleTo={0.97} onPress={() => abrirCrearItem("evaluacion")}>
            <Pill label="+ Nueva evaluación" background={colors.accent} color={colors.white} style={{ height: 34, paddingHorizontal: 14 }} />
          </PressableScale>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Veredicto de aprobación — fuera de la Card, es el dato más
            importante de la pantalla (ver critique P0). */}
        <Callout tone={materia.tone} titulo={callout.titulo} texto={callout.texto} />

        {/* Calificación y aprobación */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
              Calificación y aprobación
            </AppText>
            <Pill label={escalaLabel(materia.escalaTipo, materia.escalaTotal)} background={colors.surfaceSoft} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
            <ProgressRing
              size={104}
              strokeWidth={11}
              progress={pct}
              color={t.strong}
              centerValue={notaTxt}
              centerLabel={`aprueba ${formatValor(materia.escalaAprob, materia.escalaTipo)}${unidad(materia.escalaTipo)}`}
              valueFontSize={26}
              labelFontSize={11}
            />
            <View style={{ flex: 1, gap: spacing.sm }}>
              {notasList.length ? (
                notasList.map((e) => (
                  <View key={e.id} style={{ gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                        {e.nombre}
                      </AppText>
                      <AppText mono weight="600" style={{ fontSize: 13 }}>
                        {formatValor(e.nota ?? 0, materia.escalaTipo)}
                        {unidad(materia.escalaTipo)}
                      </AppText>
                    </View>
                    <View style={{ height: 4, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
                      <View style={{ width: `${((e.nota ?? 0) / e.notaMax) * 100}%`, height: "100%", borderRadius: radii.round, backgroundColor: t.strong }} />
                    </View>
                  </View>
                ))
              ) : (
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Todavía no cargaste notas.</AppText>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.smd }}>
            <PrimaryButton label="Cargar nota" flex onPress={abrirCargarNota} />
            <PrimaryButton label="Cambiar escala" variant="ghost" flex onPress={() => stub("Cambiar escala y aprobación")} />
          </View>

          <View style={{ gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderFaint }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText weight="600" style={{ fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.textFaint }}>
                Puntos fijos del curso
              </AppText>
              <PressableScale scaleTo={0.95} onPress={abrirAgregarFijo} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <AppIcon name="add-circle-outline" size={16} color={colors.accentText} />
                <AppText weight="600" style={{ fontSize: 12, color: colors.accentText }}>
                  Agregar
                </AppText>
              </PressableScale>
            </View>
            <AppText style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 16 }}>
              No tienen fecha ni son una tarea — cargalos vos cuando el profesor te los dé (asistencia, entregas, participación).
            </AppText>
            {materia.componentesFijos.length ? (
              materia.componentesFijos.map((c) => (
                <PressableScale
                  key={c.id}
                  scaleTo={0.99}
                  onPress={() => abrirCargarFijo(c)}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 }}
                >
                  <AppText style={{ fontSize: 13, color: colors.textSecondary }}>{c.titulo}</AppText>
                  {c.valor != null ? (
                    <AppText mono weight="600" style={{ fontSize: 13 }}>
                      {c.valor}/{c.puntajeMax}
                    </AppText>
                  ) : (
                    <Pill label="Cargar valor" color={colors.accentText} background={colors.accentSoft} />
                  )}
                </PressableScale>
              ))
            ) : (
              <AppText style={{ fontSize: 12, color: colors.textFaint }}>Todavía no cargaste ninguno.</AppText>
            )}
          </View>

          {haySimulable ? (
            <PressableScale scaleTo={0.98} onPress={toggleSimulador} accessibilityState={{ expanded: simuladorAbierto }}>
              <View
                style={{
                  height: 40,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: spacing.sm,
                }}
              >
                <AppIcon name="options-outline" size={15} color={colors.text} />
                <AppText weight="600" style={{ fontSize: 13 }}>
                  Simular escenario
                </AppText>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: chevronRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }),
                      },
                    ],
                  }}
                >
                  <AppIcon name="chevron-down" size={15} color={colors.textTertiary} />
                </Animated.View>
              </View>
            </PressableScale>
          ) : null}

          {haySimulable && simuladorAbierto ? (
            <View style={{ gap: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderFaint }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
                <ProgressRing size={64} strokeWidth={7} progress={simPct} color={tone[simTone].strong} centerValue={formatValor(sim.puntosProyectados, materia.escalaTipo)} valueFontSize={14} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Pill label="Simulado" background={colors.accentSofter} color={colors.accentText} style={{ height: 20, paddingHorizontal: 8 }} />
                  <AppText style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                    {sim.asegurado
                      ? "Ya asegurada la aprobación con lo que ya tenés, pase lo que pase en el resto."
                      : sim.imposible
                        ? "Con lo que ya tenés y lo máximo que falta, ya no es matemáticamente posible aprobar."
                        : sim.faltanAprobacion === 0
                          ? `Con este escenario, llegás a ${formatValor(sim.puntosProyectados, materia.escalaTipo)}${unidad(materia.escalaTipo)} — aprobarías.`
                          : `Con este escenario, te faltan ${formatValor(sim.faltanAprobacion ?? 0, materia.escalaTipo)}${unidad(materia.escalaTipo)} para aprobar (${formatValor(sim.aprob, materia.escalaTipo)}${unidad(materia.escalaTipo)}).`}
                  </AppText>
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>Puntos reales</AppText>
                  <AppText mono weight="600" style={{ fontSize: 14 }}>
                    {formatValor(sim.puntosReales, materia.escalaTipo)}
                    {unidad(materia.escalaTipo)}
                  </AppText>
                </View>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>Disponibles</AppText>
                  <AppText mono weight="600" style={{ fontSize: 14 }}>
                    {formatValor(sim.disponibles, materia.escalaTipo)}
                    {unidad(materia.escalaTipo)}
                  </AppText>
                </View>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>Proyectado</AppText>
                  <AppText mono weight="600" style={{ fontSize: 14 }}>
                    {formatValor(sim.puntosProyectados, materia.escalaTipo)}/{formatValor(sim.total, materia.escalaTipo)}
                  </AppText>
                </View>
              </View>

              {sim.asegurado ? (
                <Aviso tone="success" texto="Aprobación asegurada con lo que ya tenés." />
              ) : sim.imposible ? (
                <Aviso tone="danger" texto={`Objetivo imposible: incluso sacando el máximo en todo lo que falta, no se llega a ${formatValor(sim.aprob, materia.escalaTipo)}${unidad(materia.escalaTipo)}.`} />
              ) : sim.promedioNecesario != null ? (
                <Aviso tone="warning" texto={`Necesitás promediar ${formatValor(sim.promedioNecesario, materia.escalaTipo)}${unidad(materia.escalaTipo)} en las evaluaciones que faltan para llegar al mínimo.`} />
              ) : null}

              {sim.exoneracion != null ? (
                sim.exonerado ? (
                  <Aviso tone="success" texto={`Exoneración asegurada con lo que ya tenés (${formatValor(sim.exoneracion, materia.escalaTipo)}${unidad(materia.escalaTipo)}).`} />
                ) : sim.imposibleExonerar ? (
                  <Aviso tone="danger" texto={`Exonerar ya no es matemáticamente posible: no se llega a ${formatValor(sim.exoneracion, materia.escalaTipo)}${unidad(materia.escalaTipo)}.`} />
                ) : (
                  <Aviso tone="warning" texto={`Con este escenario, te faltan ${formatValor(sim.faltanExoneracion ?? 0, materia.escalaTipo)}${unidad(materia.escalaTipo)} para exonerar (${formatValor(sim.exoneracion, materia.escalaTipo)}${unidad(materia.escalaTipo)}).`} />
                )
              ) : null}

              <View style={{ gap: spacing.lg }}>
                {evaluacionesSinNota.map((e) => (
                  <View key={e.id} style={{ gap: spacing.sm - 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                        {e.nombre}
                      </AppText>
                      <AppText mono weight="600" style={{ fontSize: 13 }}>
                        {formatValor(valoresSimulados[e.id] ?? 0, materia.escalaTipo)}/{formatValor(e.notaMax, materia.escalaTipo)}
                      </AppText>
                    </View>
                    <RangeSlider max={e.notaMax} value={valoresSimulados[e.id] ?? 0} color={t.strong} onChange={(v) => setValoresSimulados((prev) => ({ ...prev, [e.id]: v }))} />
                  </View>
                ))}
                {fijosSinValor.map((c) => (
                  <View key={c.id} style={{ gap: spacing.sm - 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                        {c.titulo}
                      </AppText>
                      <AppText mono weight="600" style={{ fontSize: 13 }}>
                        {formatValor(valoresSimulados[c.id] ?? 0, materia.escalaTipo)}/{formatValor(c.puntajeMax, materia.escalaTipo)}
                      </AppText>
                    </View>
                    <RangeSlider max={c.puntajeMax} value={valoresSimulados[c.id] ?? 0} color={t.strong} onChange={(v) => setValoresSimulados((prev) => ({ ...prev, [c.id]: v }))} />
                  </View>
                ))}
              </View>

              {sim.escalaInconsistente ? (
                <AppText style={{ fontSize: 11, color: colors.textFaint, lineHeight: 15 }}>
                  Ojo: la suma de notas máximas de las evaluaciones no coincide con el total de la materia ({formatValor(materia.escalaTotal, materia.escalaTipo)}
                  {unidad(materia.escalaTipo)}).
                </AppText>
              ) : null}

              <PressableScale scaleTo={0.97} onPress={() => setValoresSimulados({})}>
                <AppText weight="600" style={{ fontSize: 13, color: colors.accentText, textAlign: "center" }}>
                  Reiniciar simulación
                </AppText>
              </PressableScale>
            </View>
          ) : null}
        </Card>

        {/* Evaluaciones y tareas */}
        <Card>
          <SectionTitle hint={`${evaluaciones.length} ${evaluaciones.length === 1 ? "ítem" : "ítems"}`}>Evaluaciones y tareas</SectionTitle>
          {pendientesEvals.length === 0 && completadasEvals.length === 0 ? (
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Todavía no hay evaluaciones ni tareas para esta materia.</AppText>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {pendientesEvals.map((e) => (
                <EvalRow key={e.id} item={e} materia={materia} onPress={() => setAccionItem(e)} />
              ))}
              {completadasEvals.map((e) => (
                <EvalRow key={e.id} item={e} materia={materia} onPress={() => setAccionItem(e)} />
              ))}
            </View>
          )}
        </Card>

        {/* Mini horario semanal — compact: la sección de menor densidad de
            las 4 (ver critique P2), no debe pesar lo mismo que Calificación
            o Evaluaciones. */}
        <Card compact>
          <SectionTitle>Mini horario de la materia</SectionTitle>
          <View style={{ flexDirection: "row", gap: spacing.sm - 2 }}>
            {DIAS_BLOQUE.map((label, i) => {
              const b = bloquesPorDia.get(i + 1);
              return (
                <View key={label} style={{ flex: 1, gap: 4, alignItems: "center" }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>{label}</AppText>
                  <View
                    style={{
                      width: "100%",
                      height: 54,
                      borderRadius: radii.sm - 2,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: b ? accent.soft : colors.surfaceSofter,
                    }}
                  >
                    {b ? (
                      <AppText mono weight="600" style={{ fontSize: 10, color: accent.strong, textAlign: "center" }}>
                        {horaTexto(b.ini)}
                        {"\n"}
                        {horaTexto(b.fin)}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Asistencia */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
              Asistencia
            </AppText>
            <View style={{ flexDirection: "row", backgroundColor: colors.surfaceSofter, borderRadius: radii.sm, padding: 3, gap: 2 }}>
              {(["semana", "mes", "semestre"] as RangoAsistencia[]).map((r) => (
                <PressableScale
                  key={r}
                  scaleTo={0.97}
                  onPress={() => setRangoAsistencia(r)}
                  style={{
                    height: 28,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: rangoAsistencia === r ? colors.text : "transparent",
                  }}
                >
                  <AppText weight={rangoAsistencia === r ? "600" : "500"} style={{ fontSize: 12, color: rangoAsistencia === r ? colors.bg : colors.textSecondary, textTransform: "capitalize" }}>
                    {r}
                  </AppText>
                </PressableScale>
              ))}
            </View>
          </View>
          {asistenciaActual ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
              <AppText mono weight="700" style={{ fontSize: 22 }}>
                {asistenciaActual.pct}%
              </AppText>
              <AppText style={{ fontSize: 13, color: colors.textSecondary }}>
                {asistenciaActual.presentes}/{asistenciaActual.total} clases
              </AppText>
            </View>
          ) : (
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Sin registros de asistencia en este rango.</AppText>
          )}
        </Card>
      </ScrollView>

      {/* Cargar nota */}
      <BottomSheet visible={cargarNotaAbierto} onClose={() => setCargarNotaAbierto(false)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Cargar nota
        </AppText>
        <View style={{ gap: spacing.md }}>
          {pendientesEvals.map((e) => (
            <View key={e.id} style={{ gap: 6 }}>
              <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                {e.nombre}
              </AppText>
              <TextInput
                value={notaInputs[e.id] ?? ""}
                onChangeText={(v) => setNotaInputs((prev) => ({ ...prev, [e.id]: v }))}
                placeholder={`Nota sobre ${e.notaMax}`}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                style={{
                  height: 46,
                  borderRadius: radii.sm,
                  backgroundColor: colors.bg,
                  paddingHorizontal: spacing.lg,
                  fontSize: 15,
                  color: colors.text,
                  fontFamily: "InstrumentSans_600SemiBold",
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setCargarNotaAbierto(false)} />
          <PrimaryButton label="Guardar" flex onPress={guardarNotas} />
        </View>
      </BottomSheet>

      {/* Editar nota */}
      <BottomSheet visible={!!editarNotaItem} onClose={() => setEditarNotaItem(null)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Editar nota
        </AppText>
        {editarNotaItem ? (
          <View style={{ gap: 6 }}>
            <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
              {editarNotaItem.nombre}
            </AppText>
            <TextInput
              value={editarNotaValor}
              onChangeText={setEditarNotaValor}
              placeholder={`Nota sobre ${editarNotaItem.notaMax}`}
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              autoFocus
              style={{
                height: 46,
                borderRadius: radii.sm,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.lg,
                fontSize: 15,
                color: colors.text,
                fontFamily: "InstrumentSans_600SemiBold",
              }}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setEditarNotaItem(null)} />
          <PrimaryButton label="Guardar" flex disabled={!editarNotaValor.trim()} onPress={guardarNotaEditada} />
        </View>
      </BottomSheet>

      {/* Agregar punto fijo */}
      <BottomSheet visible={agregarFijoAbierto} onClose={() => setAgregarFijoAbierto(false)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Agregar punto fijo
        </AppText>
        <AppText style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 16 }}>
          Puntaje que suma a la nota final pero no depende de una evaluación — asistencia, entregas, participación.
        </AppText>
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: 6 }}>
            <AppText style={{ fontSize: 13, color: colors.textSecondary }}>Título</AppText>
            <TextInput
              value={agregarFijoTitulo}
              onChangeText={setAgregarFijoTitulo}
              placeholder="Ej. Asistencia"
              placeholderTextColor={colors.textFaint}
              autoFocus
              style={{
                height: 46,
                borderRadius: radii.sm,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.lg,
                fontSize: 15,
                color: colors.text,
                fontFamily: "InstrumentSans_400Regular",
              }}
            />
          </View>
          <View style={{ gap: 6 }}>
            <AppText style={{ fontSize: 13, color: colors.textSecondary }}>Puntaje máximo</AppText>
            <TextInput
              value={agregarFijoPuntaje}
              onChangeText={setAgregarFijoPuntaje}
              placeholder="Ej. 10"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              style={{
                height: 46,
                borderRadius: radii.sm,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.lg,
                fontSize: 15,
                color: colors.text,
                fontFamily: "InstrumentSans_600SemiBold",
              }}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setAgregarFijoAbierto(false)} />
          <PrimaryButton
            label="Agregar"
            flex
            disabled={!agregarFijoTitulo.trim() || !Number(agregarFijoPuntaje.replace(",", ".")) || Number(agregarFijoPuntaje.replace(",", ".")) <= 0}
            onPress={confirmarAgregarFijo}
          />
        </View>
      </BottomSheet>

      {/* Cargar / editar valor de un punto fijo */}
      <BottomSheet visible={!!cargarFijoItem} onClose={() => setCargarFijoItem(null)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          {cargarFijoItem?.valor != null ? "Editar valor" : "Cargar valor"}
        </AppText>
        {cargarFijoItem ? (
          <View style={{ gap: 6 }}>
            <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
              {cargarFijoItem.titulo}
            </AppText>
            <TextInput
              value={cargarFijoValor}
              onChangeText={setCargarFijoValor}
              placeholder={`Valor sobre ${cargarFijoItem.puntajeMax}`}
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              autoFocus
              style={{
                height: 46,
                borderRadius: radii.sm,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.lg,
                fontSize: 15,
                color: colors.text,
                fontFamily: "InstrumentSans_600SemiBold",
              }}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setCargarFijoItem(null)} />
          <PrimaryButton label="Guardar" flex onPress={confirmarCargarFijo} />
        </View>
      </BottomSheet>

      {/* Nueva evaluación / tarea */}
      <BottomSheet visible={!!crearItemTipo} onClose={() => setCrearItemTipo(null)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          {crearItemTipo === "evaluacion" ? "Nueva evaluación" : "Nueva tarea"}
        </AppText>
        <TextInput
          value={crearItemTitulo}
          onChangeText={setCrearItemTitulo}
          placeholder="Título"
          placeholderTextColor={colors.textFaint}
          style={{
            height: 48,
            borderRadius: radii.sm,
            backgroundColor: colors.bg,
            paddingHorizontal: spacing.lg,
            fontSize: 15,
            color: colors.text,
            fontFamily: "InstrumentSans_400Regular",
          }}
        />
        <AppText style={{ fontSize: 12, color: colors.textFaint }}>Se agenda para hoy — la fecha se podrá elegir en la próxima iteración.</AppText>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setCrearItemTipo(null)} />
          <PrimaryButton label="Crear" flex disabled={!crearItemTitulo.trim()} onPress={confirmarCrearItem} />
        </View>
      </BottomSheet>

      {/* Acciones de fila */}
      <BottomSheet visible={!!accionItem} onClose={() => setAccionItem(null)}>
        <AppText weight="600" style={{ fontSize: 17 }} numberOfLines={1}>
          {accionItem?.nombre}
        </AppText>
        {accionItem && accionItem.estado === "pendiente" ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              setNotaInputs({});
              setCargarNotaAbierto(true);
              setAccionItem(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
          >
            <AppIcon name="checkmark-circle-outline" size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              Marcar como rendida / cargar nota
            </AppText>
          </PressableScale>
        ) : null}
        {accionItem && accionItem.estado === "aprobada" ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              setEditarNotaValor(String(accionItem.nota ?? ""));
              setEditarNotaItem(accionItem);
              setAccionItem(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
          >
            <AppIcon name="create-outline" size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              Editar nota
            </AppText>
          </PressableScale>
        ) : null}
        {accionItem && accionItem.estado === "aprobada" ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              if (accionItem) {
                agenda.marcarHecho(accionItem.id, false).then((ok) => {
                  if (!ok) avisarError("No se pudo actualizar");
                });
              }
              setAccionItem(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
          >
            <AppIcon name="arrow-undo-outline" size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              Marcar como pendiente
            </AppText>
          </PressableScale>
        ) : null}
        <PressableScale
          scaleTo={0.99}
          onPress={() => {
            setAccionItem(null);
            stub("Editar");
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderFaint }}
        >
          <AppIcon name="create-outline" size={18} color={colors.text} />
          <AppText weight="500" style={{ fontSize: 15 }}>
            Editar
          </AppText>
        </PressableScale>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Aviso({ tone: t, texto }: { tone: Tone; texto: string }) {
  const { colors, tone } = useTheme();
  const c = tone[t];
  return (
    <View style={{ padding: spacing.md, borderRadius: radii.sm, backgroundColor: c.soft, borderWidth: 1, borderColor: c.strong + "33" }}>
      <AppText style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>{texto}</AppText>
    </View>
  );
}

function EvalRow({ item, materia, onPress }: { item: DemoEvaluacion; materia: DemoMateria; onPress: () => void }) {
  const { colors } = useTheme();
  const hecho = item.estado === "aprobada";
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderFaint,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: hecho ? 0 : 2,
          borderColor: colors.accent,
          backgroundColor: hecho ? colors.success : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hecho ? <AppIcon name="checkmark" size={13} color={colors.bg} /> : null}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText weight="500" numberOfLines={1} style={{ fontSize: 15, color: hecho ? colors.textTertiary : colors.text, textDecorationLine: hecho ? "line-through" : "none" }}>
          {item.nombre}
        </AppText>
        {!hecho && item.fechaLabel ? <AppText style={{ fontSize: 12, color: colors.accentText }}>{item.fechaLabel}</AppText> : null}
      </View>
      {hecho ? (
        <AppText mono weight="600" style={{ fontSize: 15 }}>
          {formatValor(item.nota ?? 0, materia.escalaTipo)}
          <AppText style={{ fontSize: 12, color: colors.textTertiary }}>/{formatValor(item.notaMax, materia.escalaTipo)}</AppText>
        </AppText>
      ) : (
        <Pill label="Cargar nota" color={colors.accentText} background={colors.accentSoft} />
      )}
    </PressableScale>
  );
}
