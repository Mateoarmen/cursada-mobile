import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { materiaColors, radii, spacing, type MateriaColorId } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale, Reveal, Spotlight } from "@/components/ui";
import { DIAS_BLOQUE, DIAS_LARGOS, horaTexto } from "@/lib/catalog";
import { getSemestreActivoId } from "@/lib/semestres";

type BloqueDelDia = {
  id: string;
  materiaNombre: string;
  horaInicio: string;
  horaFin: string;
  ubicacion: string;
  docente: string;
  accentColor: string;
  accentSoft: string;
  ini: number;
  fin: number;
};

// Altura del bloque proporcional a la duración real, sobre una escala
// horaria compartida — antes todos los bloques tenían minHeight:110 fijo,
// así que una clase de 1h y una de 4h se veían idénticas y la columna de
// hora era decorativa (ver critique P0). 64px por hora, piso de 56 para
// que un bloque de 30' siga siendo legible.
const PX_POR_HORA = 64;
const ALTURA_MIN_BLOQUE = 56;

// Lunes (weekStart) de la semana calendario real que contiene "hoy" — los
// bloques de horario son recurrentes por día de semana (no por fecha), pero
// el selector necesita mostrar la fecha real de ESTA semana, no el ordinal
// del día 1–6 que antes se leía como si fuera un número de fecha.
function lunesDeEstaSemana(): Date {
  const hoy = new Date();
  const diff = (hoy.getDay() + 6) % 7; // 0=lunes … 6=domingo
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diff);
  return lunes;
}

function diaDeHoy() {
  const g = new Date().getDay(); // 0=domingo
  return g === 0 ? 1 : g; // sin columna de domingo — cae en lunes, como designDia() en runtime.js
}

// Umbral para no dibujar un "hueco" por ruido de redondeo entre un bloque
// que termina y el siguiente que arranca "pegado" (ej. 10.999 vs 11) — por
// debajo de 5 minutos se sigue tratando como back-to-back.
const HUECO_MIN_HORAS = 5 / 60;

