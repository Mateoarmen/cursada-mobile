import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Alert, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { colors, materiaColors, radii, spacing, tone, type Tone } from "@/theme/tokens";
import { AppIcon, AppText, BottomSheet, Fab, Pill, PressableScale, PrimaryButton, Reveal, Spotlight } from "@/components/ui";
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
  MESES_LARGOS,
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

const FECHA_QUICK_LABELS = ["Hoy", "Mañana", "Pasado", "En una semana"];
const FECHA_QUICK_OFFSETS = [0, 1, 2, 7];

// Opciones rápidas de fecha para el sheet de creación — sin agregar una
// dependencia nativa de date-picker sólo para esto (ver critique P2: antes
// todo ítem nuevo nacía "hoy" sin poder elegir, corrompiendo el
// agrupamiento de Agenda). Cubre el caso real de uso: cargar algo que ya
// se sabe hoy/mañana/en unos días, no un calendario completo.
function fechaQuickOptions() {
  const base = today();
  return FECHA_QUICK_OFFSETS.map((offset, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return { value: d.toISOString().slice(0, 10), label: FECHA_QUICK_LABELS[i]! };
  });
}

// Calendario propio en RN puro (sin @react-native-community/datetimepicker
// — habría requerido un build EAS/dev client nuevo para poder probarlo,
// ver decisión con el usuario) — cubre el caso que las 4 opciones rápidas
// de arriba no alcanzaban: una fecha cualquiera dentro del mes (ej. un
// parcial a mitad de mes).
const DIAS_CALENDARIO = ["L", "M", "M", "J", "V", "S", "D"];

function isoDeFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Grilla del mes con relleno inicial (null) para que el día 1 caiga en su
// columna real de la semana (lunes primero, mismo criterio que
// lunesDeEstaSemana() en horario.tsx).
function celdasDelMes(mes: Date): (Date | null)[] {
  const year = mes.getFullYear();
  const month = mes.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDias = new Date(year, month + 1, 0).getDate();
  const celdas: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= totalDias; d++) celdas.push(new Date(year, month, d));
  return celdas;
}

