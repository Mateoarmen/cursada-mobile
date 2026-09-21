import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { estadoLabel, estadoTone, materiaColors, radii, spacing, type EstadoMateria } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, CtaGlow, Fab, Pill, PressableScale, PrimaryButton, ProgressRing, Reveal } from "@/components/ui";
import type { DemoMateria } from "@/data/demoContent";
import { escalaLabel, formatValor, materiaComputadaToRow, unidad } from "@/lib/materias";
import { getSemestreActivoId } from "@/lib/semestres";
import { useAgenda } from "@/hooks/useAgenda";

type Row = DemoMateria;
type FiltroEstado = "todas" | EstadoMateria;
type Vista = "tarjetas" | "tabla";

const FILTROS_ORDEN: EstadoMateria[] = ["cursando", "aprobada", "pendiente", "recursando"];

function EstadoBadge({ estado }: { estado: EstadoMateria }) {
  const { tone } = useTheme();
  const t = tone[estadoTone[estado]];
  return (
    <View style={{ height: 24, paddingHorizontal: 11, borderRadius: radii.round, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}>
      <AppText weight="600" style={{ fontSize: 12, color: t.text }}>
        {estadoLabel[estado]}
      </AppText>
    </View>
  );
}

function materiaAbrev(nombre: string) {
  return (nombre.trim().split(/\s+/)[0] ?? "").slice(0, 4).toUpperCase();
}

function MateriaCard({ item, onPress }: { item: Row; onPress: () => void }) {
  const { colors, tone } = useTheme();
  const t = tone[item.tone];
  const accent = materiaColors[item.colorId];
  const notaTxt = item.promedio > 0 ? formatValor(item.promedio, item.escalaTipo) : "—";
  const pct = item.promedio > 0 ? Math.max(0, Math.min(1, item.promedio / item.escalaTotal)) : 0;
  const aprobTxt = `aprueba ${formatValor(item.escalaAprob, item.escalaTipo)}${unidad(item.escalaTipo)}`;
  const exonTxt = item.escalaExon != null ? `exonera con ${formatValor(item.escalaExon, item.escalaTipo)}${unidad(item.escalaTipo)}` : null;
  const lugar = [item.salon, item.horarioResumen].filter(Boolean).join(" · ");

  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.nombre}, ${estadoLabel[item.estado]}, promedio ${notaTxt}`}
      style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}
    >
      {/* Identidad + resultado en una sola fila: el color de la materia vive
          en el tile (mismo que el encabezado del detalle) en vez de un
          borde izquierdo, y el anillo queda a la derecha como lo primero
          que se compara entre materias. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radii.sm, backgroundColor: accent.strong, alignItems: "center", justifyContent: "center" }}>
          <AppText weight="600" style={{ fontSize: 12, color: colors.white }}>
            {materiaAbrev(item.nombre)}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="600" numberOfLines={1} style={{ fontSize: 16, letterSpacing: -0.2 }}>
            {item.nombre}
          </AppText>
          <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textTertiary }}>
            {item.docente}
          </AppText>
        </View>
        <ProgressRing size={54} strokeWidth={5} progress={pct} color={t.strong} centerValue={notaTxt} valueFontSize={14} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <EstadoBadge estado={item.estado} />
        {lugar ? (
          <AppText numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, flex: 1 }}>
            {lugar}
          </AppText>
        ) : null}
      </View>

      <AppText numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary }}>
        {escalaLabel(item.escalaTipo, item.escalaTotal)} · {aprobTxt}
        {exonTxt ? ` · ${exonTxt}` : ""}
      </AppText>
    </PressableScale>
  );
}

function AddMateriaCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      style={{
        minHeight: 96,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderStyle: "dashed",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
      }}
    >
      <AppIcon name="add-circle-outline" size={24} color={colors.accentText} />
      <AppText weight="500" style={{ fontSize: 15, color: colors.accentText }}>
        Agregá otra materia
      </AppText>
    </PressableScale>
  );
}

function MateriaTableRow({ item, onPress }: { item: Row; onPress: () => void }) {
  const { colors } = useTheme();
  const accent = materiaColors[item.colorId];
  const notaTxt = item.promedio > 0 ? formatValor(item.promedio, item.escalaTipo) : "—";
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.nombre}, ${estadoLabel[item.estado]}, promedio ${notaTxt}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 56,
        borderTopWidth: 1,
        borderTopColor: colors.borderFaint,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.strong }} />
      <AppText weight="500" numberOfLines={1} style={{ fontSize: 15, flex: 1.3 }}>
        {item.nombre}
      </AppText>
      <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textTertiary, flex: 1 }}>
        {item.docente}
      </AppText>
      <AppText mono weight="600" numberOfLines={1} style={{ fontSize: 13, width: 60, textAlign: "right" }}>
        {notaTxt}/{formatValor(item.escalaAprob, item.escalaTipo)}
      </AppText>
      <View style={{ width: 78, alignItems: "flex-end" }}>
        <EstadoBadge estado={item.estado} />
      </View>
    </PressableScale>
  );
}

function EmptyState({ onPressPrimera }: { onPressPrimera: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.lg, paddingTop: spacing.xxxl * 2, paddingHorizontal: spacing.xl }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <AppIcon name="book-outline" size={34} color={colors.textFaint} />
      </View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Todavía no cargaste ninguna materia
        </AppText>
        <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", lineHeight: 20 }}>
          Empezá con una: nombre, docente, horario y nota de aprobación.
        </AppText>
      </View>
      {/* Uno de los 3 lugares sancionados para CtaGlow en design.md
          ("#btn-empty-primera"): primer uso, se ve una sola vez hasta
          agregar la primera materia (ver critique P1 de Materias). */}
      <CtaGlow radius={radii.sm}>
        <PrimaryButton label="Agregar mi primera materia" onPress={onPressPrimera} />
      </CtaGlow>
      <AppText style={{ fontSize: 12, color: colors.textGhost }}>nota 0–12, puntaje o porcentaje · vos elegís por materia</AppText>
    </View>
  );
}

export default function MateriasScreen() {
  const { colors } = useTheme();
  const [materias, setMaterias] = useState<Materia[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [vista, setVista] = useState<Vista>("tarjetas");
  const [filtro, setFiltro] = useState<FiltroEstado>("todas");
  const [query, setQuery] = useState("");

  // Refetch al enfocar la pantalla (no sólo al montar) para que el alta/
  // edición/borrado de Materia (ver app/materia/form.tsx) se refleje acá al
  // volver, sin agregar el objeto local a mano. Acotado al semestre activo
  // (mismo criterio que computeMateriasDelActivo en runtime.js): sin
  // semestre activo todavía, no filtra (misma salvedad que la web).
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      setCargando(true);
      (async () => {
        const activeId = await getSemestreActivoId();
        let query = supabase.from("materias").select("*");
        if (activeId) query = query.eq("semestre_id", activeId);
        const { data, error } = await query;
        if (cancelado) return;
        setErrorCarga(!!error);
        if (!error) setMaterias(data ?? []);
        setCargando(false);
      })();
      return () => {
        cancelado = true;
      };
    }, [])
  );

  // Agenda/Calendario/Progreso muestran histórico completo a propósito
  // (ver skill cursada-conventions), así que sin filtrar por materia acá:
  // computeMateria (dentro de materiaComputadaToRow) filtra por materiaId
  // internamente, igual que la web.
  const agenda = useAgenda();
  const { refetch: refetchAgenda } = agenda;

  // useAgenda() no es un store compartido: cada pantalla que lo llama tiene
  // su propia copia de `rows` en memoria. Sin este refetch, una nota/rendido
  // editado en Detalle de materia o Detalle de ítem no se reflejaba acá en
  // el anillo hasta remontar la tab (ver bug reportado: "en la pantalla de
  // materias no actualiza el anillo con la nota").
  useFocusEffect(
    useCallback(() => {
      refetchAgenda();
    }, [refetchAgenda])
  );

  const rows = useMemo<Row[]>(() => {
    if (!materias) return [];
    return materias.map((m) => materiaComputadaToRow(m, agenda.rows ?? []));
  }, [materias, agenda.rows]);

  const counts = useMemo(() => {
    const c: Partial<Record<FiltroEstado, number>> = { todas: rows.length };
    rows.forEach((r) => {
      c[r.estado] = (c[r.estado] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const opciones = useMemo<FiltroEstado[]>(() => ["todas", ...FILTROS_ORDEN.filter((e) => counts[e])], [counts]);

  const filtroActivo = opciones.includes(filtro) ? filtro : "todas";

  const filtradas = useMemo(() => {
    let out = filtroActivo === "todas" ? rows : rows.filter((r) => r.estado === filtroActivo);
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((r) => `${r.nombre} ${r.docente}`.toLowerCase().includes(q));
    return out;
  }, [rows, filtroActivo, query]);

  const onNuevaMateria = () => router.push("/materia/nueva");
  const onAbrirMateria = (id: string) => router.push(`/materia/${id}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 32, letterSpacing: -0.8 }}>
            Materias
          </AppText>
          <AppText mono style={{ fontSize: 13, color: colors.textTertiary }}>
            {rows.length} {rows.length === 1 ? "materia" : "materias"}
          </AppText>
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
            placeholder="Buscar materia"
            accessibilityLabel="Buscar materia"
            clearButtonMode="while-editing"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, fontSize: 15, color: colors.text, padding: 0 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {rows.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <FlatList
              horizontal
              data={opciones}
              keyExtractor={(o) => o}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
              style={{ flex: 1 }}
              renderItem={({ item: o }) => (
                <PressableScale scaleTo={0.96} onPress={() => setFiltro(o)} accessibilityRole="button" accessibilityState={{ selected: filtroActivo === o }}>
                  <Pill
                    label={`${o === "todas" ? "Todas" : estadoLabel[o]} · ${counts[o] ?? 0}`}
                    background={filtroActivo === o ? colors.accent : colors.surfaceSoft}
                    color={filtroActivo === o ? colors.white : colors.textSecondary}
                    style={{ height: 36, paddingHorizontal: spacing.lg }}
                  />
                </PressableScale>
              )}
            />

            {/* Antes era un segmentado de ancho completo con texto
                "Tarjetas"/"Tabla" en su propia fila — dos íconos al lado de
                los filtros dicen lo mismo con menos peso visual y sin
                gastar una fila entera. */}
            <View style={{ flexDirection: "row", backgroundColor: colors.surfaceSofter, borderRadius: radii.sm, padding: 3, gap: 2 }}>
              {(["tarjetas", "tabla"] as const).map((key) => (
                <PressableScale
                  key={key}
                  scaleTo={0.94}
                  onPress={() => setVista(key)}
                  accessibilityLabel={key === "tarjetas" ? "Vista de tarjetas" : "Vista de tabla"}
                  accessibilityState={{ selected: vista === key }}
                  style={{
                    width: 38,
                    height: 36,
                    borderRadius: radii.sm - 2,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: vista === key ? colors.text : "transparent",
                  }}
                >
                  <AppIcon name={key === "tarjetas" ? "grid-outline" : "list-outline"} size={15} color={vista === key ? colors.bg : colors.textSecondary} />
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {cargando && rows.length === 0 ? (
        <View style={{ paddingTop: spacing.xxxl * 2, alignItems: "center" }}>
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      ) : errorCarga && rows.length === 0 ? (
        <View
          accessible
          accessibilityLabel="No pudimos cargar tus materias. Revisá tu conexión y volvé a esta pantalla para reintentar."
          style={{ marginHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.dangerSofter, borderRadius: radii.md, padding: spacing.lg }}
        >
          <AppIcon name="alert-circle-outline" size={18} color={colors.dangerText} />
          <AppText style={{ flex: 1, fontSize: 13, color: colors.dangerText }}>
            No pudimos cargar tus materias. Revisá tu conexión y volvé a esta pantalla para reintentar.
          </AppText>
        </View>
      ) : (
        // Antes el contenido cargado aparecía de golpe apenas resolvía el
        // fetch (mismo anti-patrón que ya se corrigió en Inicio, ver
        // critique P0) — Reveal sólo se monta acá, una vez, cuando se pasa
        // de spinner a contenido real; cambiar de vista (tarjetas/tabla)
        // después no vuelve a montarlo, así que no repite la animación en
        // cada toggle manual del usuario.
        <Reveal style={{ flex: 1 }}>
          {rows.length === 0 ? (
            <EmptyState onPressPrimera={onNuevaMateria} />
          ) : vista === "tarjetas" ? (
            <FlatList
              data={filtradas}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.md }}
              renderItem={({ item }) => <MateriaCard item={item} onPress={() => onAbrirMateria(item.id)} />}
              ListFooterComponent={<AddMateriaCard onPress={onNuevaMateria} />}
              ListFooterComponentStyle={{ marginTop: spacing.md }}
              ListEmptyComponent={
                <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
                  Ninguna materia coincide con la búsqueda.
                </AppText>
              }
            />
          ) : (
            <FlatList
              data={filtradas}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140 }}
              renderItem={({ item }) => <MateriaTableRow item={item} onPress={() => onAbrirMateria(item.id)} />}
              ListEmptyComponent={
                <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
                  Ninguna materia coincide con la búsqueda.
                </AppText>
              }
            />
          )}
        </Reveal>
      )}

      <Fab onPress={onNuevaMateria} />
    </SafeAreaView>
  );
}
