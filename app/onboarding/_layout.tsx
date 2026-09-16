import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="wizard" />
    </Stack>
  );
}
