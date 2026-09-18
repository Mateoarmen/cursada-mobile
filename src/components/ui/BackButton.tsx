import { router } from "expo-router";
import { radii } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export function BackButton({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.9}
      onPress={onPress ?? (() => router.back())}
      style={{
        width: 36,
        height: 36,
        borderRadius: radii.sm,
        backgroundColor: colors.surfaceSoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText style={{ fontSize: 18, color: colors.text, marginLeft: -2 }}>‹</AppText>
    </PressableScale>
  );
}
