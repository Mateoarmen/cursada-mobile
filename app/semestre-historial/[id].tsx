import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia, Semestre } from "@/types/database";
import { estadoLabel, estadoTone, materiaColors, radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, BackButton, CursadaLoader, Reveal, Spotlight } from "@/components/ui";
import { computeMaterias, escalaLabel, formatValor, unidad, type MateriaComputada } from "@/lib/materias";

// Solo lectura a propósito: no navega a /materia/[id] (esa pantalla tiene
// acciones de edición — cargar nota, simulador, etc. — que no tienen
// sentido sobre un semestre ya cerrado).
function MateriaHistorialRow({ item }: { item: MateriaComputada }) {
  const { colors, tone } = useTheme();
  const t = tone[item.tone];
  const accent = materiaColors[item.raw.color_id as keyof typeof materiaColors] ?? materiaColors.gris;
  const notaTxt = item.actual != null ? formatValor(item.actual, item.esc.tipo) : "—";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.sm,
        padding: spacing.lg,
        gap: spacing.sm,
        borderLeftWidth: 3,
        borderLeftColor: accent.strong,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <AppText weight="600" numberOfLines={1} style={{ fontSize: 15, letterSpacing: -0.15, flex: 1 }}>
          {item.raw.nombre}
        </AppText>
        <View style={{ height: 24, paddingHorizontal: 11, borderRadius: radii.round, backgroundColor: tone[estadoTone[item.raw.estado]].soft, alignItems: "center", justifyContent: "center" }}>
          <AppText weight="600" style={{ fontSize: 12, color: tone[estadoTone[item.raw.estado]].text }}>
            {estadoLabel[item.raw.estado]}
          </AppText>
        </View>
      </View>
      {item.raw.doc ? (
        <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textTertiary }}>
          {item.raw.doc}
        </AppText>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderFaint }}>
        <AppText style={{ fontSize: 12, color: colors.textTertiary }}>
          {escalaLabel(item.esc.tipo, item.esc.total)} · aprueba {formatValor(item.esc.aprob, item.esc.tipo)}
          {unidad(item.esc.tipo)}
        </AppText>
        <AppText mono weight="600" style={{ fontSize: 14, color: t.text }}>
          {notaTxt}
          {item.actual != null ? unidad(item.esc.tipo) : ""}
        </AppText>
      </View>
    </View>
  );
}

export default function SemestreHistorialDetalleScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [semestre, setSemestre] = useState<Semestre | null>(null);
  const [materias, setMaterias] = useState<MateriaComputada[] | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    (async () => {
      const [{ data: sem }, { data: materiasAll }, { data: agendaAll }] = await Promise.all([
        supabase.from("semestres").select("*").eq("id", id).maybeSingle(),
        supabase.from("materias").select("*"),
        supabase.from("agenda").select("*"),
      ]);
      if (cancelado) return;
      setSemestre((sem as Semestre) ?? null);
      setMaterias(computeMaterias((materiasAll ?? []) as Materia[], agendaAll ?? [], id));
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const dataReady = materias !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={240} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }} numberOfLines={1}>
          {semestre?.nombre ?? "Semestre"}
        </AppText>
      </View>

      {!dataReady ? (
        <View style={{ paddingTop: spacing.xxxl * 2, alignItems: "center" }}>
          <CursadaLoader size={44} />
        </View>
      ) : (
        <Reveal style={{ flex: 1 }}>
          <FlatList
            data={materias}
            keyExtractor={(item) => item.raw.id}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.smd, paddingBottom: spacing.xxxl }}
            renderItem={({ item }) => <MateriaHistorialRow item={item} />}
            ListEmptyComponent={
              <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
                Este semestre no tiene materias cargadas.
              </AppText>
            }
          />
        </Reveal>
      )}
    </SafeAreaView>
  );
}
