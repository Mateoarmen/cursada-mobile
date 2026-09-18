import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BackButton, PressableScale, ProgressRing, Reveal, Spotlight } from "@/components/ui";
import { AsistenciaRow } from "@/components/AsistenciaRow";
import { supabase } from "@/lib/supabase";
import { getSemestreActivoId } from "@/lib/semestres";
import { materiaComputadaToRow } from "@/lib/materias";
import type { Materia } from "@/types/database";
import {
  addDias,
  esMismoDia,
  formatFechaLarga,
  materiasConClaseEnFecha,
  statsGeneral,
  statsPorMateria,
  toISODate,
  tonePorPct,
  type AsistenciaRango,
} from "@/lib/asistencia";
import { useAsistencia } from "@/hooks/useAsistencia";

const RANGOS: { key: AsistenciaRango; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "semestre", label: "Semestre" },
];

function hoy(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>{children}</View>;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2, paddingBottom: spacing.sm }}>
      {children}
    </AppText>
  );
}

function BarraProgreso({ pct, color }: { pct: number; color: string }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", borderRadius: radii.round, backgroundColor: color }} />
    </View>
  );
}

export default function AsistenciaScreen() {
  const { colors, tone } = useTheme();
  const [rango, setRango] = useState<AsistenciaRango>("semana");
  const [fecha, setFecha] = useState<Date>(hoy());
  const [supaMaterias, setSupaMaterias] = useState<Materia[] | null>(null);
  const { registros, marcar: marcarAsistencia, desmarcar, listo: asistenciaLista } = useAsistencia();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const activeId = await getSemestreActivoId();
      let query = supabase.from("materias").select("*");
      if (activeId) query = query.eq("semestre_id", activeId);
      const { data } = await query;
      if (!cancelado) setSupaMaterias(data ?? []);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const materias = useMemo(() => (supaMaterias ?? []).map((m) => materiaComputadaToRow(m, [])), [supaMaterias]);
  // materia_id -> semestre_id de las materias reales (materiaComputadaToRow
  // no lo trae en el shape DemoMateria) — necesario para el upsert de
  // asistencias, que requiere semestre_id.
  const semestreIdPorMateria = useMemo(
    () => new Map((supaMaterias ?? []).map((m) => [m.id, m.semestre_id])),
    [supaMaterias]
  );
  const listo = asistenciaLista && supaMaterias !== null;

  const marcar = (fechaISO: string, materiaId: string, estado: Parameters<typeof marcarAsistencia>[3] | null) => {
    if (estado == null) {
      desmarcar(fechaISO, materiaId);
      return;
    }
    const semestreId = semestreIdPorMateria.get(materiaId);
    if (!semestreId) return;
    marcarAsistencia(fechaISO, materiaId, semestreId, estado);
  };

  const hoyFija = useMemo(() => hoy(), []);
  const general = useMemo(() => statsGeneral(materias, registros, rango, hoyFija), [materias, rango, registros, hoyFija]);
  const porMateria = useMemo(() => statsPorMateria(materias, registros, rango, hoyFija), [materias, rango, registros, hoyFija]);
  const materiasDelDia = useMemo(() => materiasConClaseEnFecha(materias, fecha), [materias, fecha]);

  const toneGeneral = tonePorPct(general.pct);
  const esHoy = esMismoDia(fecha, hoy());
  const fechaISO = toISODate(fecha);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={280} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
          Asistencia
        </AppText>
      </View>

      {!listo ? (
        <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>Cargando…</AppText>
      ) : (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
      <Reveal style={{ gap: spacing.xl }}>
        {/* Toggle de rango */}
        <View style={{ height: 38, borderRadius: radii.sm, backgroundColor: colors.surfaceSofter, padding: 3, flexDirection: "row", gap: 3 }}>
          {RANGOS.map((r) => (
            <PressableScale
              key={r.key}
              scaleTo={0.98}
              onPress={() => setRango(r.key)}
              style={{
                flex: 1,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: rango === r.key ? colors.text : "transparent",
              }}
            >
              <AppText weight={rango === r.key ? "600" : "500"} style={{ fontSize: 13, color: rango === r.key ? colors.bg : colors.textSecondary }}>
                {r.label}
              </AppText>
            </PressableScale>
          ))}
        </View>

        {general.total === 0 ? (
          <Card>
            <AppText weight="600" style={{ fontSize: 15 }}>
              Todavía no hay asistencia registrada en este rango
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.textTertiary, lineHeight: 18 }}>
              Marcá el historial de acá abajo para empezar a llevar el registro.
            </AppText>
          </Card>
        ) : (
          <>
            {/* Resumen */}
            <View>
              <SectionTitle>Resumen</SectionTitle>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
                  <ProgressRing
                    progress={(general.pct ?? 0) / 100}
                    size={104}
                    strokeWidth={10}
                    color={tone[toneGeneral].strong}
                    centerValue={`${general.pct}%`}
                    centerLabel="asistencia"
                    valueFontSize={20}
                    labelFontSize={11}
                  />
                  <AppText style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                    {general.presentes} de {general.total} clases asistidas
                  </AppText>
                </View>
              </Card>
            </View>

            {/* Por materia */}
            <View>
              <SectionTitle>Por materia</SectionTitle>
              <Card>
                {porMateria.length === 0 ? (
                  <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Sin registros de asistencia en este rango.</AppText>
                ) : (
                  porMateria.map((x, i) => (
                    <View key={x.materia.id} style={{ gap: spacing.xs, paddingTop: i === 0 ? 0 : spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderSoft }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <AppText weight="500" numberOfLines={1} style={{ fontSize: 13, flex: 1 }}>
                          {x.materia.nombre}
                        </AppText>
                        <AppText mono weight="600" style={{ fontSize: 12, color: colors.textTertiary, width: 40, textAlign: "right" }}>
                          {x.pct}%
                        </AppText>
                      </View>
                      <BarraProgreso pct={x.pct ?? 0} color={x.materia.color} />
                    </View>
                  ))
                )}
              </Card>
            </View>
          </>
        )}

        {/* Historial */}
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing.sm }}>
            <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
              Historial
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <PressableScale
                scaleTo={0.9}
                onPress={() => setFecha((f) => addDias(f, -1))}
                style={{ width: 30, height: 30, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}
              >
                <AppIcon name="chevron-back" size={16} color={colors.text} />
              </PressableScale>
              <PressableScale
                scaleTo={0.9}
                disabled={esHoy}
                onPress={() => setFecha((f) => addDias(f, 1))}
                style={{ width: 30, height: 30, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center", opacity: esHoy ? 0.35 : 1 }}
              >
                <AppIcon name="chevron-forward" size={16} color={colors.text} />
              </PressableScale>
            </View>
          </View>
          <Card>
            <AppText weight="600" mono style={{ fontSize: 13, color: colors.textTertiary }}>
              {esHoy ? "Hoy" : formatFechaLarga(fecha)}
            </AppText>
            {materiasDelDia.length === 0 ? (
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Ese día no había materias con clase.</AppText>
            ) : (
              materiasDelDia.map((m, i) => (
                <AsistenciaRow
                  key={m.id}
                  materia={m}
                  isFirst={i === 0}
                  estadoActual={registros[`${fechaISO}|${m.id}`] ?? null}
                  onChange={(estado) => marcar(fechaISO, m.id, estado)}
                />
              ))
            )}
          </Card>
        </View>
      </Reveal>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}
