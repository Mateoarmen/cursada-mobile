import { useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { radii } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";

type Props = {
  min?: number;
  max: number;
  value: number;
  step?: number;
  color?: string;
  onChange: (value: number) => void;
};

// Slider táctil liviano (sin dependencia nativa) — réplica visual del
// `<input type=range>` con pintarRangeFill() de la web: track con relleno
// de acento hasta el valor actual + perilla circular. PanResponder mide el
// ancho real del track (onLayout) para traducir el toque/arrastre a valor.
export function RangeSlider({ min = 0, max, value, step = 0.5, color, onChange }: Props) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const containerRef = useRef<View>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const round = (v: number) => Math.round(v / step) * step;

  const valueFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return value;
    const raw = min + (x / w) * (max - min);
    return round(clamp(raw));
  };

  // pageX en vez de locationX: locationX es relativo a la subvista tocada,
  // y el relleno interno cambia de ancho en cada frame de arrastre — si el
  // dedo queda sobre esa subvista, RN recalcula locationX contra su nuevo
  // tamaño y el valor "tira para atrás". pageX es absoluto y no depende de
  // las subvistas, así que medimos el track una vez (onLayout) y restamos.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => onChange(valueFromX(e.nativeEvent.pageX - trackPageXRef.current)),
        onPanResponderMove: (e) => onChange(valueFromX(e.nativeEvent.pageX - trackPageXRef.current)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [max, min, step]
  );

  const pct = max > min ? clamp((value - min) / (max - min)) : 0;

  const measureTrack = () => {
    containerRef.current?.measure((_x, _y, width, _height, pageX) => {
      widthRef.current = width;
      trackPageXRef.current = pageX;
      setTrackWidth(width);
    });
  };

  return (
    <View
      ref={containerRef}
      onLayout={measureTrack}
      hitSlop={{ top: 14, bottom: 14 }}
      style={{ height: 28, justifyContent: "center" }}
      {...panResponder.panHandlers}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: radii.round, backgroundColor: resolvedColor }} />
      </View>
      {trackWidth > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(trackWidth - 20, pct * trackWidth - 10)),
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: resolvedColor,
            borderWidth: 3,
            borderColor: colors.bg,
          }}
        />
      ) : null}
    </View>
  );
}
