import { router } from "expo-router";
import { colors, radii } from "@/theme/tokens";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export function BackButton({ onPress }: { onPress?: () => void }) {
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
