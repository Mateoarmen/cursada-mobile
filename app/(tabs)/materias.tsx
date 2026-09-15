import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, Fab, PressableScale, ProgressRing } from "@/components/ui";
import { demoMaterias, type DemoMateria } from "@/data/demoContent";

type Row = DemoMateria;

// Combina lo real de Supabase (nombre/color) con las métricas de muestra
// (progreso/promedio/créditos) hasta que el schema tenga esas columnas.
// TODO(backend): sacar el merge con demoMaterias una vez existan esos campos.
function toRow(materia: Materia): Row {
  const match = demoMaterias.find((d) => d.nombre.toLowerCase() === materia.nombre.toLowerCase());
  return (
    match ?? {
      id: materia.id,
      nombre: materia.nombre,
      codigo: "",
      creditos: 0,
      color: materia.color ?? colors.accent,
      progreso: 0,
      promedio: 0,
      horarioResumen: "",
      ubicacionResumen: "",
      evaluaciones: [],
    }
  );
}

export default function MateriasScreen() {
  const [materias, setMaterias] = useState<Materia[] | null>(null);
  const [tab, setTab] = useState<"cursando" | "todas">("cursando");

  useEffect(() => {
    // TODO: filtrar por el semestre activo (ver pantalla Semestre activo)
    supabase
      .from("materias")
      .select("*")
      .then(({ data }) => setMaterias(data ?? []));
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (materias && materias.length > 0) return materias.map(toRow);
    return demoMaterias;
  }, [materias]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6 }}>
            Materias
          </AppText>
          <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{rows.length} cursando</AppText>
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
          <AppText style={{ fontSize: 15, color: colors.textFaint }}>Buscar materia</AppText>
        </View>

        <View style={{ height: 38, borderRadius: radii.sm, backgroundColor: colors.surfaceSofter, padding: 3, flexDirection: "row", gap: 3 }}>
          {(["cursando", "todas"] as const).map((key) => (
            <PressableScale
              key={key}
              scaleTo={0.98}
              onPress={() => setTab(key)}
              style={{
                flex: 1,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tab === key ? colors.text : "transparent",
              }}
            >
              <AppText weight={tab === key ? "600" : "500"} style={{ fontSize: 14, color: tab === key ? colors.bg : colors.textSecondary }}>
                {key === "cursando" ? "Cursando" : "Todas"}
              </AppText>
            </PressableScale>
          ))}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.smd }}
        renderItem={({ item }) => (
          <PressableScale
            scaleTo={0.98}
            onPress={() => router.push(`/materia/${item.id}`)}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.lg,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
              borderLeftWidth: 3,
              borderLeftColor: item.color,
            }}
          >
            <ProgressRing
              progress={item.progreso}
              color={item.color}
              centerValue={`${Math.round(item.progreso * 100)}%`}
              valueFontSize={12}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText weight="600" style={{ fontSize: 16, letterSpacing: -0.1 }}>
                {item.nombre}
              </AppText>
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
                {item.codigo ? `${item.codigo} · ${item.creditos} créditos` : "Sin datos de créditos todavía"}
              </AppText>
            </View>
            {item.promedio > 0 ? (
              <AppText mono weight="600" style={{ fontSize: 17 }}>
                {item.promedio.toFixed(1)}
              </AppText>
            ) : null}
          </PressableScale>
        )}
        ListEmptyComponent={
          <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
            No hay materias cargadas todavía.
          </AppText>
        }
      />

      <Fab onPress={() => {}} />
    </SafeAreaView>
  );
}
