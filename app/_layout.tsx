import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "@/hooks/useSession";
import { OnboardingStatusProvider, useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { useAppFonts } from "@/theme/useAppFonts";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();

// Gate de sesión/onboarding — sin sesión va a /login; con sesión pero sin
// ninguna materia cargada va a /onboarding (que decide sola wizard de
// catálogo vs. onboarding genérico, ver mostrarOnboardingOCatalogo() en la
// web); si no, a las tabs. /reset-password queda exento: Supabase crea una
// sesión temporal de "recuperación" al abrir el link del mail y esa
// pantalla maneja su propia salida.
function useProtectedRoute(hasSession: boolean, statusReady: boolean, needsOnboarding: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!statusReady) return;
    const first = segments[0] as string | undefined;
    if (first === "reset-password") return;

    if (!hasSession) {
      if (first !== "login") router.replace("/login");
      return;
    }
    if (first === "login") {
      router.replace("/(tabs)");
      return;
    }
    if (needsOnboarding) {
      if (first !== "onboarding") router.replace("/onboarding");
      return;
    }
    if (first === "onboarding") {
      router.replace("/(tabs)");
    }
  }, [hasSession, statusReady, needsOnboarding, segments, router]);
}

function RootLayoutNav({ hasSession, fontsAndSessionReady }: { hasSession: boolean; fontsAndSessionReady: boolean }) {
  const status = useOnboardingStatusContext();
  const ready = fontsAndSessionReady && !status.loading;

  useProtectedRoute(hasSession, ready, status.needsOnboarding);

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
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="reset-password" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="materia/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="materia/form" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="materia/nueva" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="perfil" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="semestre-activo" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="asistencia" options={{ animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const { session, loading } = useSession();
  const [fontsLoaded] = useAppFonts();

  return (
    <OnboardingStatusProvider userId={session?.user?.id}>
      <RootLayoutNav hasSession={!!session} fontsAndSessionReady={!loading && fontsLoaded} />
    </OnboardingStatusProvider>
  );
}
