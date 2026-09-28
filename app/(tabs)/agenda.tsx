import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { materiaColors, radii, spacing, type Tone } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BottomSheet, CursadaLoader, Fab, Pill, PressableScale, PrimaryButton, Reveal, Spotlight } from "@/components/ui";
import type { DemoAgendaItem } from "@/data/demoContent";
import { materiaComputadaToRow } from "@/lib/materias";
import { getSemestreActivoId } from "@/lib/semestres";
import { useAgenda } from "@/hooks/useAgenda";
import { usePersonal } from "@/hooks/usePersonal";
import { CrearItemSheet, type CrearItemValores, type CrearModo } from "@/components/agenda/CrearItemSheet";
import { AgendaCalendario } from "@/components/agenda/AgendaCalendario";
import {
  agendaBadgeInfo,
  diffDias,
  esCountdownUrgente,
  formatCountdown,
  formatFechaAgenda,
  groupAgenda,
  mesLargoLabel,
  MESES_LARGOS,
  parseISODate,
  PERSONAL_COLOR,
  toISODate,
  today,
} from "@/lib/agenda";

type EnrichedItem = DemoAgendaItem & {
  materiaNombre: string;
  chipBg: string;
  chipColor: string;
  // Color sólido de la materia — la marca del día en la vista Calendario.
  marca: string;
};

type Vista = "lista" | "calendario";

const VISTA_OPTIONS: { value: Vista; icon: "list-outline" | "calendar-outline"; label: string }[] = [
  { value: "lista", icon: "list-outline", label: "Ver como lista" },
  { value: "calendario", icon: "calendar-outline", label: "Ver como calendario" },
];

// Lista ↔ Calendario: mismo lenguaje de selección que los chips de filtro
// (fondo `text` = activo), en compacto para que entre junto al título sin
// sumar una fila más de chrome antes del contenido.
function VistaToggle({ value, onChange }: { value: Vista; onChange: (v: Vista) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 3, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft }}>
      {VISTA_OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            scaleTo={0.94}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={{ width: 44, height: 34, borderRadius: radii.sm - 3, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.text : "transparent" }}
          >
            <AppIcon name={o.icon} size={16} color={active ? colors.bg : colors.textSecondary} weight={active ? "semibold" : "regular"} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const KIND_OPTIONS: { value: "" | "evaluacion" | "tarea"; label: string }[] = [
  { value: "", label: "Todo" },
  { value: "evaluacion", label: "Evaluaciones" },
  { value: "tarea", label: "Tareas" },
];

const ESTADO_OPTIONS: { value: "" | "pendiente" | "hecho"; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "pendiente", label: "Pendientes" },
  { value: "hecho", label: "Entregados/rendidos" },
];

function monthKey(iso: string) {
  const d = parseISODate(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function AgendaRow({
  item,
  ocultarMateriaChip,
  t,
  onToggleHecho,
  onPress,
}: {
  item: EnrichedItem;
  ocultarMateriaChip: boolean;
  t: Date;
  onToggleHecho: () => void;
  onPress: () => void;
}) {
  const { colors, tone } = useTheme();
  const esMateria = item.kind === "materia";
  const badge = esMateria
    ? agendaBadgeInfo({ hecho: item.hecho, itemKind: item.itemKind!, nota: item.nota, fecha: item.fecha }, t)
    : { tone: "neutral" as Tone, label: item.todoElDia ? "Todo el día" : "Personal" };
  const mostrarBadge = !esMateria || item.hecho;
  const countdownTxt = !mostrarBadge ? formatCountdown(item.fecha, item.hora, new Date()) : null;
  const countdownColor =
    countdownTxt === "vencido" ? colors.dangerText : countdownTxt && esCountdownUrgente(item.fecha) ? colors.warningText : colors.textFaint;
  const badgeTone = tone[badge.tone];

  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
      }}
    >
      <PressableScale
        scaleTo={0.85}
        disabled={!esMateria}
        onPress={onToggleHecho}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.hecho, disabled: !esMateria }}
        accessibilityLabel={esMateria ? (item.hecho ? "Marcar como pendiente" : "Marcar como completado") : undefined}
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: item.hecho ? colors.success : colors.textFaint,
          backgroundColor: item.hecho ? colors.success : "transparent",
          alignItems: "center",
          justifyContent: "center",
          opacity: esMateria ? 1 : 0.4,
        }}
      >
        {item.hecho ? <AppIcon name="checkmark" size={13} color={colors.bg} /> : null}
      </PressableScale>

      <View style={{ flex: 1, gap: 3 }}>
        <AppText
          weight="500"
          numberOfLines={1}
          style={{
            fontSize: 16,
            color: item.hecho ? colors.textTertiary : colors.text,
            textDecorationLine: item.hecho ? "line-through" : "none",
          }}
        >
          {item.titulo}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {!ocultarMateriaChip ? (
            <Pill label={item.materiaNombre} background={item.chipBg} color={item.chipColor} style={{ height: 20, paddingHorizontal: 8 }} />
          ) : null}
          {item.tag ? (
            <Pill label={item.tag.label} color={item.tag.color} background={colors.surfaceSoft} style={{ height: 20, paddingHorizontal: 8 }} />
          ) : null}
          <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{item.tipo}</AppText>
        </View>
      </View>

      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
          {formatFechaAgenda(item.fecha, item.todoElDia ? undefined : item.hora)}
        </AppText>
        {mostrarBadge ? (
          <Pill label={badge.label} color={badgeTone.text} background={badgeTone.soft} style={{ height: 22, paddingHorizontal: 9 }} />
        ) : (
          <AppText mono weight="600" style={{ fontSize: 13, color: countdownColor }}>
            {countdownTxt}
          </AppText>
        )}
      </View>
    </PressableScale>
  );
}

