import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "./AppText";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Vuelta completa + pausa con el logo quieto: cada ciclo termina
// exactamente en la pose del logo real, así que el loader nunca "se corta"
// en un ángulo raro si desaparece entre ciclos.
const VUELTA_MS = 1100;
const PAUSA_MS = 280;
// El anillo de BrandMark deja un cuarto abierto (de las 12 a las 3).
const ARCO_LOGO = 0.75;

type Props = {
  size?: number;
  label?: string;
};

// Loader de marca: el mismo BrandMark (cuadrado con degradé + la "C"), pero
// la C da una vuelta completa mientras se cierra en un círculo entero y
// vuelve a abrirse, para quedar otra vez como el logo original antes del
// siguiente ciclo. El anillo se dibuja con SVG (no con borde transparente
// como BrandMark) para poder animar el largo del arco; la geometría es la
// misma: trazo que arranca a las 3 en sentido horario y cubre 3/4.
// Con "Reducir movimiento" no gira: late suave en opacidad.
export function CursadaLoader({ size = 56, label }: Props) {
  const { colors } = useTheme();
  const giro = useRef(new Animated.Value(0)).current;
  const arco = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => mounted && setReduceMotion(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    let activo = true;
    let actual: Animated.CompositeAnimation | null = null;

    if (reduceMotion) {
      actual = Animated.loop(
        Animated.sequence([
          Animated.timing(pulso, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulso, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      actual.start();
      return () => actual?.stop();
    }

    // Giro (driver nativo) y arco (JS: react-native-svg no anima
    // strokeDashoffset en nativo) arrancan juntos en cada ciclo, así que no
    // se desfasan con el tiempo.
    const ciclo = () => {
      if (!activo) return;
      giro.setValue(0);
      arco.setValue(0);
      actual = Animated.sequence([
        Animated.parallel([
          Animated.timing(giro, { toValue: 1, duration: VUELTA_MS, easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: true }),
          Animated.timing(arco, { toValue: 1, duration: VUELTA_MS, easing: Easing.linear, useNativeDriver: false }),
        ]),
        Animated.delay(PAUSA_MS),
      ]);
      actual.start(({ finished }) => finished && ciclo());
    };
    ciclo();
    return () => {
      activo = false;
      actual?.stop();
    };
  }, [reduceMotion, giro, arco, pulso]);

  const ringSize = size * 0.467;
  const stroke = Math.max(1.5, size * 0.087);
  const r = (ringSize - stroke) / 2;
  const circunferencia = 2 * Math.PI * r;
  // Arco visible: 3/4 → círculo entero a mitad de vuelta → 3/4 otra vez.
  const largoArco = arco.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [ARCO_LOGO, 1, ARCO_LOGO],
    easing: Easing.inOut(Easing.quad),
  });
  const dashOffset = Animated.multiply(Animated.subtract(1, largoArco), circunferencia);
  const rotate = giro.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label ?? "Cargando"} style={{ alignItems: "center" }}>
      <Animated.View style={{ opacity: pulso }}>
        <LinearGradient
          colors={[colors.accent, colors.accentDeep]}
          style={{ width: size, height: size, borderRadius: size * 0.27, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View style={{ width: ringSize, height: ringSize, transform: [{ rotate }] }}>
            <Svg width={ringSize} height={ringSize}>
              <AnimatedCircle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={r}
                fill="none"
                stroke={colors.white}
                strokeWidth={stroke}
                strokeDasharray={`${circunferencia} ${circunferencia}`}
                strokeDashoffset={reduceMotion ? (1 - ARCO_LOGO) * circunferencia : dashOffset}
              />
            </Svg>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
      {/* Absoluto: con o sin texto, el logo queda en el mismo punto. */}
      {label ? (
        <AppText style={{ position: "absolute", top: size + 18, width: 280, fontSize: 14, color: colors.textTertiary, textAlign: "center" }}>{label}</AppText>
      ) : null}
    </View>
  );
}

type ScreenProps = {
  label?: string;
  // Absoluto encima de lo que haya (gate de rutas, guardados que bloquean)
  // en vez de ocupar su lugar en el layout.
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Pantalla de carga a pantalla completa, siempre centrada en el mismo
// punto: así el paso de un loader a otro (gate de _layout → onboarding →
// pantalla destino) se lee como un único loader continuo.
export function LoadingScreen({ label, overlay, style }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        overlay ? StyleSheet.absoluteFill : { flex: 1 },
        { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
        style,
      ]}
    >
      <CursadaLoader label={label} />
    </View>
  );
}