function formatDuracionHueco(horas: number): string {
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min libres`;
  if (m === 0) return `${h} h libres`;
  return `${h} h ${m} min libres`;
}

export default function HorarioScreen() {
  const { colors, shadows } = useTheme();
  const [diaSeleccionado, setDiaSeleccionado] = useState(diaDeHoy());
  const [materias, setMaterias] = useState<Materia[] | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const lunes = useMemo(() => lunesDeEstaSemana(), []);
  const DIAS_SEMANA = useMemo(
    () =>
      DIAS_BLOQUE.map((label, i) => {
        const fecha = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
        return { key: label, label, dia: i + 1, fecha, esHoy: fecha.toDateString() === new Date().toDateString() };
      }),
    [lunes]
  );

  // Acotado al semestre activo — mismo criterio que Materias/Inicio (ver
  // computeMateriasDelActivo en runtime.js/lib/materias.ts).
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      (async () => {
        try {
          const activeId = await getSemestreActivoId();
          let query = supabase.from("materias").select("*");
          if (activeId) query = query.eq("semestre_id", activeId);
          const { data, error } = await query;
          if (cancelado) return;
          if (error) {
            setFetchError(true);
            return;
          }
          setFetchError(false);
          setMaterias(data ?? []);
        } catch {
          if (cancelado) return;
          setFetchError(true);
        }
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
          docente: m.doc || "",
          accentColor: accent.strong,
          accentSoft: accent.soft,
          ini: b.ini,
          fin: b.fin,
        });
        map.set(b.dia, arr);
      });
    });
    map.forEach((arr) => arr.sort((a, b) => a.ini - b.ini));
    return map;
  }, [materias]);

  // Tabs visibles: sólo los días con al menos un bloque cargado (ver
  // critique — antes se mostraban las 6 tabs fijas de DIAS_BLOQUE aunque
  // el estudiante no hubiera cargado nada). Si no hay ningún bloque
  // todavía, fallback a las 6 igual para que el selector no desaparezca.
  const diasVisibles = useMemo(() => {
    const conClase = DIAS_SEMANA.filter((d) => (porDia.get(d.dia)?.length ?? 0) > 0);
    return conClase.length > 0 ? conClase : DIAS_SEMANA;
  }, [DIAS_SEMANA, porDia]);

  const dataReady = materias !== null;

  // Si el día seleccionado (default = hoy) quedó fuera de las tabs
  // visibles, reasignarlo al primero visible.
  useEffect(() => {
    if (!dataReady) return;
    if (!diasVisibles.some((d) => d.dia === diaSeleccionado)) {
      setDiaSeleccionado(diasVisibles[0]!.dia);
    }
  }, [dataReady, diasVisibles, diaSeleccionado]);

  // Carga por día (conteo de clases) para el indicador en el selector —
  // así la semana se lee de un vistazo desde los chips visibles, sin tener
  // que tocar cada día (ver critique P0: Horario no podía responder "¿cómo
  // es mi semana?").
  const cargaPorDia = useMemo(() => {
    const max = Math.max(1, ...diasVisibles.map((d) => porDia.get(d.dia)?.length ?? 0));
    return new Map(diasVisibles.map((d) => [d.dia, (porDia.get(d.dia)?.length ?? 0) / max]));
  }, [porDia, diasVisibles]);

  const bloques = porDia.get(diaSeleccionado) ?? [];
  const resumen = useMemo(() => {
    if (!dataReady) return "";
    if (bloques.length === 0) return "Sin clases este día";
    const horas = bloques.reduce((acc, b) => acc + (b.fin - b.ini), 0);
    const horasTxt = Number.isInteger(horas) ? String(horas) : horas.toFixed(1);
    return `${bloques.length} ${bloques.length === 1 ? "clase" : "clases"} · ${horasTxt} h · primera ${bloques[0]!.horaInicio}`;
  }, [bloques, dataReady]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={280} />
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 32, letterSpacing: -0.8 }}>
            Horario
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {diasVisibles.map((d) => {
            const active = d.dia === diaSeleccionado;
            const carga = cargaPorDia.get(d.dia) ?? 0;
            return (
              <PressableScale
                key={d.key}
                scaleTo={0.95}
                onPress={() => setDiaSeleccionado(d.dia)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${d.label}${d.esHoy ? ", hoy" : ""}, ${d.fecha.getDate()}`}
                style={[
                  {
                    flex: 1,
                    height: 64,
                    borderRadius: radii.md,
                    backgroundColor: active ? colors.accent : colors.surfaceSofter,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    borderWidth: !active && d.esHoy ? 1.5 : 0,
                    borderColor: colors.accent,
                  },
                  active ? shadows.horarioDiaActivo : null,
                ]}
              >
                <AppText
                  weight="600"
                  style={{
                    fontSize: 12,
                    color: active ? colors.white : colors.textTertiary,
                  }}
                >
                  {d.label}
                </AppText>
                <AppText weight={active ? "700" : "600"} style={{ fontSize: 17, color: active ? colors.white : colors.text }}>
                  {d.fecha.getDate()}
                </AppText>
                {/* Indicador de carga: una barra que crece con la cantidad
                    de clases del día, para leer la semana desde el selector
                    sin tocar cada chip. */}
                <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: active ? "rgba(255,255,255,0.5)" : colors.borderSoft, overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${Math.max(carga * 100, carga > 0 ? 25 : 0)}%`,
                      height: "100%",
                      backgroundColor: active ? colors.white : colors.accentText,
                    }}
                  />
                </View>
              </PressableScale>
            );
          })}
        </View>
        <View style={{ gap: 2, paddingTop: spacing.sm }}>
          {dataReady ? (
            <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.5 }}>
              {DIAS_LARGOS[diaSeleccionado]} {(DIAS_SEMANA.find((d) => d.dia === diaSeleccionado) ?? DIAS_SEMANA[0]!).fecha.getDate()}
            </AppText>
          ) : null}
          {dataReady || !fetchError ? (
            <AppText style={{ fontSize: 14, color: colors.textSecondary }}>{dataReady ? resumen : "Cargando…"}</AppText>
          ) : null}
        </View>
      </View>

      {!dataReady && fetchError ? (
        <View
          accessible
          accessibilityLabel="No pudimos cargar tu horario. Revisá tu conexión y volvé a esta pantalla para reintentar."
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
            No pudimos cargar tu horario. Revisá tu conexión y volvé a esta pantalla para reintentar.
          </AppText>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {!dataReady ? null : bloques.length === 0 ? (
          <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
            No hay clases cargadas para este día.
          </AppText>
        ) : (
          <Reveal>
            {bloques.map((b, i) => {
              const alturaBloque = Math.max(ALTURA_MIN_BLOQUE, (b.fin - b.ini) * PX_POR_HORA);
              const prev = bloques[i - 1];
              const gap = prev ? b.ini - prev.fin : 0;
              const hayHueco = i > 0 && gap > HUECO_MIN_HORAS;
              return (
                <View key={b.id}>
                  {hayHueco ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: 44 + spacing.lg, paddingVertical: spacing.md }}>
                      <View style={{ flex: 1, height: 0, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors.borderSoft }} />
                      <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{formatDuracionHueco(gap)}</AppText>
                      <View style={{ flex: 1, height: 0, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors.borderSoft }} />
                    </View>
                  ) : null}
                  <View
                    accessible
                    accessibilityLabel={`${b.materiaNombre}, de ${b.horaInicio} a ${b.horaFin}, ${b.ubicacion}${b.docente ? `, ${b.docente}` : ""}`}
                    style={{ flexDirection: "row", gap: spacing.lg, paddingTop: i === 0 ? spacing.sm : hayHueco ? 0 : spacing.md }}
                  >
                    <View style={{ width: 44, paddingTop: spacing.lg, gap: 2 }}>
                      <AppText mono style={{ fontSize: 14, color: colors.text }}>
                        {b.horaInicio}
                      </AppText>
                      <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
                        {b.horaFin}
                      </AppText>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: b.accentSoft,
                        borderRadius: radii.lg,
                        padding: spacing.lg,
                        gap: spacing.xs,
                        minHeight: alturaBloque,
                        justifyContent: "center",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.accentColor }} />
                        <AppText weight="600" numberOfLines={2} style={{ fontSize: 17, letterSpacing: -0.2, flex: 1 }}>
                          {b.materiaNombre}
                        </AppText>
                      </View>
                      <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={2}>
                        {b.ubicacion}
                        {b.docente ? ` · ${b.docente}` : ""}
                      </AppText>
                    </View>
                  </View>
                </View>
              );
            })}
          </Reveal>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
