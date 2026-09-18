import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, type StyleProp, type ViewStyle } from "react-native";
import { easing, motionDuration } from "@/theme/tokens";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // "slide": fade + translateY sutil — el momento autoral de página (una
  // sección/bloque entero apareciendo). "pop": fade + scale sin
  // translateY — para hijos de una lista real (ver animate.md: "sibling
  // stagger es apropiado cuando una lista aparece como lista"), pensado
  // para anidar dentro de un Reveal "slide" sin pisarle el eje de
  // movimiento (uno se desplaza, los otros sólo escalan).
  mode?: "slide" | "pop";
  // ms antes de arrancar — para escalonar hermanos de una lista real
  // (KPIs, tiles). Mantener el delay total del grupo chico (animate.md:
  // "cap the total delay").
  delay?: number;
};

// Entrada única de contenido al montar (--ease-out portado de design.md) —
// antes el contenido de una pantalla aparecía de golpe sin transición
// apenas resolvía el fetch. El caller decide QUÉ envolver (normalmente el
// bloque de contenido ya cargado, no cada sección por separado) y si el
// hijo es una lista real, puede escalonar instancias de este mismo
// componente en modo "pop" con un `delay` creciente.
export function Reveal({ children, style, mode = "slide", delay = 0 }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Se resuelve reduceMotion ANTES de arrancar la animación (no en un
    // efecto separado) para no arrancar una vez con la curva completa y
    // recién después enterarse de que debía ser la reducida.
    const run = (reduced: boolean) => {
      if (!mounted) return;
      setReduceMotion(reduced);
      Animated.timing(progress, {
        toValue: 1,
        duration: reduced ? motionDuration.feedback : motionDuration.routine + 40,
        delay: reduced ? 0 : delay,
        easing: easing.out,
        useNativeDriver: true,
      }).start();
    };
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(run)
      .catch(() => run(false));
    return () => {
      mounted = false;
    };
    // Sólo en el montaje: esto es la entrada, corre una única vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transform =
    mode === "pop"
      ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.94, 1] }) }]
      : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 10, 0] }) }];

  return (
    <Animated.View style={[{ opacity: progress, transform }, style]}>
      {children}
    </Animated.View>
  );
}
