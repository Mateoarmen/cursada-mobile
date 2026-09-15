import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@/theme/tokens";
import { AppText } from "./AppText";

type Props = {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  centerValue?: string;
  centerLabel?: string;
  valueFontSize?: number;
  labelFontSize?: number;
};

// Anillo de progreso vía SVG: RN no soporta conic-gradient, así que
// replicamos el mismo efecto visual con un <Circle> con stroke-dasharray.
export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 4,
  color = colors.accent,
  trackColor = "rgba(255,255,255,0.09)",
  centerValue,
  centerLabel,
  valueFontSize = 12,
  labelFontSize = 10,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {centerValue !== undefined ? (
        <View style={{ alignItems: "center" }}>
          <AppText mono weight="600" style={{ fontSize: valueFontSize, color: colors.text, lineHeight: valueFontSize + 2 }}>
            {centerValue}
          </AppText>
          {centerLabel ? (
            <AppText style={{ fontSize: labelFontSize, color: colors.textTertiary }}>{centerLabel}</AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
