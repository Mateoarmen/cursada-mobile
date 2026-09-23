import { View } from "react-native";
import { radii } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, PressableScale } from "@/components/ui";
import { ASISTENCIA_ESTADOS, asistenciaEstadoLabel, type AsistenciaEstado, type MateriaAsistencia } from "@/lib/asistencia";

// Fila reusable materia + control de 3 estados — la usan el aviso diario
// (ver AsistenciaDiarioGate) y el editor de día de la pantalla de Asistencia,
// igual que buildAsistenciaRow() en la web (un solo componente en los dos
// lugares, no se reimplementa).
function EstadoSegmentado({
  nombre,
  estadoActual,
  onChange,
}: {
  nombre: string;
  estadoActual: AsistenciaEstado | null;
  onChange: (estado: AsistenciaEstado | null) => void;
}) {
  const { colors, tone } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {ASISTENCIA_ESTADOS.map((estado) => {
        const activo = estadoActual === estado;
        const activeColor = estado === "asistio" ? tone.success.strong : estado === "no_asistio" ? tone.danger.strong : colors.neutral;
        const activeText = estado === "no_hubo_clase" ? colors.bg : colors.white;
        return (
          <PressableScale
            key={estado}
            scaleTo={0.95}
            // Tocar el estado ya seleccionado lo deshace (vuelve a null) en
            // vez de quedar pegado — cualquier otro estado simplemente
            // reemplaza al anterior.
            onPress={() => onChange(activo ? null : estado)}
            accessibilityLabel={`${nombre}: ${asistenciaEstadoLabel[estado]}`}
            accessibilityState={{ selected: activo }}
            style={{
              flex: 1,
              // 44 pt: es el gesto más repetido de la pantalla (una vez por
              // materia por día) — el mínimo de toque de iOS, no 34.
              height: 44,
              borderRadius: radii.sm - 2,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 4,
              backgroundColor: activo ? activeColor : colors.surfaceSoft,
            }}
          >
            <AppText weight="600" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 12, color: activo ? activeText : colors.textSecondary }}>
              {asistenciaEstadoLabel[estado]}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function AsistenciaRow({
  materia,
  estadoActual,
  onChange,
  isFirst,
}: {
  materia: MateriaAsistencia;
  estadoActual: AsistenciaEstado | null;
  onChange: (estado: AsistenciaEstado | null) => void;
  isFirst: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8, paddingTop: isFirst ? 0 : 12, borderTopWidth: isFirst ? 0 : 1, borderTopColor: colors.borderSoft }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: materia.color }} />
        <AppText weight="500" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>
          {materia.nombre}
        </AppText>
      </View>
      <EstadoSegmentado nombre={materia.nombre} estadoActual={estadoActual} onChange={onChange} />
    </View>
  );
}
