import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "@/hooks/useSession";
import { OnboardingStatusProvider, useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { AsistenciaProvider } from "@/hooks/AsistenciaContext";
import { useAppFonts } from "@/theme/useAppFonts";
import { ThemeProvider, useTheme } from "@/theme/ThemeContext";
import { TourProvider } from "@/hooks/TourContext";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { LoadingScreen } from "@/components/ui";

SplashScreen.preventAutoHideAsync();

// Gate de sesión/onboarding — sin sesión va a /intro (splash animado +
// stories, ver app/intro/index.tsx — siempre, no sólo la primera vez: al
// cerrar sesión también se vuelve a ver, es la puerta de entrada de
// cualquier estado sin sesión) salvo que ya esté en /login (a donde llevan
// los botones de /intro, y adonde puede volver un logout sin pasar de
// nuevo por el intro si el usuario navegó ahí directo). Con sesión pero sin
// ninguna materia cargada va a /onboarding (que decide sola wizard de
// catálogo vs. onboarding genérico, ver mostrarOnboardingOCatalogo() en la
// web); si no, a las tabs. /reset-password queda exento: Supabase crea una
// sesión temporal de "recuperación" al abrir el link del mail y esa
// pantalla maneja su propia salida. (tabs)/materias y materia/* también
// quedan exentos mientras needsOnboarding: son el destino de "Crear mi
// primera materia" del onboarding genérico (app/onboarding/index.tsx) y de
// "Agregar mi primera materia" (app/(tabs)/materias.tsx → /materia/nueva)
// — sin esta excepción el guard rebotaba a /onboarding en cada navegación
// porque needsOnboarding sigue en true hasta que esa primera materia
// termina de crearse, dejando al usuario trancado sin poder completar el
// formulario.
type Destino = "/intro" | "/onboarding" | "/(tabs)";

// Adónde tiene que ir el usuario desde la ruta actual, o null si ya está
// donde corresponde. Función pura para que el efecto que navega y el render
// (que tapa la pantalla con el loader mientras la redirección está
// pendiente) lean exactamente la misma decisión — antes el Stack pintaba un
// frame de la ruta inicial (Inicio) antes de que el efecto corriera y
// después saltaba a la pantalla correcta.
function destinoPendiente(segments: string[], hasSession: boolean, needsOnboarding: boolean): Destino | null {
  const first = segments[0] as string | undefined;
  if (first === "reset-password") return null;

  if (!hasSession) {
    return first !== "intro" && first !== "login" ? "/intro" : null;
  }
  // Directo al destino final: antes iba a /(tabs) y de ahí rebotaba a
  // /onboarding, mostrando Inicio un instante en el medio.
  if (first === "login" || first === "intro") {
    return needsOnboarding ? "/onboarding" : "/(tabs)";
  }
  if (needsOnboarding) {
    const creandoPrimeraMateria = first === "materia" || (first === "(tabs)" && segments[1] === "materias");
    return first !== "onboarding" && !creandoPrimeraMateria ? "/onboarding" : null;
  }
  // Con materias ya creadas, needsOnboarding pasa a false — pero
  // horario.tsx/progreso-anterior.tsx (Fases 3-4) se visitan JUSTO
  // DESPUÉS de que el wizard las crea (confirmar() refresca status antes
  // de navegar ahí), así que siguen bajo el segmento "onboarding" con
  // needsOnboarding ya en false. Sin esta excepción, este rebote a tabs
  // (pensado para abandonar /onboarding/index|perfil|wizard una vez
  // terminados) las hacía inalcanzables — entre otras cosas, "Saltar
  // tour" parecía no hacer nada porque la navegación a progreso-anterior
  // se cancelaba sola.
  if (first === "onboarding") {
    const postWizard = segments[1] === "horario" || segments[1] === "progreso-anterior";
    return postWizard ? null : "/(tabs)";
  }
  return null;
}

// Gate de sesión/onboarding — sin sesión va a /intro (splash animado +
// stories, ver app/intro/index.tsx — siempre, no sólo la primera vez: al
// cerrar sesión también se vuelve a ver, es la puerta de entrada de
// cualquier estado sin sesión) salvo que ya esté en /login (a donde llevan
// los botones de /intro, y adonde puede volver un logout sin pasar de
// nuevo por el intro si el usuario navegó ahí directo). Con sesión pero sin
// ninguna materia cargada va a /onboarding (que decide sola wizard de
// catálogo vs. onboarding genérico, ver mostrarOnboardingOCatalogo() en la
// web); si no, a las tabs. /reset-password queda exento: Supabase crea una
// sesión temporal de "recuperación" al abrir el link del mail y esa
// pantalla maneja su propia salida. (tabs)/materias y materia/* también
// quedan exentos mientras needsOnboarding: son el destino de "Crear mi
// primera materia" del onboarding genérico (app/onboarding/index.tsx) y de
// "Agregar mi primera materia" (app/(tabs)/materias.tsx → /materia/nueva)
// — sin esta excepción el guard rebotaba a /onboarding en cada navegación
// porque needsOnboarding sigue en true hasta que esa primera materia
// termina de crearse, dejando al usuario trancado sin poder completar el
// formulario.
//
// `statusLoaded` es false mientras hay un status.refresh() en vuelo: en ese
// lapso needsOnboarding da false aunque el usuario no tenga materias, y el
// gate mandaba a /(tabs) a quien estaba en el wizard o en el perfil (Inicio
// aparecía un instante antes de la pantalla que correspondía).
function useProtectedRoute(destino: Destino | null, statusLoaded: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!statusLoaded || !destino) return;
    router.replace(destino);
  }, [destino, statusLoaded, router]);
}

