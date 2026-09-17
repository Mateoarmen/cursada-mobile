import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { colors, materiaColors, radii, spacing, type MateriaColorId } from "@/theme/tokens";
import { AppText, PressableScale } from "@/components/ui";
import { DIAS_BLOQUE, horaTexto } from "@/lib/catalog";
import { getSemestreActivoId } from "@/lib/semestres";

type BloqueDelDia = {
  id: string;
  materiaNombre: string;
  horaInicio: string;
  horaFin: string;
  ubicacion: string;
  accentColor: string;
  accentSoft: string;
  ini: number;
};

const DIAS_SEMANA = DIAS_BLOQUE.map((label, i) => ({ key: label, label, dia: i + 1 }));

function diaDeHoy() {
  const g = new Date().getDay(); // 0=domingo
  return g === 0 ? 1 : g; // sin columna de domingo — cae en lunes, como designDia() en runtime.js
}

export default function HorarioScreen() {
  const [diaSeleccionado, setDiaSeleccionado] = useState(diaDeHoy());
  const [materias, setMaterias] = useState<Materia[] | null>(null);

  // Acotado al semestre activo — mismo criterio que Materias/Inicio (ver
  // computeMateriasDelActivo en runtime.js/lib/materias.ts).
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      (async () => {
        const activeId = await getSemestreActivoId();
        let query = supabase.from("materias").select("*");
        if (activeId) query = query.eq("semestre_id", activeId);
        const { data } = await query;
        if (!cancelado) setMaterias(data ?? []);
      })();
      return () => {
        cancelado = true;
      };
    }, [])
  );

  // Réplica de formatHorario/ACCENTS (runtime.js) armada por día en vez de
  // por materia — un bloque por cada entrada de materia.bloques, coloreado
  // con el mismo acento de identidad que Materias/Detalle.
  const porDia = useMemo(() => {
    const map = new Map<number, BloqueDelDia[]>();
    (materias ?? []).forEach((m) => {
      const colorId = (m.color_id && m.color_id in materiaColors ? m.color_id : "gris") as MateriaColorId;
      const accent = materiaColors[colorId];
      (m.bloques ?? []).forEach((b) => {
        const arr = map.get(b.dia) ?? [];
        arr.push({
          id: `${m.id}-${b.dia}-${b.ini}`,
          materiaNombre: m.nombre,
          horaInicio: horaTexto(b.ini),
          horaFin: horaTexto(b.fin),
          ubicacion: m.salon || "Sin salón asignado",
          accentColor: accent.strong,
          accentSoft: accent.soft,
          ini: b.ini,
        });
        map.set(b.dia, arr);
      });
    });
    map.forEach((arr) => arr.sort((a, b) => a.ini - b.ini));
    return map;
  }, [materias]);

  const bloques = porDia.get(diaSeleccionado) ?? [];
  const resumen = useMemo(() => {
    if (materias === null) return "Cargando…";
    if (bloques.length === 0) return "Sin clases este día";
    const horas = bloques.reduce((acc, b) => {
      const [h1] = b.horaInicio.split(":").map(Number);
      const [h2] = b.horaFin.split(":").map(Number);
      return acc + ((h2 ?? 0) - (h1 ?? 0));
    }, 0);
    return `${bloques.length} ${bloques.length === 1 ? "clase" : "clases"} · ${horas} h · primera ${bloques[0]!.horaInicio}`;
  }, [bloques, materias]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6 }}>
            Horario
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: 7 }}>
          {DIAS_SEMANA.map((d) => {
            const active = d.dia === diaSeleccionado;
            return (
              <PressableScale
                key={d.key}
                scaleTo={0.95}
                onPress={() => setDiaSeleccionado(d.dia)}
                style={{
                  flex: 1,
                  height: 58,
                  borderRadius: 14,
                  backgroundColor: active ? colors.accent : colors.surfaceSofter,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <AppText
                  weight="600"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    color: active ? "rgba(255,255,255,0.75)" : colors.textTertiary,
                  }}
                >
                  {d.label}
                </AppText>
                <AppText weight={active ? "700" : "600"} style={{ fontSize: 16, color: active ? colors.white : colors.text }}>
                  {d.dia}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
        <AppText style={{ fontSize: 14, color: colors.textSecondary }}>{resumen}</AppText>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {bloques.length === 0 ? (
          <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
            {materias === null ? "Cargando…" : "No hay clases cargadas para este día."}
          </AppText>
        ) : (
          bloques.map((b, i) => (
            <View key={b.id} style={{ flexDirection: "row", gap: spacing.lg, paddingTop: i === 0 ? spacing.sm : spacing.md + 2 }}>
              <AppText mono style={{ width: 44, fontSize: 12, color: colors.textGhost }}>
                {b.horaInicio}
              </AppText>
              <View
                style={{
                  flex: 1,
                  backgroundColor: b.accentSoft,
                  borderLeftWidth: 3,
                  borderLeftColor: b.accentColor,
                  borderRadius: 0,
                  borderTopRightRadius: radii.md,
                  borderBottomRightRadius: radii.md,
                  padding: spacing.lg,
                  gap: 5,
                  minHeight: 110,
                }}
              >
                <AppText weight="600" style={{ fontSize: 16, letterSpacing: -0.1 }}>
                  {b.materiaNombre}
                </AppText>
                <AppText mono style={{ fontSize: 13, color: colors.textSecondary }}>
                  {b.horaInicio}–{b.horaFin}
                </AppText>
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{b.ubicacion}</AppText>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
