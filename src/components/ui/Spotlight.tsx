import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

type Props = {
  height?: number;
  style?: StyleProp<ViewStyle>;
  // Look original de Inicio: banda azul de marca bien visible arriba (los
  // stops rgba() se pintan opacos en react-native-svg). Sin esto, el
  // resplandor suave de las demás pantallas.
  intenso?: boolean;
};

// Puerto del fondo "spotlight" de `.main` en tema oscuro (styles.css): un
// resplandor radial apenas más claro hacia la esquina superior derecha,
// que se apaga hacia el fondo plano (`--c-bg`) — sin esto un fondo casi
// negro se lee inerte en vez de premium. RN no tiene radial-gradient CSS;
// se resuelve con react-native-svg (ya es dependencia del proyecto, ver
// ProgressRing.tsx). Capa puramente decorativa, absoluta detrás del
// contenido — nunca capta touches.
// react-native-svg descarta el alfa de rgba() en `stopColor` y sólo respeta
// `stopOpacity`: con rgba() los tres stops salían opacos y el resplandor se
// pintaba como un bloque azul pleno de `height` pt.
export function Spotlight({ height = 420, style, intenso = false }: Props) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, height }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          {intenso ? (
            <RadialGradient id="spotlight-intenso" cx="96%" cy="0%" r="85%">
              <Stop offset="0" stopColor="rgba(86,110,160,0.28)" />
              <Stop offset="0.55" stopColor="rgba(44,123,255,0.14)" />
              <Stop offset="1" stopColor="rgba(44,123,255,0)" />
            </RadialGradient>
          ) : (
            <RadialGradient id="spotlight" cx="96%" cy="0%" r="85%">
              <Stop offset="0" stopColor="#566EA0" stopOpacity={0.28} />
              <Stop offset="0.55" stopColor="#2C7BFF" stopOpacity={0.14} />
              <Stop offset="1" stopColor="#2C7BFF" stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>
        <Rect width="100%" height="100%" fill={intenso ? "url(#spotlight-intenso)" : "url(#spotlight)"} />
      </Svg>
    </View>
  );
}
