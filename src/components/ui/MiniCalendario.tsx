import { useMemo, useState } from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { radii, spacing } from "@/theme/tokens";
import { MESES_LARGOS, parseISODate, today } from "@/lib/agenda";
import { AppIcon } from "./AppIcon";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

// Calendario propio en RN puro (sin @react-native-community/datetimepicker
// — habría requerido un build EAS/dev client nuevo para poder probarlo, ver
// decisión con el usuario) — compartido entre "Nueva evaluación/tarea"
// (Agenda) y "Editar evaluación" (Detalle de ítem).
const DIAS_CALENDARIO = ["L", "M", "M", "J", "V", "S", "D"];

function isoDeFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoDeHoy(): string {
  return isoDeFecha(today());
}

// Grilla del mes con relleno inicial (null) para que el día 1 caiga en su
// columna real de la semana (lunes primero, mismo criterio que
// lunesDeEstaSemana() en horario.tsx).
function celdasDelMes(mes: Date): (Date | null)[] {
  const year = mes.getFullYear();
  const month = mes.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDias = new Date(year, month + 1, 0).getDate();
  const celdas: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= totalDias; d++) celdas.push(new Date(year, month, d));
  return celdas;
}

export function MiniCalendario({ seleccionado, onSeleccionar }: { seleccionado: string; onSeleccionar: (iso: string) => void }) {
  const { colors } = useTheme();
  const [mes, setMes] = useState(() => parseISODate(seleccionado));
  const celdas = useMemo(() => celdasDelMes(mes), [mes]);
  const hoyIso = isoDeHoy();
  const nombreMes = MESES_LARGOS[mes.getMonth()]!;

  return (
    <View style={{ backgroundColor: colors.bg, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PressableScale scaleTo={0.9} hitSlop={8} onPress={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
          <AppIcon name="chevron-back" size={16} color={colors.text} />
        </PressableScale>
        <AppText weight="600" style={{ fontSize: 13 }}>
          {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} {mes.getFullYear()}
        </AppText>
        <PressableScale scaleTo={0.9} hitSlop={8} onPress={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
          <AppIcon name="chevron-forward" size={16} color={colors.text} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: "row" }}>
        {DIAS_CALENDARIO.map((d, i) => (
          <AppText key={i} weight="600" style={{ flex: 1, textAlign: "center", fontSize: 10, color: colors.textFaint }}>
            {d}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {celdas.map((fecha, i) => {
          if (!fecha) return <View key={i} style={{ width: "14.28%", height: 34 }} />;
          const iso = isoDeFecha(fecha);
          const activo = iso === seleccionado;
          const esHoy = iso === hoyIso;
          return (
            <PressableScale
              key={i}
              scaleTo={0.9}
              onPress={() => onSeleccionar(iso)}
              style={{ width: "14.28%", height: 34, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: activo ? colors.accent : "transparent",
                  borderWidth: !activo && esHoy ? 1 : 0,
                  borderColor: colors.accent,
                }}
              >
                <AppText weight={activo ? "700" : "500"} style={{ fontSize: 12, color: activo ? colors.white : colors.text }}>
                  {fecha.getDate()}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
