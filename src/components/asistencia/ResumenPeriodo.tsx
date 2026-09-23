import { View } from "react-native";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale, ProgressRing } from "@/components/ui";
import { desglose, type AsistenciaStats } from "@/lib/asistencia";
import { Card } from "./Card";

export type Comparacion = { puntos: number; contra: string };

// Lo primero que se lee es la cuenta en clases ("Fuiste a 41 de 50"), que se
// entiende sin saber qué es un porcentaje; el anillo y el % vienen al lado.
// Debajo, de dónde sale el número (faltas, sin clase) y cómo viene contra el
// período anterior — sin un mínimo definido, comparar con uno mismo es el
// único contexto honesto para un %.
export function ResumenPeriodo({
  stats,
  comparacion,
  vacio,
  onVerPendientes,
}: {
  stats: AsistenciaStats;
  comparacion: Comparacion | null;
  vacio: string;
  onVerPendientes?: () => void;
}) {
  const { colors } = useTheme();
  const conDatos = stats.total > 0;
  const titulo = conDatos ? `Fuiste a ${stats.presentes} de ${stats.total} ${stats.total === 1 ? "clase" : "clases"}` : "Todavía sin registros";
  const detalle = conDatos ? desglose({ ...stats, pendientes: 0 }) : vacio;

  let textoComparacion: string | null = null;
  if (comparacion) {
    const p = Math.abs(comparacion.puntos);
    if (comparacion.puntos === 0) textoComparacion = `Igual que la ${comparacion.contra}`;
    else textoComparacion = `${comparacion.puntos > 0 ? "+" : "−"}${p} pts vs. ${comparacion.contra}`;
  }

  return (
    <Card gap={0}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
        <ProgressRing
          progress={(stats.pct ?? 0) / 100}
          size={88}
          strokeWidth={9}
          color={colors.accent}
          trackColor={colors.surfaceSoft}
          centerValue={stats.pct == null ? "—" : `${stats.pct}%`}
          valueFontSize={20}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText weight="600" style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.2 }}>
            {titulo}
          </AppText>
          {detalle ? <AppText style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>{detalle}</AppText> : null}
          {textoComparacion ? <AppText style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 16 }}>{textoComparacion}</AppText> : null}
          {stats.pendientes > 0 && onVerPendientes ? (
            <PressableScale
              scaleTo={0.97}
              onPress={onVerPendientes}
              hitSlop={8}
              accessibilityLabel={`${stats.pendientes} ${stats.pendientes === 1 ? "clase sin registrar" : "clases sin registrar"}. Completar`}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", paddingTop: spacing.xs }}
            >
              <AppText weight="600" style={{ fontSize: 13, color: colors.accentText }}>
                {stats.pendientes} sin registrar
              </AppText>
              <AppIcon name="chevron-forward" size={11} color={colors.accentText} weight="semibold" />
            </PressableScale>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
