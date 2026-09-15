import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "@/hooks/useSession";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loading } = useSession();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ presentation: "modal" }} />
    </Stack>
  );
}
