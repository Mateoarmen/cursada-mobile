import { Stack } from "expo-router";
import { useTheme } from "@/theme/ThemeContext";

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="perfil" />
      <Stack.Screen name="wizard" />
      <Stack.Screen name="horario" />
      <Stack.Screen name="progreso-anterior" />
    </Stack>
  );
}
