import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "@/theme/tokens";
import { AppText } from "./AppText";

type Props = {
  initial: string;
  size?: number;
  fontSize?: number;
};

export function Avatar({ initial, size = 44, fontSize = 17 }: Props) {
  return (
    <LinearGradient
      colors={gradients.avatar}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText weight="600" style={{ fontSize, color: colors.white }}>
        {initial}
      </AppText>
    </LinearGradient>
  );
}
