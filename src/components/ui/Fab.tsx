import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

type Props = {
  onPress?: () => void;
  bottom?: number;
};

export function Fab({ onPress, bottom = 104 }: Props) {
  const { colors, shadows } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      style={[
        {
          position: "absolute",
          right: 20,
          bottom,
          width: 56,
          height: 56,
          borderRadius: 20,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        },
        shadows.fab,
      ]}
    >
      <AppText weight="400" style={{ fontSize: 28, color: colors.white, lineHeight: 30 }}>
        +
      </AppText>
    </PressableScale>
  );
}
