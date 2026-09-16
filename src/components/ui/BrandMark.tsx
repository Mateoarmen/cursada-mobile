import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/tokens";

type Props = { size?: number };

// Puerto de `.mark` (styles.css) — el logo real de Cursada: cuadrado
// redondeado con degradé de marca + anillo blanco incompleto (borde
// superior transparente, rotado 45°). Se usa en login, onboarding, el
// gate de carga de sesión y el topbar/sidenav de la web — nunca una letra
// "C" suelta, eso era un placeholder mío, no la marca real.
export function BrandMark({ size = 30 }: Props) {
  const ringSize = size * 0.467;
  const borderWidth = Math.max(1.5, size * 0.087);
  return (
    <LinearGradient
      colors={[colors.accent, colors.accentDeep]}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth,
          borderColor: colors.white,
          borderTopColor: "transparent",
          transform: [{ rotate: "45deg" }],
        }}
      />
    </LinearGradient>
  );
}
