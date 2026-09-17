import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { colors, estadoLabel, estadoTone, materiaColors, radii, spacing, tone, type EstadoMateria } from "@/theme/tokens";
import { AppText, Fab, Pill, PressableScale, PrimaryButton, ProgressRing } from "@/components/ui";
import { demoMaterias, type DemoMateria } from "@/data/demoContent";
import { calcularPuntosObtenidos, escalaLabel, formatValor, toRow, unidad } from "@/lib/materias";
import { useAgenda } from "@/hooks/useAgenda";

type Row = DemoMateria;
type FiltroEstado = "todas" | EstadoMateria;
type Vista = "tarjetas" | "tabla";

const FILTROS_ORDEN: EstadoMateria[] = ["cursando", "aprobada", "pendiente", "recursando"];

function materiaAbrev(nombre: string) {
  return (nombre.trim().split(/\s+/)[0] ?? "").slice(0, 4).toUpperCase();
}

function MateriaTile({ item }: { item: Row }) {
  const accent = materiaColors[item.colorId];
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radii.sm - 2,
        backgroundColor: accent.strong,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText weight="600" style={{ fontSize: 12, color: colors.white, letterSpacing: -0.1 }}>
        {materiaAbrev(item.nombre)}
      </AppText>
    </View>
  );
}

function EstadoBadge({ estado }: { estado: EstadoMateria }) {
  const t = tone[estadoTone[estado]];
  return (
    <View style={{ height: 24, paddingHorizontal: 11, borderRadius: radii.round, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}>
      <AppText weight="600" style={{ fontSize: 12, color: t.text }}>
        {estadoLabel[estado]}
      </AppText>
    </View>
  );
}

function MateriaCard({ item, onPress }: { item: Row; onPress: () => void }) {
  const t = tone[item.tone];
  const notaTxt = item.promedio > 0 ? formatValor(item.promedio, item.escalaTipo) : "—";
  const pct = item.promedio > 0 ? Math.max(0, Math.min(1, item.promedio / item.escalaTotal)) : 0;
  const aprobTxt = `aprueba ${formatValor(item.escalaAprob, item.escalaTipo)}${unidad(item.escalaTipo)}`;
  const exonTxt = item.escalaExon != null ? `exonera con ${formatValor(item.escalaExon, item.escalaTipo)}${unidad(item.escalaTipo)}` : null;

  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.sm,
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
        <MateriaTile item={item} />
        <EstadoBadge estado={item.estado} />
      </View>

      <View style={{ gap: 3 }}>
        <AppText weight="600" numberOfLines={1} style={{ fontSize: 16, letterSpacing: -0.15 }}>
          {item.nombre}
        </AppText>
        <AppText numberOfLines={1} style={{ fontSize: 14, color: colors.textTertiary }}>
          {item.docente}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
        <ProgressRing size={56} strokeWidth={6} progress={pct} color={t.strong} centerValue={notaTxt} valueFontSize={14} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary }}>
            {item.salon}
          </AppText>
          <AppText numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary }}>
            {item.horarioResumen}
          </AppText>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
          paddingTop: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.borderFaint,
        }}
      >
        <AppText numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, flex: 1 }}>
          {escalaLabel(item.escalaTipo, item.escalaTotal)} · {aprobTxt}
          {exonTxt ? ` · ${exonTxt}` : ""}
        </AppText>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.strong }} />
      </View>
    </PressableScale>
  );
}

function AddMateriaCard({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      style={{
        minHeight: 120,
        borderRadius: radii.sm,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderStyle: "dashed",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentSofter, alignItems: "center", justifyContent: "center" }}>
        <AppText weight="400" style={{ fontSize: 22, color: colors.accentText, lineHeight: 24 }}>
          +
        </AppText>
      </View>
      <AppText weight="500" style={{ fontSize: 14, color: colors.accentText }}>
        Agregá otra materia
      </AppText>
    </PressableScale>
  );
}

function MateriaTableRow({ item, onPress }: { item: Row; onPress: () => void }) {
  const accent = materiaColors[item.colorId];
  const notaTxt = item.promedio > 0 ? formatValor(item.promedio, item.escalaTipo) : "—";
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
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.strong }} />
      <AppText weight="500" numberOfLines={1} style={{ fontSize: 14, flex: 1.3 }}>
        {item.nombre}
      </AppText>
      <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textTertiary, flex: 1 }}>
        {item.docente}
      </AppText>
      <AppText mono weight="600" style={{ fontSize: 13, width: 44, textAlign: "right" }}>
        {notaTxt}/{formatValor(item.escalaAprob, item.escalaTipo)}
      </AppText>
      <View style={{ width: 78, alignItems: "flex-end" }}>
        <EstadoBadge estado={item.estado} />
      </View>
    </PressableScale>
  );
}

