import { useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeContext";

type Props = {
  children: React.ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

// Puerto de `.cta-glow` (styles.css): marco animado reservado para CTAs de
// "primera acción" que el usuario ve una sola vez (ver design.md, sección
// "CTA destacada" — sólo #btn-ob-empezar, #btn-empty-primera y
// #btn-progreso-semestre-cargar en la web). RN no tiene conic-gradient: se
// simula rotando un gradiente diagonal sobredimensionado detrás del botón,
// recortado por este wrapper redondeado — mismo truco que ProgressRing usa
// para el anillo circular sin soporte nativo de conic-gradient.
export function CtaGlow({ children, radius = 12, style }: Props) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const spin = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 5500, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const diag = Math.sqrt(size.width * size.width + size.height * size.height);
  const sweepSize = Math.ceil(diag * 1.6);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          borderRadius: radius + 1.5,
          padding: 1.5,
          overflow: "hidden",
          shadowColor: colors.accentDeep,
          shadowOpacity: 0.28,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        },
        style,
      ]}
    >
      {sweepSize > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: sweepSize,
            height: sweepSize,
            left: (size.width - sweepSize) / 2,
            top: (size.height - sweepSize) / 2,
            transform: [{ rotate: reduceMotion ? "0deg" : rotate }],
          }}
        >
          <LinearGradient
            colors={[colors.ctaGlowHighlight, colors.accent, colors.accentDeep, colors.ctaGlowHighlight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
      <View style={{ borderRadius: radius, overflow: "hidden" }}>{children}</View>
    </View>
  );
}
