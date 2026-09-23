import { View } from "react-native";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";
import { desglose, type AsistenciaPorMateria } from "@/lib/asistencia";
import { AsistenciaGlyph } from "./AsistenciaGlyph";

function Barra({ pct, color }: { pct: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: radii.round, backgroundColor: color }} />
    </View>
  );
}

// El desglose por materia — es la "tabla" del gráfico de arriba, con los
// mismos números. "marcas": una marca por clase del período (semana, pocas
// clases → se lee cada una). "barra": conteo + % con barra (mes y semestre,
// donde la cantidad de clases ya no cabe como marcas) y, debajo, de dónde
// sale el número. Tocar la fila abre la materia.
export function MateriaFilas({ items, modo, onAbrir }: { items: AsistenciaPorMateria[]; modo: "marcas" | "barra"; onAbrir: (materiaId: string) => void }) {
  const { colors } = useTheme();
  return (
    <View>
      {items.map((x, i) => {
        const { stats } = x;
        const conDatos = stats.total > 0;
        const conteo = conDatos ? (modo === "barra" ? `${stats.presentes} de ${stats.total} · ${stats.pct}%` : `${stats.presentes} de ${stats.total}`) : "Sin registros";
        const detalle = modo === "barra" ? desglose(stats) : "";
        return (
          <PressableScale
            key={x.materia.id}
            scaleTo={0.98}
            onPress={() => onAbrir(x.materia.id)}
            accessibilityLabel={`${x.materia.nombre}: ${conteo}${detalle ? `, ${detalle}` : ""}`}
            accessibilityHint="Abre el detalle de la materia"
            style={{ gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderSoft }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.materia.color }} />
              <AppText weight="500" numberOfLines={1} style={{ fontSize: 14, flex: 1 }}>
                {x.materia.nombre}
              </AppText>
              <AppText mono weight="600" style={{ fontSize: 13, color: conDatos ? colors.text : colors.textTertiary }}>
                {conteo}
              </AppText>
              <AppIcon name="chevron-forward" size={11} color={colors.textFaint} weight="semibold" />
            </View>
            {modo === "barra" ? (
              <>
                <Barra pct={stats.pct ?? 0} color={x.materia.color} />
                {detalle ? <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{detalle}</AppText> : null}
              </>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: spacing.md + 8 }}>
                {x.sesiones.map((s) => (
                  <AsistenciaGlyph key={s.fecha} estado={s.estado} size={18} />
                ))}
              </View>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}