function EmptyState({ onPressPrimera }: { onPressPrimera: () => void }) {
  return (
    <View style={{ alignItems: "center", gap: spacing.lg, paddingTop: spacing.xxxl * 2, paddingHorizontal: spacing.xl }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="book-outline" size={34} color={colors.textFaint} />
      </View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Todavía no cargaste ninguna materia
        </AppText>
        <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", lineHeight: 20 }}>
          Empezá con una: nombre, docente, horario y nota de aprobación.
        </AppText>
      </View>
      <PrimaryButton label="Agregar mi primera materia" onPress={onPressPrimera} />
      <AppText style={{ fontSize: 12, color: colors.textGhost }}>nota 0–12, puntaje o porcentaje · vos elegís por materia</AppText>
    </View>
  );
}

export default function MateriasScreen() {
  const [materias, setMaterias] = useState<Materia[] | null>(null);
  const [vista, setVista] = useState<Vista>("tarjetas");
  const [filtro, setFiltro] = useState<FiltroEstado>("todas");
  const [query, setQuery] = useState("");

  // Refetch al enfocar la pantalla (no sólo al montar) para que el alta/
  // edición/borrado de Materia (ver app/materia/form.tsx) se refleje acá al
  // volver, sin agregar el objeto local a mano.
  useFocusEffect(
    useCallback(() => {
      // TODO: filtrar por el semestre activo (ver pantalla Semestre activo)
      supabase
        .from("materias")
        .select("*")
        .then(({ data }) => setMaterias(data ?? []));
    }, [])
  );

  // Agenda/Calendario/Progreso muestran histórico completo a propósito
  // (ver skill cursada-conventions), así que sin filtrar por materia acá:
  // se agrupa todo por materia_id para sumar los puntos de cada una.
  const agenda = useAgenda();
  const agendaByMateria = useMemo(() => {
    const map = new Map<string, { hecho: boolean; nota: number | null }[]>();
    (agenda.rows ?? []).forEach((r) => {
      if (!r.materia_id) return;
      const arr = map.get(r.materia_id) ?? [];
      arr.push({ hecho: r.hecho, nota: r.nota });
      map.set(r.materia_id, arr);
    });
    return map;
  }, [agenda.rows]);

  const rows = useMemo<Row[]>(() => {
    if (materias && materias.length > 0) {
      return materias.map((m) => {
        const row = toRow(m);
        // Anillo/nota de la tarjeta: mismos puntos ya cargados que el
        // anillo de Detalle de materia (ver calcularPuntosObtenidos en
        // lib/materias.ts) — antes venían siempre en 0 (promedio de
        // muestra hardcodeado), por eso el anillo nunca se llenaba.
        const { puntos, hayPuntos, tone: ringTone } = calcularPuntosObtenidos(
          { aprob: row.escalaAprob, exoneracion: row.escalaExon ?? null },
          agendaByMateria.get(m.id) ?? [],
          row.componentesFijos
        );
        return { ...row, promedio: hayPuntos ? puntos : 0, tone: ringTone };
      });
    }
    return demoMaterias;
  }, [materias, agendaByMateria]);

  const counts = useMemo(() => {
    const c: Partial<Record<FiltroEstado, number>> = { todas: rows.length };
    rows.forEach((r) => {
      c[r.estado] = (c[r.estado] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const opciones = useMemo<FiltroEstado[]>(() => ["todas", ...FILTROS_ORDEN.filter((e) => counts[e])], [counts]);

  const filtradas = useMemo(() => {
    let out = filtro === "todas" ? rows : rows.filter((r) => r.estado === filtro);
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((r) => `${r.nombre} ${r.docente}`.toLowerCase().includes(q));
    return out;
  }, [rows, filtro, query]);

  const onNuevaMateria = () => router.push("/materia/nueva");
  const onAbrirMateria = (id: string) => router.push(`/materia/${id}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6 }}>
            Materias
          </AppText>
          <AppText mono style={{ fontSize: 13, color: colors.textTertiary }}>
            {rows.length} {rows.length === 1 ? "materia" : "materias"}
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
          <Ionicons name="search" size={15} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar materia"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, fontSize: 15, color: colors.text, padding: 0 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {rows.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
            <FlatList
              horizontal
              data={opciones}
              keyExtractor={(o) => o}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
              renderItem={({ item: o }) => (
                <PressableScale scaleTo={0.96} onPress={() => setFiltro(o)}>
                  <Pill
                    label={`${o === "todas" ? "Todas" : estadoLabel[o]} · ${counts[o] ?? 0}`}
                    background={filtro === o ? colors.accent : colors.surfaceSoft}
                    color={filtro === o ? colors.white : colors.textSecondary}
                    style={{ height: 32, paddingHorizontal: spacing.md }}
                  />
                </PressableScale>
              )}
            />
          </View>
        ) : null}

        {rows.length > 0 ? (
          <View style={{ height: 38, borderRadius: radii.sm, backgroundColor: colors.surfaceSofter, padding: 3, flexDirection: "row", gap: 3 }}>
            {(["tarjetas", "tabla"] as const).map((key) => (
              <PressableScale
                key={key}
                scaleTo={0.98}
                onPress={() => setVista(key)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: vista === key ? colors.text : "transparent",
                }}
              >
                <AppText weight={vista === key ? "600" : "500"} style={{ fontSize: 14, color: vista === key ? colors.bg : colors.textSecondary }}>
                  {key === "tarjetas" ? "Tarjetas" : "Tabla"}
                </AppText>
              </PressableScale>
            ))}
          </View>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <EmptyState onPressPrimera={onNuevaMateria} />
      ) : vista === "tarjetas" ? (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.smd }}
          renderItem={({ item }) => <MateriaCard item={item} onPress={() => onAbrirMateria(item.id)} />}
          ListFooterComponent={<AddMateriaCard onPress={onNuevaMateria} />}
          ListFooterComponentStyle={{ marginTop: spacing.smd }}
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

      <Fab onPress={onNuevaMateria} />
    </SafeAreaView>
  );
}
