import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Alert, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { colors, materiaColors, radii, spacing, tone, type Tone } from "@/theme/tokens";
import { AppIcon, AppText, BottomSheet, Fab, Pill, PressableScale, PrimaryButton } from "@/components/ui";
import type { DemoAgendaItem } from "@/data/demoContent";
import { materiaComputadaToRow } from "@/lib/materias";
import { useAgenda } from "@/hooks/useAgenda";
import { usePersonal } from "@/hooks/usePersonal";
import {
  agendaBadgeInfo,
  diffDias,
  esCountdownUrgente,
  formatCountdown,
  formatFechaAgenda,
  groupAgenda,
  mesLargoLabel,
  parseISODate,
  PERSONAL_COLOR,
  today,
} from "@/lib/agenda";

type EnrichedItem = DemoAgendaItem & {
  materiaNombre: string;
  accentColor: string;
  chipBg: string;
  chipColor: string;
};

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

function isoToday() {
  return today().toISOString().slice(0, 10);
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
        borderRadius: radii.md,
        padding: spacing.md + 2,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: item.accentColor,
      }}
    >
      <PressableScale
        scaleTo={0.85}
        disabled={!esMateria}
        onPress={onToggleHecho}
        hitSlop={10}
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: item.hecho ? colors.success : "rgba(245,245,247,0.35)",
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
            fontSize: 15,
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
        <AppText mono style={{ fontSize: 11, color: colors.textFaint }}>
          {formatFechaAgenda(item.fecha, item.todoElDia ? undefined : item.hora)}
        </AppText>
        {mostrarBadge ? (
          <Pill label={badge.label} color={badgeTone.text} background={badgeTone.soft} style={{ height: 22, paddingHorizontal: 9 }} />
        ) : (
          <AppText mono weight="600" style={{ fontSize: 12, color: countdownColor }}>
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
  if (!items.length) return null;
  const distintosMeses = new Set(items.map((i) => monthKey(i.fecha))).size;
  const mostrarDivisores = !!subagruparPorMes && distintosMeses > 1;
  let ultimoMes: string | null = null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        <AppText
          weight="700"
          style={{ fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase", color: danger ? colors.dangerText : colors.textSecondary }}
        >
          {titulo}
        </AppText>
        <AppText mono style={{ fontSize: 11, color: colors.textFaint }}>
          {items.length} {items.length === 1 ? "ítem" : "ítems"}
        </AppText>
      </View>
      <View style={{ gap: spacing.sm }}>
        {items.map((item) => {
          const key = monthKey(item.fecha);
          const divider = mostrarDivisores && key !== ultimoMes ? mesLargoLabel(item.fecha, t) : null;
          if (divider) ultimoMes = key;
          return (
            <View key={item.id} style={{ gap: spacing.sm }}>
              {divider ? (
                <AppText weight="600" style={{ fontSize: 12, color: colors.textFaint, paddingTop: spacing.xs }}>
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
  const agenda = useAgenda();
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

  const [materiaSheetOpen, setMateriaSheetOpen] = useState(false);
  const [estadoSheetOpen, setEstadoSheetOpen] = useState(false);
  const [nuevoSheetOpen, setNuevoSheetOpen] = useState(false);
  const [actionItem, setActionItem] = useState<EnrichedItem | null>(null);
  const [notaSheetItem, setNotaSheetItem] = useState<EnrichedItem | null>(null);
  const [notaInput, setNotaInput] = useState("");

  const [crearModo, setCrearModo] = useState<{ kind: "materia"; itemKind: "evaluacion" | "tarea" } | { kind: "personal" } | null>(null);
  const [creTitulo, setCreTitulo] = useState("");
  const [creMateriaId, setCreMateriaId] = useState(materiasRows[0]?.id ?? "");
  const [creTodoElDia, setCreTodoElDia] = useState(true);

  const t = useMemo(() => today(), []);
  const materiaLookup = useMemo(() => new Map(materiasRows.map((m) => [m.id, m])), [materiasRows]);

  const enriched = useMemo<EnrichedItem[]>(
    () =>
      items.map((item) => {
        if (item.kind === "materia" && item.materiaId) {
          const m = materiaLookup.get(item.materiaId);
          const accent = m ? materiaColors[m.colorId] : materiaColors.gris;
          return { ...item, materiaNombre: m?.nombre ?? "Materia", accentColor: accent.strong, chipBg: accent.soft, chipColor: accent.strong };
        }
        return { ...item, materiaNombre: "Personal", accentColor: PERSONAL_COLOR, chipBg: colors.neutralSoft, chipColor: colors.neutralText };
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

  const toggleHecho = async (id: string) => {
    const actual = agenda.items.find((it) => it.id === id);
    if (!actual) return;
    const ok = await agenda.marcarHecho(id, !actual.hecho);
    if (!ok) avisarError("No se pudo actualizar");
  };

  const eliminarItem = async (id: string) => {
    if (personal.items.some((p) => p.id === id)) {
      const ok = await personal.eliminar(id);
      if (!ok) avisarError("No se pudo eliminar");
      return;
    }
    const ok = await agenda.eliminar(id);
    if (!ok) avisarError("No se pudo eliminar");
  };

  const materiaSeleccionLabel = filtroMateriaId ? materiaLookup.get(filtroMateriaId)?.nombre ?? "Materia" : "Todas las materias";
  const estadoSeleccionLabel = ESTADO_OPTIONS.find((o) => o.value === filtroEstado)?.label ?? "Todos los estados";

  const abrirCrear = (modo: typeof crearModo) => {
    setNuevoSheetOpen(false);
    setCreTitulo("");
    setCreMateriaId(materiasRows[0]?.id ?? "");
    setCreTodoElDia(true);
    setCrearModo(modo);
  };

  const confirmarCrear = async () => {
    if (!crearModo || !creTitulo.trim()) return;
    if (crearModo.kind === "personal") {
      const ok = await personal.crear({ titulo: creTitulo.trim(), fecha: isoToday(), todoElDia: creTodoElDia });
      if (!ok) {
        avisarError("No se pudo crear");
        return;
      }
      setCrearModo(null);
      return;
    }
    const tipo = crearModo.itemKind === "evaluacion" ? "Parcial" : "Entrega";
    const ok = await agenda.crear({ materiaId: creMateriaId, kind: crearModo.itemKind, tipo, titulo: creTitulo.trim(), fecha: isoToday() });
    if (!ok) {
      avisarError("No se pudo crear");
      return;
    }
    setCrearModo(null);
  };

  const confirmarNota = async () => {
    if (!notaSheetItem) return;
    const n = Number(notaInput.replace(",", "."));
    if (!Number.isFinite(n)) return;
    const ok = await agenda.asignarNota(notaSheetItem.id, n);
    if (!ok) {
      avisarError("No se pudo guardar la nota");
      return;
    }
    setNotaSheetItem(null);
    setNotaInput("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6 }}>
            Agenda
          </AppText>
          <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
            {entries.length} {entries.length === 1 ? "ítem" : "ítems"}
            {vencidosCount ? ` · ${vencidosCount} ${vencidosCount === 1 ? "vencido" : "vencidos"}` : ""}
          </AppText>
        </View>

        <View
          style={{
            height: 42,
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
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, fontSize: 15, color: colors.text, padding: 0 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {KIND_OPTIONS.map((o) => (
            <PressableScale key={o.value} scaleTo={0.96} onPress={() => setFiltroKind(o.value)}>
              <Pill
                label={o.label}
                background={filtroKind === o.value ? colors.text : colors.surfaceSoft}
                color={filtroKind === o.value ? colors.bg : colors.textSecondary}
                style={{ height: 32, paddingHorizontal: 14 }}
              />
            </PressableScale>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <PressableScale scaleTo={0.98} onPress={() => setMateriaSheetOpen(true)} style={{ flex: 1 }}>
            <View
              style={{
                height: 36,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceSofter,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: spacing.md,
              }}
            >
              <AppText weight="500" numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, flexShrink: 1 }}>
                {materiaSeleccionLabel}
              </AppText>
              <AppIcon name="chevron-down" size={14} color={colors.textFaint} />
            </View>
          </PressableScale>
          <PressableScale scaleTo={0.98} onPress={() => setEstadoSheetOpen(true)} style={{ flex: 1 }}>
            <View
              style={{
                height: 36,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceSofter,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: spacing.md,
              }}
            >
              <AppText weight="500" numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, flexShrink: 1 }}>
                {estadoSeleccionLabel}
              </AppText>
              <AppIcon name="chevron-down" size={14} color={colors.textFaint} />
            </View>
          </PressableScale>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <AgendaGroup titulo="Vencidas" danger items={vencidas} t={t} ocultarMateriaChip={ocultarMateriaChip} onToggleHecho={toggleHecho} onPressItem={setActionItem} />
        <AgendaGroup titulo="Esta semana" items={estaSemana} t={t} ocultarMateriaChip={ocultarMateriaChip} onToggleHecho={toggleHecho} onPressItem={setActionItem} />
        <AgendaGroup
          titulo="Próximamente"
          items={proximamente}
          t={t}
          ocultarMateriaChip={ocultarMateriaChip}
          subagruparPorMes
          onToggleHecho={toggleHecho}
          onPressItem={setActionItem}
        />

        {completadas.length ? (
          <View style={{ gap: spacing.sm }}>
            <PressableScale
              scaleTo={0.99}
              onPress={() => setCompletadasAbiertas((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <AppText weight="700" style={{ fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase", color: colors.textSecondary }}>
                Completadas
              </AppText>
              <AppText mono style={{ fontSize: 11, color: colors.textFaint }}>
                {completadas.length}
              </AppText>
              <AppIcon name={completadasAbiertas ? "chevron-up" : "chevron-down"} size={13} color={colors.textFaint} />
            </PressableScale>
            {completadasAbiertas ? (
              <View style={{ gap: spacing.sm }}>
                {completadas.map((item) => (
                  <AgendaRow
                    key={item.id}
                    item={item}
                    ocultarMateriaChip={ocultarMateriaChip}
                    t={t}
                    onToggleHecho={() => toggleHecho(item.id)}
                    onPress={() => setActionItem(item)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {!entries.length ? (
          <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
            No hay ítems con estos filtros.
          </AppText>
        ) : null}
      </ScrollView>

      <Fab onPress={() => setNuevoSheetOpen(true)} />

      {/* Filtro: materia */}
      <BottomSheet visible={materiaSheetOpen} onClose={() => setMateriaSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Filtrar por materia
        </AppText>
        <PressableScale
          scaleTo={0.99}
          onPress={() => {
            setFiltroMateriaId("");
            setMateriaSheetOpen(false);
          }}
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
            onPress={() => {
              setFiltroMateriaId(m.id);
              setMateriaSheetOpen(false);
            }}
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
      </BottomSheet>

      {/* Filtro: estado */}
      <BottomSheet visible={estadoSheetOpen} onClose={() => setEstadoSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Filtrar por estado
        </AppText>
        {ESTADO_OPTIONS.map((o, i) => (
          <PressableScale
            key={o.value}
            scaleTo={0.99}
            onPress={() => {
              setFiltroEstado(o.value);
              setEstadoSheetOpen(false);
            }}
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
      </BottomSheet>

      {/* + Nuevo */}
      <BottomSheet visible={nuevoSheetOpen} onClose={() => setNuevoSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Crear nuevo
        </AppText>
        {[
          { icon: "book-outline" as const, label: "Materia", onPress: () => { setNuevoSheetOpen(false); router.push("/(tabs)/materias"); } },
          { icon: "school-outline" as const, label: "Evaluación", onPress: () => abrirCrear({ kind: "materia", itemKind: "evaluacion" }) },
          { icon: "checkbox-outline" as const, label: "Tarea", onPress: () => abrirCrear({ kind: "materia", itemKind: "tarea" }) },
          {
            icon: "create-outline" as const,
            label: "Cargar nota",
            onPress: () => {
              setNuevoSheetOpen(false);
              Alert.alert("Cargar nota", 'Abrí una evaluación rendida desde su fila y usá "Asignar nota".');
            },
          },
          { icon: "calendar-outline" as const, label: "Evento personal", onPress: () => abrirCrear({ kind: "personal" }) },
        ].map((opt, i) => (
          <PressableScale
            key={opt.label}
            scaleTo={0.99}
            onPress={opt.onPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.borderFaint,
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
              <AppIcon name={opt.icon} size={16} color={colors.text} />
            </View>
            <AppText weight="500" style={{ fontSize: 15 }}>
              {opt.label}
            </AppText>
          </PressableScale>
        ))}
      </BottomSheet>

      {/* Crear evaluación/tarea/evento */}
      <BottomSheet visible={!!crearModo} onClose={() => setCrearModo(null)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          {crearModo?.kind === "personal" ? "Nuevo evento personal" : crearModo?.kind === "materia" && crearModo.itemKind === "evaluacion" ? "Nueva evaluación" : "Nueva tarea"}
        </AppText>
        <TextInput
          value={creTitulo}
          onChangeText={setCreTitulo}
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
        {crearModo?.kind === "materia" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {materiasRows.map((m) => (
              <PressableScale key={m.id} scaleTo={0.96} onPress={() => setCreMateriaId(m.id)}>
                <Pill
                  label={m.nombre}
                  color={creMateriaId === m.id ? materiaColors[m.colorId].strong : colors.textSecondary}
                  background={creMateriaId === m.id ? materiaColors[m.colorId].soft : colors.surfaceSoft}
                  style={{ height: 32, paddingHorizontal: 13 }}
                />
              </PressableScale>
            ))}
          </View>
        ) : (
          <PressableScale scaleTo={0.98} onPress={() => setCreTodoElDia((v) => !v)}>
            <Pill
              label={creTodoElDia ? "Todo el día" : "Con horario"}
              color={colors.accentText}
              background={colors.accentSoft}
              style={{ height: 32, paddingHorizontal: 13 }}
            />
          </PressableScale>
        )}
        <AppText style={{ fontSize: 12, color: colors.textFaint }}>Se agenda para hoy — la fecha se podrá elegir en la próxima iteración.</AppText>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setCrearModo(null)} />
          <PrimaryButton label="Crear" flex disabled={!creTitulo.trim()} onPress={confirmarCrear} />
        </View>
      </BottomSheet>

      {/* Asignar nota */}
      <BottomSheet visible={!!notaSheetItem} onClose={() => setNotaSheetItem(null)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Asignar nota
        </AppText>
        <AppText style={{ fontSize: 14, color: colors.textSecondary }} numberOfLines={1}>
          {notaSheetItem?.titulo} · {notaSheetItem?.materiaNombre}
        </AppText>
        <TextInput
          value={notaInput}
          onChangeText={setNotaInput}
          placeholder={`Nota sobre ${notaSheetItem?.notaMaxima ?? 12}`}
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          style={{
            height: 48,
            borderRadius: radii.sm,
            backgroundColor: colors.bg,
            paddingHorizontal: spacing.lg,
            fontSize: 15,
            color: colors.text,
            fontFamily: "InstrumentSans_600SemiBold",
          }}
        />
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setNotaSheetItem(null)} />
          <PrimaryButton label="Guardar" flex disabled={!notaInput.trim()} onPress={confirmarNota} />
        </View>
      </BottomSheet>

      {/* Acciones de fila */}
      <BottomSheet visible={!!actionItem} onClose={() => setActionItem(null)}>
        <AppText weight="600" style={{ fontSize: 17 }} numberOfLines={1}>
          {actionItem?.titulo}
        </AppText>
        {actionItem?.kind === "materia" ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              if (actionItem) toggleHecho(actionItem.id);
              setActionItem(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
          >
            <AppIcon name={actionItem?.hecho ? "arrow-undo-outline" : "checkmark-circle-outline"} size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              {actionItem?.hecho ? "Marcar como pendiente" : actionItem?.itemKind === "evaluacion" ? "Marcar como rendida" : "Marcar como entregada"}
            </AppText>
          </PressableScale>
        ) : null}
        {actionItem?.kind === "materia" && actionItem.itemKind === "evaluacion" && actionItem.hecho && actionItem.nota == null ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              setNotaSheetItem(actionItem);
              setNotaInput("");
              setActionItem(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderFaint }}
          >
            <AppIcon name="create-outline" size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              Asignar nota
            </AppText>
          </PressableScale>
        ) : null}
        {actionItem?.kind === "materia" && actionItem.materiaId ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              const id = actionItem.materiaId;
              setActionItem(null);
              if (id) router.push(`/materia/${id}`);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderFaint }}
          >
            <AppIcon name="folder-outline" size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              Ver materia
            </AppText>
          </PressableScale>
        ) : null}
        <PressableScale
          scaleTo={0.99}
          onPress={() => {
            const id = actionItem?.id;
            const titulo = actionItem?.titulo;
            setActionItem(null);
            if (!id) return;
            Alert.alert("Eliminar", `¿Eliminar "${titulo}" de la agenda?`, [
              { text: "Cancelar", style: "cancel" },
              { text: "Eliminar", style: "destructive", onPress: () => eliminarItem(id) },
            ]);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderFaint }}
        >
          <AppIcon name="trash-outline" size={18} color={colors.dangerText} />
          <AppText weight="500" style={{ fontSize: 15, color: colors.dangerText }}>
            Eliminar
          </AppText>
        </PressableScale>
      </BottomSheet>
    </SafeAreaView>
  );
}