function RootLayoutNav({ hasSession, fontsAndSessionReady }: { hasSession: boolean; fontsAndSessionReady: boolean }) {
  const status = useOnboardingStatusContext();
  const { colors, mode } = useTheme();
  const readyNow = fontsAndSessionReady && !status.loading;
  // Latch: una vez lista la primera vez, no volver a desmontar todo el
  // árbol (Stack incluido) cada vez que status.loading vuelve a true por un
  // status.refresh() posterior (ej. wizard.tsx guardando universidad/carrera)
  // — devolver null acá tira abajo cualquier pantalla que esté montada y le
  // hace perder su estado local (bug real: el wizard volvía siempre al
  // primer paso). El gate de rutas (useProtectedRoute) ya reacciona solo a
  // los cambios de status sin necesitar este desmontaje.
  const hasBooted = useRef(false);
  if (readyNow) hasBooted.current = true;
  const ready = hasBooted.current;

  const segments = useSegments() as string[];
  const statusLoaded = ready && !status.loading;
  const destino = destinoPendiente(segments, hasSession, status.needsOnboarding);
  useProtectedRoute(destino, statusLoaded);
  // Tapar la ruta actual mientras se sabe que hay que salir de ella: la
  // redirección ya decidida, o una sesión recién iniciada parada en
  // /login|/intro esperando a que cargue el status para saber adónde va.
  const first = segments[0];
  const tapar = (statusLoaded && !!destino) || (hasSession && !statusLoaded && (first === "login" || first === "intro"));

  useEffect(() => {
    if (readyNow) {
      SplashScreen.hideAsync();
    }
  }, [readyNow]);

  if (!ready) return <LoadingScreen />;

  return (
    <>
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="intro" options={{ animation: "fade" }} />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="reset-password" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="materia/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="materia/form" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="materia/nueva" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="perfil" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="semestre-activo" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="semestre-historial/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="semestre-historial/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="asistencia" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="progreso" options={{ animation: "slide_from_right" }} />
      </Stack>
      {tapar ? <LoadingScreen overlay /> : null}
      {/* Defensa extra además del reset en TourProvider: sin sesión, nunca
          dibujar el overlay encima de /intro o /login. */}
      {hasSession ? <TourOverlay /> : null}
    </>
  );
}

export default function RootLayout() {
  const { session, loading } = useSession();
  const [fontsLoaded] = useAppFonts();

  return (
    <ThemeProvider>
      <OnboardingStatusProvider userId={session?.user?.id}>
        <AsistenciaProvider userId={session?.user?.id}>
          <TourProvider hasSession={!!session}>
            <RootLayoutNav hasSession={!!session} fontsAndSessionReady={!loading && fontsLoaded} />
          </TourProvider>
        </AsistenciaProvider>
      </OnboardingStatusProvider>
    </ThemeProvider>
  );
}