function AgendaGroup({
  titulo,
  danger,
  items,
  t,
  ocultarMateriaChip,
  subagruparPorMes,
  onToggleHecho,
  onPressItem,
}: {
  titulo: string;
  danger?: boolean;
  items: EnrichedItem[];
  t: Date;
  ocultarMateriaChip: boolean;
  subagruparPorMes?: boolean;
  onToggleHecho: (id: string) => void;
  onPressItem: (item: EnrichedItem) => void;
}) {
  const { colors } = useTheme();
  if (!items.length) return null;
  const distintosMeses = new Set(items.map((i) => monthKey(i.fecha))).size;
  const mostrarDivisores = !!subagruparPorMes && distintosMeses > 1;
  let ultimoMes: string | null = null;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        <AppText weight="700" style={{ fontSize: 20, letterSpacing: -0.4, color: danger ? colors.dangerText : colors.text }}>
          {titulo}
        </AppText>
        <AppText mono style={{ fontSize: 13, color: colors.textTertiary }}>
          {items.length}
        </AppText>
      </View>
      <View style={{ gap: spacing.smd }}>
        {items.map((item) => {
          const key = monthKey(item.fecha);
          const divider = mostrarDivisores && key !== ultimoMes ? mesLargoLabel(item.fecha, t) : null;
          if (divider) ultimoMes = key;
          return (
            <View key={item.id} style={{ gap: spacing.sm }}>
              {divider ? (
                <AppText weight="600" style={{ fontSize: 13, color: colors.textTertiary, paddingTop: spacing.xs }}>
                  {divider}
                </AppText>
              ) : null}
              <AgendaRow
                item={item}
                ocultarMateriaChip={ocultarMateriaChip}
                t={t}
                onToggleHecho={() => onToggleHecho(item.id)}
                onPress={() => onPressItem(item)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function AgendaScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const { colors } = useTheme();
  const agenda = useAgenda();
  const { refetch: refetchAgenda } = agenda;

  // useAgenda() no es un store compartido: Detalle de ítem (app/item/[id].tsx)
  // tiene su propia copia de `rows`. Sin este refetch, borrar la nota y
  // volver a "pendiente" desde ahí no sacaba el ítem de "Completadas" al
  // volver a esta tab (ver bug reportado).
  useFocusEffect(
    useCallback(() => {
      refetchAgenda();
    }, [refetchAgenda])
  );
  // Materias reales del usuario, sin fallback a demoMaterias (ver "el hack
  // a eliminar" en materias.tsx) — se usan sólo para el picker de "+ Nueva
  // evaluación/tarea" y para resolver nombre/color en cada fila.
  const [supaMaterias, setSupaMaterias] = useState<Materia[] | null>(null);
  useEffect(() => {
    supabase
      .from("materias")
      .select("*")
      .then(({ data }) => setSupaMaterias(data ?? []));
  }, []);
  const materiasRows = useMemo(() => (supaMaterias ?? []).map((m) => materiaComputadaToRow(m, agenda.rows ?? [])), [supaMaterias, agenda.rows]);

  // Semestre activo — el picker de "+ Nueva evaluación/tarea" sólo debe
  // ofrecer materias que se están cursando ahora, no todo el histórico
  // (ver Filtros, que sí se queda con materiasRows completo a propósito:
  // filtrar la vista de Agenda por una materia vieja sigue teniendo sentido).
  const [activeSemestreId, setActiveSemestreId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    getSemestreActivoId()
      .then(setActiveSemestreId)
      .catch(() => setActiveSemestreId(null));
  }, []);
  const materiasRowsActivo = useMemo(
    () => (supaMaterias ?? []).filter((m) => m.semestre_id === activeSemestreId).map((m) => materiaComputadaToRow(m, agenda.rows ?? [])),
    [supaMaterias, activeSemestreId, agenda.rows]
  );

  // Ítems "materia" (evaluación/tarea) salen de la tabla real `agenda`, sin
  // fallback a datos de muestra (mismo criterio que Detalle de materia).
  // Los eventos "personales" salen de la tabla real `personal` (misma tabla
  // que ya lee el hero "Lo próximo" de Inicio).
  const personal = usePersonal();
  const items = useMemo(() => [...agenda.items, ...personal.items], [agenda.items, personal.items]);

  const [filtroKind, setFiltroKind] = useState<"" | "evaluacion" | "tarea">("");
  const [filtroMateriaId, setFiltroMateriaId] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "pendiente" | "hecho">("");
  const [query, setQuery] = useState("");
  const [completadasAbiertas, setCompletadasAbiertas] = useState(false);

  const [filtrosSheetOpen, setFiltrosSheetOpen] = useState(false);
  const [nuevoSheetOpen, setNuevoSheetOpen] = useState(false);

  // Circulito de una evaluación pendiente: en vez de marcarla hecha de una,
  // se pregunta qué pasó (rendida sin nota todavía, o ya con nota).
  const [rendirId, setRendirId] = useState<string | null>(null);
  const [rendirPaso, setRendirPaso] = useState<"opciones" | "nota">("opciones");
  const [rendirNota, setRendirNota] = useState("");

  const [crearModo, setCrearModo] = useState<CrearModo | null>(null);
  // Día con el que arranca "Fecha" al crear desde la vista Calendario.
  const [fechaCrear, setFechaCrear] = useState<string | undefined>(undefined);

  const [vista, setVista] = useState<Vista>("lista");
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => toISODate(today()));

  const t = useMemo(() => today(), []);
  const materiaLookup = useMemo(() => new Map(materiasRows.map((m) => [m.id, m])), [materiasRows]);

  const enriched = useMemo<EnrichedItem[]>(
    () =>
      items.map((item) => {
        if (item.kind === "materia" && item.materiaId) {
          const m = materiaLookup.get(item.materiaId);
          const accent = m ? materiaColors[m.colorId] : materiaColors.gris;
          return { ...item, materiaNombre: m?.nombre ?? "Materia", chipBg: accent.soft, chipColor: accent.strong, marca: accent.strong };
        }
        return { ...item, materiaNombre: "Personal", chipBg: colors.neutralSoft, chipColor: colors.neutralText, marca: PERSONAL_COLOR };
      }),
    [items, materiaLookup]
  );

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((e) => {
      if (filtroKind && e.itemKind !== filtroKind) return false;
      if (filtroMateriaId && e.materiaId !== filtroMateriaId) return false;
      if (filtroEstado === "pendiente" && e.hecho) return false;
      if (filtroEstado === "hecho" && !e.hecho) return false;
      if (q && !`${e.titulo} ${e.materiaNombre} ${e.tipo}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, filtroKind, filtroMateriaId, filtroEstado, query]);

  const separarCompletadas = filtroEstado !== "hecho";
  const { vencidas, estaSemana, proximamente, completadas } = useMemo(
    () => groupAgenda(entries, t, separarCompletadas),
    [entries, t, separarCompletadas]
  );

  const vencidosCount = useMemo(
    () => enriched.filter((e) => !e.hecho && diffDias(parseISODate(e.fecha), t) < 0).length,
    [enriched, t]
  );

  const ocultarMateriaChip = !!filtroMateriaId;

  const avisarError = (titulo: string) => Alert.alert(titulo, "Revisá tu conexión e intentá de nuevo.");

  // Marcar como pendiente una evaluación que ya tiene nota cargada es
  // ambiguo (¿la nota se queda o se pierde?) — en vez de tocarla en
  // silencio, se pregunta explícitamente. Tareas y evaluaciones sin nota
  // (nota siempre null) van directo, sin fricción de más.
  const toggleHecho = async (id: string) => {
    const actual = agenda.items.find((it) => it.id === id);
    if (!actual) return;
    if (!actual.hecho && actual.itemKind === "evaluacion") {
      setRendirNota("");
      setRendirPaso("opciones");
      setRendirId(id);
      return;
    }
    if (actual.hecho && actual.nota != null) {
      Alert.alert("Marcar como pendiente", "Esta evaluación tiene una nota cargada. ¿Qué querés hacer?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Mantener la nota",
          onPress: async () => {
            const ok = await agenda.marcarHecho(id, false);
            if (!ok) avisarError("No se pudo actualizar");
          },
        },
        {
          text: "Quitar nota también",
          style: "destructive",
          onPress: async () => {
            const okNota = await agenda.borrarNota(id);
            const ok = await agenda.marcarHecho(id, false);
            if (!okNota || !ok) avisarError("No se pudo actualizar");
          },
        },
      ]);
      return;
    }
    const ok = await agenda.marcarHecho(id, !actual.hecho);
    if (!ok) avisarError("No se pudo actualizar");
  };

  const rendirItem = rendirId ? agenda.items.find((it) => it.id === rendirId) ?? null : null;

  const cerrarRendir = () => setRendirId(null);

  const marcarEsperandoNota = async () => {
    if (!rendirId) return;
    const ok = await agenda.marcarHecho(rendirId, true);
    cerrarRendir();
    if (!ok) avisarError("No se pudo actualizar");
  };

  const guardarNotaRendir = async () => {
    if (!rendirId) return;
    const n = Number(rendirNota.trim().replace(",", "."));
    if (!rendirNota.trim() || !Number.isFinite(n)) return;
    const ok = await agenda.asignarNota(rendirId, n);
    cerrarRendir();
    if (!ok) avisarError("No se pudo guardar la nota");
  };

  // Detalle completo del ítem (título, materia, fecha, estado, nota,
  // acciones) vive en app/item/[id].tsx — no hay endpoint "por id" para
  // agenda/personal, así que esa pantalla resuelve el ítem buscándolo en
  // los mismos hooks ya fetcheados acá, filtrando por id + kind.
  const abrirItem = (item: EnrichedItem) => router.push(`/item/${item.id}?kind=${item.kind === "materia" ? "materia" : "personal"}`);

  const materiaSeleccionLabel = filtroMateriaId ? materiaLookup.get(filtroMateriaId)?.nombre ?? "Materia" : "Todas las materias";
  const estadoSeleccionLabel = ESTADO_OPTIONS.find((o) => o.value === filtroEstado)?.label ?? "Todos los estados";
  const filtrosActivosCount = (filtroMateriaId ? 1 : 0) + (filtroEstado ? 1 : 0);
  const filtrosActivos = filtrosActivosCount > 0 || !!filtroKind || !!query.trim();
  const limpiarFiltros = () => {
    setFiltroKind("");
    setFiltroMateriaId("");
    setFiltroEstado("");
    setQuery("");
  };

  // Gatea la entrada única de contenido a que haya datos reales (mismo
  // criterio que Inicio, ver critique P0) — antes rows===null se leía
  // igual que "no hay ítems", mintiéndole a quien recién abre la pantalla.
  const dataReady = agenda.rows !== null && personal.rows !== null;
  const showError = !dataReady && (!!agenda.error || !!personal.error);

  const abrirNuevo = (fecha?: string) => {
    setFechaCrear(fecha);
    setNuevoSheetOpen(true);
  };

  const abrirCrear = (modo: CrearModo) => {
    setNuevoSheetOpen(false);
    setCrearModo(modo);
  };

  const confirmarCrear = async ({ titulo, fecha, materiaId, hora, todoElDia }: CrearItemValores) => {
    if (!crearModo) return;
    if (crearModo.kind === "personal") {
      const ok = await personal.crear({ titulo, fecha, todoElDia });
      if (!ok) {
        avisarError("No se pudo crear");
        return;
      }
      setCrearModo(null);
      return;
    }
    const tipo = crearModo.itemKind === "evaluacion" ? "Parcial" : "Entrega";
    const ok = await agenda.crear({ materiaId, kind: crearModo.itemKind, tipo, titulo, fecha, hora });
    if (!ok) {
      avisarError("No se pudo crear");
      return;
    }
    setCrearModo(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={280} />
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="700" style={{ fontSize: 32, letterSpacing: -0.8 }}>
              Agenda
            </AppText>
            <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
              {entries.length} {entries.length === 1 ? "ítem" : "ítems"}
              {vencidosCount ? ` · ${vencidosCount} ${vencidosCount === 1 ? "vencido" : "vencidos"}` : ""}
            </AppText>
          </View>
          <VistaToggle value={vista} onChange={setVista} />
        </View>

        <View
          style={{
            height: 44,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceSoft,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          }}
        >
          <AppIcon name="search" size={15} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en la agenda"
            accessibilityLabel="Buscar en la agenda"
            clearButtonMode="while-editing"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, fontSize: 15, color: colors.text, padding: 0 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, flex: 1 }}>
            {KIND_OPTIONS.map((o) => (
              <PressableScale key={o.value} scaleTo={0.96} onPress={() => setFiltroKind(o.value)} accessibilityRole="button" accessibilityState={{ selected: filtroKind === o.value }}>
                <Pill
                  label={o.label}
                  background={filtroKind === o.value ? colors.text : colors.surfaceSoft}
                  color={filtroKind === o.value ? colors.bg : colors.textSecondary}
                  style={{ height: 36, paddingHorizontal: 14 }}
                />
              </PressableScale>
            ))}
          </View>
          {/* Materia + estado combinados en un solo sheet — antes eran dos
              dropdowns idénticos lado a lado (ver critique P2: chrome fijo
              antes del contenido, y Casey no podía distinguirlos a simple
              vista). Un badge con el conteo real muestra si hay algo activo
              sin tener que abrir nada. */}
          <PressableScale
            scaleTo={0.96}
            onPress={() => setFiltrosSheetOpen(true)}
            accessibilityLabel={`Filtros${filtrosActivosCount ? `, ${filtrosActivosCount} activos` : ""}`}
            style={{
              height: 36,
              borderRadius: radii.sm,
              backgroundColor: filtrosActivosCount ? colors.accentSoft : colors.surfaceSoft,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
            }}
          >
            <AppIcon name="options-outline" size={13} color={filtrosActivosCount ? colors.accentText : colors.textSecondary} />
            <AppText weight="500" style={{ fontSize: 13, color: filtrosActivosCount ? colors.accentText : colors.textSecondary }}>
              Filtros{filtrosActivosCount ? ` · ${filtrosActivosCount}` : ""}
            </AppText>
          </PressableScale>
        </View>
      </View>

      {showError ? (
        <View
          accessible
          accessibilityLabel="No pudimos cargar tu agenda. Revisá tu conexión y volvé a esta pantalla para reintentar."
          style={{
            marginHorizontal: spacing.xl,
            marginBottom: spacing.sm,
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
            No pudimos cargar tu agenda. Revisá tu conexión y volvé a esta pantalla para reintentar.
          </AppText>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.xxl }} showsVerticalScrollIndicator={false}>
        {!dataReady ? (
          showError ? null : (
            <View style={{ paddingTop: spacing.xxxl * 2, alignItems: "center" }}>
              <CursadaLoader size={44} label="Cargando tu agenda…" />
            </View>
          )
        ) : vista === "calendario" ? (
          <Reveal>
            <AgendaCalendario
              items={entries}
              hoy={t}
              seleccion={diaSeleccionado}
              onSeleccionar={setDiaSeleccionado}
              onAgregar={abrirNuevo}
              renderItem={(item) => (
                <AgendaRow
                  item={item}
                  ocultarMateriaChip={ocultarMateriaChip}
                  t={t}
                  onToggleHecho={() => toggleHecho(item.id)}
                  onPress={() => abrirItem(item)}
                />
              )}
            />
          </Reveal>
        ) : (
          <Reveal style={{ gap: spacing.xxl }}>
            <AgendaGroup titulo="Vencidas" danger items={vencidas} t={t} ocultarMateriaChip={ocultarMateriaChip} onToggleHecho={toggleHecho} onPressItem={abrirItem} />
            <AgendaGroup titulo="Esta semana" items={estaSemana} t={t} ocultarMateriaChip={ocultarMateriaChip} onToggleHecho={toggleHecho} onPressItem={abrirItem} />
            <AgendaGroup
              titulo="Próximamente"
              items={proximamente}
              t={t}
              ocultarMateriaChip={ocultarMateriaChip}
              subagruparPorMes
              onToggleHecho={toggleHecho}
              onPressItem={abrirItem}
            />

            {completadas.length ? (
              <View style={{ gap: spacing.md }}>
                <PressableScale
                  scaleTo={0.99}
                  onPress={() => setCompletadasAbiertas((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: completadasAbiertas }}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 32 }}
                >
                  <AppText weight="700" style={{ fontSize: 20, letterSpacing: -0.4, color: colors.textSecondary }}>
                    Completadas
                  </AppText>
                  <AppText mono style={{ fontSize: 13, color: colors.textTertiary }}>
                    {completadas.length}
                  </AppText>
                  <AppIcon name={completadasAbiertas ? "chevron-up" : "chevron-down"} size={14} color={colors.textTertiary} />
                </PressableScale>
                {completadasAbiertas ? (
                  <View style={{ gap: spacing.smd }}>
                    {completadas.map((item) => (
                      <AgendaRow
                        key={item.id}
                        item={item}
                        ocultarMateriaChip={ocultarMateriaChip}
                        t={t}
                        onToggleHecho={() => toggleHecho(item.id)}
                        onPress={() => abrirItem(item)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {!entries.length && filtrosActivos ? (
              <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.xxxl }}>
                <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center" }}>Ningún ítem coincide con estos filtros.</AppText>
                <PrimaryButton label="Limpiar filtros" variant="ghost" onPress={limpiarFiltros} />
              </View>
            ) : null}

            {!entries.length && !filtrosActivos ? (
              <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.xxxl }}>
                <View style={{ width: 48, height: 48, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                  <AppIcon name="calendar-outline" size={22} color={colors.textFaint} />
                </View>
                <AppText weight="600" style={{ fontSize: 15 }}>
                  Tu agenda está vacía
                </AppText>
                <AppText style={{ fontSize: 13, color: colors.textTertiary, textAlign: "center" }}>
                  Agregá tu primera evaluación, tarea o evento.
                </AppText>
                <PrimaryButton label="+ Nuevo" onPress={() => abrirNuevo()} />
              </View>
            ) : null}
          </Reveal>
        )}
      </ScrollView>

      <Fab onPress={() => abrirNuevo(vista === "calendario" ? diaSeleccionado : undefined)} />

      {/* Filtros: materia + estado combinados */}
      <BottomSheet visible={filtrosSheetOpen} onClose={() => setFiltrosSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Filtros
        </AppText>
        <ScrollView style={{ maxHeight: windowHeight * 0.55 }} showsVerticalScrollIndicator={false}>
        <AppText weight="600" style={{ fontSize: 13, color: colors.textTertiary, paddingTop: spacing.xs }}>
          Materia
        </AppText>
        <PressableScale
          scaleTo={0.99}
          onPress={() => setFiltroMateriaId("")}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md }}
        >
          <AppText weight={filtroMateriaId === "" ? "600" : "400"} style={{ fontSize: 15 }}>
            Todas las materias
          </AppText>
          {filtroMateriaId === "" ? <AppIcon name="checkmark" size={18} color={colors.accent} /> : null}
        </PressableScale>
        {materiasRows.map((m) => (
          <PressableScale
            key={m.id}
            scaleTo={0.99}
            onPress={() => setFiltroMateriaId(m.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.borderFaint,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: materiaColors[m.colorId].strong }} />
            <AppText weight={filtroMateriaId === m.id ? "600" : "400"} style={{ fontSize: 15, flex: 1 }} numberOfLines={1}>
              {m.nombre}
            </AppText>
            {filtroMateriaId === m.id ? <AppIcon name="checkmark" size={18} color={colors.accent} /> : null}
          </PressableScale>
        ))}

        <AppText weight="600" style={{ fontSize: 13, color: colors.textTertiary, paddingTop: spacing.lg }}>
          Estado
        </AppText>
        {ESTADO_OPTIONS.map((o, i) => (
          <PressableScale
            key={o.value}
            scaleTo={0.99}
            onPress={() => setFiltroEstado(o.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.borderFaint,
            }}
          >
            <AppText weight={filtroEstado === o.value ? "600" : "400"} style={{ fontSize: 15 }}>
              {o.label}
            </AppText>
            {filtroEstado === o.value ? <AppIcon name="checkmark" size={18} color={colors.accent} /> : null}
          </PressableScale>
        ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.md }}>
          <PrimaryButton label="Limpiar" variant="ghost" flex onPress={limpiarFiltros} />
          <PrimaryButton label="Listo" flex onPress={() => setFiltrosSheetOpen(false)} />
        </View>
      </BottomSheet>

      {/* Circulito de evaluación pendiente */}
      <BottomSheet visible={!!rendirId} onClose={cerrarRendir}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }} numberOfLines={2}>
          {rendirPaso === "nota" ? "Asignar nota" : rendirItem?.titulo ?? "Evaluación"}
        </AppText>
        {rendirPaso === "opciones" ? (
          <View>
            {[
              { icon: "add-circle-outline" as const, label: "Asignar nota", hint: "Ya tengo la nota", onPress: () => setRendirPaso("nota") },
              { icon: "checkmark-circle-outline" as const, label: "Marcar como rendida", hint: "Queda esperando nota", onPress: marcarEsperandoNota },
            ].map((opt, i) => (
              <PressableScale
                key={opt.label}
                scaleTo={0.99}
                onPress={opt.onPress}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.lg,
                  minHeight: 60,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.borderFaint,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                  <AppIcon name={opt.icon} size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="500" style={{ fontSize: 16 }}>
                    {opt.label}
                  </AppText>
                  <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{opt.hint}</AppText>
                </View>
                <AppIcon name="chevron-forward" size={14} color={colors.textGhost} />
              </PressableScale>
            ))}
          </View>
        ) : (
          <>
            <TextInput
              value={rendirNota}
              onChangeText={setRendirNota}
              placeholder={`Nota sobre ${rendirItem?.notaMaxima ?? 12}`}
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
            <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
              <PrimaryButton label="Volver" variant="ghost" flex onPress={() => setRendirPaso("opciones")} />
              <PrimaryButton label="Guardar" flex disabled={!rendirNota.trim()} onPress={guardarNotaRendir} />
            </View>
          </>
        )}
      </BottomSheet>

      {/* + Nuevo */}
      <BottomSheet visible={nuevoSheetOpen} onClose={() => setNuevoSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Crear nuevo
        </AppText>
        <View>
          {[
            { icon: "book-outline" as const, label: "Materia", onPress: () => { setNuevoSheetOpen(false); router.push("/materia/nueva"); } },
            { icon: "school-outline" as const, label: "Evaluación", onPress: () => abrirCrear({ kind: "materia", itemKind: "evaluacion" }) },
            { icon: "checkbox-outline" as const, label: "Tarea", onPress: () => abrirCrear({ kind: "materia", itemKind: "tarea" }) },
            { icon: "calendar-outline" as const, label: "Evento personal", onPress: () => abrirCrear({ kind: "personal" }) },
          ].map((opt, i) => (
            <PressableScale
              key={opt.label}
              scaleTo={0.99}
              onPress={opt.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                minHeight: 56,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.borderFaint,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                <AppIcon name={opt.icon} size={18} color={colors.text} />
              </View>
              <AppText weight="500" style={{ fontSize: 16, flex: 1 }}>
                {opt.label}
              </AppText>
              <AppIcon name="chevron-forward" size={14} color={colors.textGhost} />
            </PressableScale>
          ))}
        </View>
      </BottomSheet>

      {/* Crear evaluación/tarea/evento */}
      <CrearItemSheet modo={crearModo} onClose={() => setCrearModo(null)} onCrear={confirmarCrear} materias={materiasRowsActivo} fechaInicial={fechaCrear} />

    </SafeAreaView>
  );
}
