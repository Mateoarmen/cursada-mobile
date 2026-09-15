import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "@/hooks/useSession";
import { useAppFonts } from "@/theme/useAppFonts";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loading } = useSession();
  const [fontsLoaded] = useAppFonts();
  const ready = !loading && fontsLoaded;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="materia/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="perfil" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="semestre-activo" options={{ animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}
