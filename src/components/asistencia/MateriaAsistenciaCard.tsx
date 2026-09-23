import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";
import { useAsistencia } from "@/hooks/AsistenciaContext";
import { desglose, inicioDelDia, inicioSeguimiento, periodoDe, resumir, sesionesDelPeriodo, type AsistenciaRango, type MateriaAsistencia } from "@/lib/asistencia";
import { AsistenciaGlyph } from "./AsistenciaGlyph";

const RANGOS: { key: AsistenciaRango; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "semestre", label: "Semestre" },
];

// Asistencia de UNA materia dentro de su detalle. Lee los mismos registros
// que la pantalla de Asistencia (estado compartido) y cuenta igual — antes
// leía un campo fijo que quedó siempre en null y decía "Sin registros" sin
// importar lo marcado. Recibe la materia por prop (no la busca en el
// contexto) para que sirva también con una materia de un semestre anterior.
export function MateriaAsistenciaCard({ materia }: { materia: MateriaAsistencia }) {
  const { colors } = useTheme();
  const { registros, listo } = useAsistencia();
  const [rango, setRango] = useState<AsistenciaRango>("semestre");
  const ahora = useMemo(() => new Date(), []);

  const sesiones = useMemo(() => {
    const hoy = inicioDelDia(ahora);
    const inicio = inicioSeguimiento(registros, new Set([materia.id]), hoy);
    return sesionesDelPeriodo([materia], registros, periodoDe(rango, hoy, inicio, hoy), ahora);
  }, [materia, registros, rango, ahora]);
  const stats = useMemo(() => resumir(sesiones), [sesiones]);
  const conDatos = stats.total > 0;
  const detalle = desglose(stats);

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
          Asistencia
        </AppText>
        <View style={{ flexDirection: "row", backgroundColor: colors.surfaceSofter, borderRadius: radii.sm, padding: 3, gap: 2 }} accessibilityRole="tablist">
          {RANGOS.map((r) => {
            const activo = rango === r.key;
            return (
              <PressableScale
                key={r.key}
                scaleTo={0.97}
                onPress={() => setRango(r.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: activo }}
                style={{ height: 30, paddingHorizontal: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: activo ? colors.text : "transparent" }}
              >
                <AppText weight={activo ? "600" : "500"} style={{ fontSize: 12, color: activo ? colors.bg : colors.textSecondary }}>
                  {r.label}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {!listo ? (
        <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Cargando…</AppText>
      ) : conDatos ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <AppText mono weight="700" style={{ fontSize: 22 }}>
              {stats.pct}%
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.textSecondary }}>
              {stats.presentes} de {stats.total} {stats.total === 1 ? "clase" : "clases"}
            </AppText>
          </View>
          {detalle ? <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{detalle}</AppText> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {sesiones.map((s) => (
              <AsistenciaGlyph key={s.fecha} estado={s.estado} size={18} />
            ))}
          </View>
        </View>
      ) : (
        <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
          Sin registros de asistencia en este rango.{stats.pendientes ? ` ${stats.pendientes} sin registrar.` : ""}
        </AppText>
      )}

      <PressableScale
        scaleTo={0.97}
        onPress={() => router.push("/asistencia")}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start" }}
      >
        <AppText weight="600" style={{ fontSize: 13, color: colors.accentText }}>
          Ver toda la asistencia
        </AppText>
        <AppIcon name="chevron-forward" size={11} color={colors.accentText} weight="semibold" />
      </PressableScale>
    </View>
  );
}
