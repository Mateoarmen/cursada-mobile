import { useMemo } from "react";
import { View } from "react-native";
import { radii } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, PressableScale } from "@/components/ui";
import { describirDia, esMismoDia, toISODate, type Sesion } from "@/lib/asistencia";
import { AsistenciaGlyph } from "./AsistenciaGlyph";

const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];
const COLUMNA = "14.285714%";

// Grilla del mes con relleno inicial (null) para que el día 1 caiga en su
// columna real (lunes primero, mismo criterio que MiniCalendario y Horario).
function celdasDelMes(mes: Date): (Date | null)[] {
  const y = mes.getFullYear();
  const m = mes.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const celdas: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= total; d++) celdas.push(new Date(y, m, d));
  return celdas;
}

// El mes como calendario: cada día con clases lleva una marca por clase
// debajo del número (cada una con su forma, ver AsistenciaGlyph). Sólo los
// días con clases responden al toque — abren el editor de ese día.
export function MesCalendario({
  mes,
  sesionesPorDia,
  hoy,
  seleccion,
  onSeleccionar,
}: {
  mes: Date;
  sesionesPorDia: Map<string, Sesion[]>;
  hoy: Date;
  seleccion: string | null;
  onSeleccionar: (iso: string) => void;
}) {
  const { colors } = useTheme();
  const celdas = useMemo(() => celdasDelMes(mes), [mes]);
  return (
    <View>
      <View style={{ flexDirection: "row", paddingBottom: 4 }}>
        {INICIALES.map((l, i) => (
          <AppText key={i} weight="600" maxFontSizeMultiplier={1.3} style={{ width: COLUMNA, textAlign: "center", fontSize: 11, color: colors.textTertiary }}>
            {l}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {celdas.map((fecha, i) => {
          if (!fecha) return <View key={`v${i}`} style={{ width: COLUMNA, minHeight: 56 }} />;
          const iso = toISODate(fecha);
          const sesiones = sesionesPorDia.get(iso) ?? [];
          const conClases = sesiones.length > 0;
          const esHoy = esMismoDia(fecha, hoy);
          const activo = iso === seleccion;
          return (
            <View key={iso} style={{ width: COLUMNA, minHeight: 56 }}>
              <PressableScale
                scaleTo={0.94}
                disabled={!conClases}
                onPress={() => onSeleccionar(iso)}
                accessibilityLabel={describirDia(fecha, sesiones)}
                accessibilityHint={conClases ? "Abre el registro de ese día" : undefined}
                accessibilityState={{ selected: activo, disabled: !conClases }}
                style={{ flex: 1, margin: 1, alignItems: "center", paddingTop: 3, paddingBottom: 4, borderRadius: radii.sm - 2, backgroundColor: activo ? colors.surfaceSoft : "transparent" }}
              >
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: esHoy ? colors.accent : "transparent" }}>
                  <AppText maxFontSizeMultiplier={1.3} weight={esHoy ? "700" : "500"} style={{ fontSize: 14, color: esHoy ? colors.white : conClases ? colors.text : colors.textTertiary }}>
                    {fecha.getDate()}
                  </AppText>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 2, marginTop: 3, minHeight: 8 }}>
                  {sesiones.map((s) => (
                    <AsistenciaGlyph key={s.materia.id} estado={s.estado} size={8} />
                  ))}
                </View>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}
