import { useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { colors, radii } from "@/theme/tokens";

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
export function RangeSlider({ min = 0, max, value, step = 0.5, color = colors.accent, onChange }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const round = (v: number) => Math.round(v / step) * step;

  const valueFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return value;
    const raw = min + (x / w) * (max - min);
    return round(clamp(raw));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
        onPanResponderMove: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [max, min, step]
  );

  const pct = max > min ? clamp((value - min) / (max - min)) : 0;

  return (
    <View
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setTrackWidth(e.nativeEvent.layout.width);
      }}
      hitSlop={{ top: 14, bottom: 14 }}
      style={{ height: 28, justifyContent: "center" }}
      {...panResponder.panHandlers}
    >
      <View style={{ height: 6, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: radii.round, backgroundColor: color }} />
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
            backgroundColor: color,
            borderWidth: 3,
            borderColor: colors.bg,
          }}
        />
      ) : null}
    </View>
  );
}