function MiniCalendario({ seleccionado, onSeleccionar }: { seleccionado: string; onSeleccionar: (iso: string) => void }) {
  const [mes, setMes] = useState(() => parseISODate(seleccionado));
  const celdas = useMemo(() => celdasDelMes(mes), [mes]);
  const hoyIso = isoToday();
  const nombreMes = MESES_LARGOS[mes.getMonth()]!;

  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PressableScale scaleTo={0.9} hitSlop={8} onPress={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
          <AppIcon name="chevron-back" size={16} color={colors.text} />
        </PressableScale>
        <AppText weight="600" style={{ fontSize: 13 }}>
          {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} {mes.getFullYear()}
        </AppText>
        <PressableScale scaleTo={0.9} hitSlop={8} onPress={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
          <AppIcon name="chevron-forward" size={16} color={colors.text} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: "row" }}>
        {DIAS_CALENDARIO.map((d, i) => (
          <AppText key={i} weight="600" style={{ flex: 1, textAlign: "center", fontSize: 10, color: colors.textFaint }}>
            {d}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {celdas.map((fecha, i) => {
          if (!fecha) return <View key={i} style={{ width: "14.28%", height: 34 }} />;
          const iso = isoDeFecha(fecha);
          const activo = iso === seleccionado;
          const esHoy = iso === hoyIso;
          return (
            <PressableScale
              key={i}
              scaleTo={0.9}
              onPress={() => onSeleccionar(iso)}
              style={{ width: "14.28%", height: 34, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: activo ? colors.accent : "transparent",
                  borderWidth: !activo && esHoy ? 1 : 0,
                  borderColor: colors.accent,
                }}
              >
                <AppText weight={activo ? "700" : "500"} style={{ fontSize: 12, color: activo ? colors.white : colors.text }}>
                  {fecha.getDate()}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
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
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.hecho, disabled: !esMateria }}
        accessibilityLabel={esMateria ? (item.hecho ? "Marcar como pendiente" : "Marcar como completado") : undefined}
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

  const [filtrosSheetOpen, setFiltrosSheetOpen] = useState(false);
  const [nuevoSheetOpen, setNuevoSheetOpen] = useState(false);

  const [crearModo, setCrearModo] = useState<{ kind: "materia"; itemKind: "evaluacion" | "tarea" } | { kind: "personal" } | null>(null);
  const [creTitulo, setCreTitulo] = useState("");
  const [creMateriaId, setCreMateriaId] = useState(materiasRows[0]?.id ?? "");
  const [creTodoElDia, setCreTodoElDia] = useState(true);
  const [creFecha, setCreFecha] = useState(isoToday());
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);

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

  const abrirCrear = (modo: typeof crearModo) => {
    setNuevoSheetOpen(false);
    setCreTitulo("");
    setCreMateriaId(materiasRows[0]?.id ?? "");
    setCreTodoElDia(true);
    setCreFecha(isoToday());
    setCalendarioAbierto(false);
    setCrearModo(modo);
  };

  const confirmarCrear = async () => {
    if (!crearModo || !creTitulo.trim()) return;
    if (crearModo.kind === "personal") {
      const ok = await personal.crear({ titulo: creTitulo.trim(), fecha: creFecha, todoElDia: creTodoElDia });
      if (!ok) {
        avisarError("No se pudo crear");
        return;
      }
      setCrearModo(null);
      return;
    }
    const tipo = crearModo.itemKind === "evaluacion" ? "Parcial" : "Entrega";
    const ok = await agenda.crear({ materiaId: creMateriaId, kind: crearModo.itemKind, tipo, titulo: creTitulo.trim(), fecha: creFecha });
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, flex: 1 }}>
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
              height: 32,
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {!dataReady ? (
          <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>Cargando tu agenda…</AppText>
        ) : (
          <Reveal style={{ gap: spacing.lg }}>
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
                <PrimaryButton label="+ Nuevo" onPress={() => setNuevoSheetOpen(true)} />
              </View>
            ) : null}
          </Reveal>
        )}
      </ScrollView>

      <Fab onPress={() => setNuevoSheetOpen(true)} />

      {/* Filtros: materia + estado combinados */}
      <BottomSheet visible={filtrosSheetOpen} onClose={() => setFiltrosSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Filtros
        </AppText>
        <AppText weight="700" style={{ fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase", color: colors.textFaint, paddingTop: spacing.xs }}>
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

        <AppText weight="700" style={{ fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase", color: colors.textFaint, paddingTop: spacing.lg }}>
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

        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.md }}>
          <PrimaryButton label="Limpiar" variant="ghost" flex onPress={limpiarFiltros} />
          <PrimaryButton label="Listo" flex onPress={() => setFiltrosSheetOpen(false)} />
        </View>
      </BottomSheet>

      {/* + Nuevo */}
      <BottomSheet visible={nuevoSheetOpen} onClose={() => setNuevoSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Crear nuevo
        </AppText>
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {fechaQuickOptions().map((o) => (
            <PressableScale
              key={o.value}
              scaleTo={0.96}
              onPress={() => {
                setCreFecha(o.value);
                setCalendarioAbierto(false);
              }}
            >
              <Pill
                label={o.label}
                color={!calendarioAbierto && creFecha === o.value ? colors.accentText : colors.textSecondary}
                background={!calendarioAbierto && creFecha === o.value ? colors.accentSoft : colors.surfaceSoft}
                style={{ height: 32, paddingHorizontal: 13 }}
              />
            </PressableScale>
          ))}
          <PressableScale scaleTo={0.96} onPress={() => setCalendarioAbierto((v) => !v)}>
            <Pill
              label={calendarioAbierto || !fechaQuickOptions().some((o) => o.value === creFecha) ? formatFechaAgenda(creFecha) : "Elegir fecha"}
              color={calendarioAbierto ? colors.accentText : colors.textSecondary}
              background={calendarioAbierto ? colors.accentSoft : colors.surfaceSoft}
              style={{ height: 32, paddingHorizontal: 13 }}
            />
          </PressableScale>
        </View>
        {calendarioAbierto ? (
          <MiniCalendario
            seleccionado={creFecha}
            onSeleccionar={(iso) => {
              setCreFecha(iso);
              setCalendarioAbierto(false);
            }}
          />
        ) : null}
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setCrearModo(null)} />
          <PrimaryButton label="Crear" flex disabled={!creTitulo.trim()} onPress={confirmarCrear} />
        </View>
      </BottomSheet>

    </SafeAreaView>
  );
}
