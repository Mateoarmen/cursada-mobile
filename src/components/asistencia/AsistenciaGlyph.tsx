import { Platform, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "@/components/ui";
import type { SesionEstado } from "@/lib/asistencia";

// La marca es decorativa para los lectores de pantalla (el contenedor ya
// dice el estado en su etiqueta). En web react-native-svg reenvía las props
// de accesibilidad nativas al DOM y React se queja: ahí va aria-hidden.
const OCULTA_A11Y =
  Platform.OS === "web"
    ? ({ "aria-hidden": true } as const)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const);

// Marca de estado de una clase. Cada estado tiene una forma distinta además
// de su color (círculo con tilde, cruz, guión, anillo vacío, punto): verde y
// rojo solos no se distinguen con daltonismo, y la marca es lo único que
// dice si a una clase se fue o no.
// Hasta 12 pt (las del calendario, que van chicas) se simplifica: círculo
// lleno / cruz sin círculo / guión, así siguen leyéndose a 8-10 pt.
export function AsistenciaGlyph({ estado, size = 24 }: { estado: SesionEstado; size?: number }) {
  const { colors, tone } = useTheme();
  const chico = size <= 12;
  const verde = tone.success.text;
  const rojo = tone.danger.text;
  // La marca "recortada" del círculo toma el color de la tarjeta: legible en
  // oscuro y en claro sin elegir blanco/negro a mano.
  const tinta = colors.surface;

  let contenido: React.ReactNode;
  if (estado === "asistio") {
    contenido = chico ? (
      <Circle cx={12} cy={12} r={9.5} fill={verde} />
    ) : (
      <>
        <Circle cx={12} cy={12} r={12} fill={verde} />
        <Path d="M6.8 12.6 10.4 16.2 17.4 8.6" stroke={tinta} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  } else if (estado === "no_asistio") {
    contenido = chico ? (
      <>
        <Line x1={5.5} y1={5.5} x2={18.5} y2={18.5} stroke={rojo} strokeWidth={4} strokeLinecap="round" />
        <Line x1={18.5} y1={5.5} x2={5.5} y2={18.5} stroke={rojo} strokeWidth={4} strokeLinecap="round" />
      </>
    ) : (
      <>
        <Circle cx={12} cy={12} r={12} fill={rojo} />
        <Line x1={8.2} y1={8.2} x2={15.8} y2={15.8} stroke={tinta} strokeWidth={2.6} strokeLinecap="round" />
        <Line x1={15.8} y1={8.2} x2={8.2} y2={15.8} stroke={tinta} strokeWidth={2.6} strokeLinecap="round" />
      </>
    );
  } else if (estado === "no_hubo_clase") {
    contenido = chico ? (
      <Line x1={6} y1={12} x2={18} y2={12} stroke={colors.textTertiary} strokeWidth={4} strokeLinecap="round" />
    ) : (
      <>
        <Circle cx={12} cy={12} r={12} fill={colors.surfaceSoft} />
        <Line x1={8} y1={12} x2={16} y2={12} stroke={colors.textTertiary} strokeWidth={2.4} strokeLinecap="round" />
      </>
    );
  } else if (estado === "pendiente") {
    contenido = <Circle cx={12} cy={12} r={chico ? 8.5 : 10.6} stroke={colors.textTertiary} strokeWidth={chico ? 3 : 1.8} fill="none" />;
  } else {
    contenido = <Circle cx={12} cy={12} r={chico ? 3 : 2.6} fill={colors.textGhost} />;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...OCULTA_A11Y}>
      {contenido}
    </Svg>
  );
}

const LEYENDA: { estado: SesionEstado; label: string }[] = [
  { estado: "asistio", label: "Asistí" },
  { estado: "no_asistio", label: "No asistí" },
  { estado: "pendiente", label: "Sin registrar" },
  { estado: "no_hubo_clase", label: "Sin clase" },
];

// Cada marca dice qué significa — sin esto la tira y el calendario son
// símbolos sueltos.
export function AsistenciaLeyenda() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.sm, paddingTop: spacing.xs }}>
      {LEYENDA.map((l) => (
        // Dos por fila: alineadas, sin una etiqueta suelta en la segunda línea.
        <View key={l.estado} style={{ width: "50%", flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 }}>
          <AsistenciaGlyph estado={l.estado} size={14} />
          <AppText style={{ fontSize: 12, color: colors.textSecondary }}>{l.label}</AppText>
        </View>
      ))}
    </View>
  );
}
