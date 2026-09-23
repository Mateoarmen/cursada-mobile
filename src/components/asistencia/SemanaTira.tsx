import { View } from "react-native";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, PressableScale } from "@/components/ui";
import { describirDia, esMismoDia, type Sesion } from "@/lib/asistencia";
import { AsistenciaGlyph } from "./AsistenciaGlyph";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export type DiaTira = { fecha: Date; iso: string; sesiones: Sesion[] };

// La semana como una columna por día, con una marca por clase (en el orden
// del día). No lleva nombres de materia: eso lo dan "Por materia" (abajo) y
// el editor del día al tocar — acá se lee el patrón de la semana de un vistazo.
export function SemanaTira({
  dias,
  hoy,
  seleccion,
  onSeleccionar,
}: {
  dias: DiaTira[];
  hoy: Date;
  seleccion: string | null;
  onSeleccionar: (iso: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {dias.map((d) => {
        const esHoy = esMismoDia(d.fecha, hoy);
        const activo = d.iso === seleccion;
        const conClases = d.sesiones.length > 0;
        return (
          <PressableScale
            key={d.iso}
            scaleTo={0.96}
            disabled={!conClases}
            onPress={() => onSeleccionar(d.iso)}
            accessibilityLabel={describirDia(d.fecha, d.sesiones)}
            accessibilityHint={conClases ? "Abre el registro de ese día" : undefined}
            accessibilityState={{ selected: activo, disabled: !conClases }}
            style={{ flex: 1, alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radii.sm, backgroundColor: activo ? colors.surfaceSoft : "transparent" }}
          >
            <AppText maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: colors.textTertiary }}>
              {DIAS[d.fecha.getDay()]}
            </AppText>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: esHoy ? colors.accent : "transparent" }}>
              <AppText maxFontSizeMultiplier={1.3} weight={esHoy ? "700" : "600"} style={{ fontSize: 15, color: esHoy ? colors.white : conClases ? colors.text : colors.textTertiary }}>
                {d.fecha.getDate()}
              </AppText>
            </View>
            <View style={{ gap: 6, alignItems: "center", marginTop: spacing.xs, minHeight: 64 }}>
              {conClases ? (
                d.sesiones.map((s) => <AsistenciaGlyph key={s.materia.id} estado={s.estado} size={26} />)
              ) : (
                <AppText style={{ fontSize: 14, color: colors.textGhost }}>–</AppText>
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
