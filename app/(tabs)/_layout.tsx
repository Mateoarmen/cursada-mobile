import { router, Tabs, usePathname } from "expo-router";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, tabBar } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";
import { AsistenciaDiarioGate } from "@/components/AsistenciaDiarioGate";
import { useTourTarget } from "@/hooks/TourContext";

// Tabbar flotante "vidrio líquido" — implementada 100% a mano en vez de vía
// tabBarStyle/tabBarButton/tabBarIcon. El renderer "uikit" que trae esta
// versión de Expo Router mide y posiciona cada ítem con su propia lógica
// interna (pensada para una barra nativa normal, no una pill flotente
// angosta), y no hay forma confiable de pisarla desde las options del
// navegador — en probamos tres formas distintas y las tres terminaron con la
// barra rota (pill gigante, contenido corrido, o de golpe barra completa
// ancho de pantalla con íconos recortados). Acá se oculta esa barra nativa
// (tabBarStyle: {display:'none'}) y se dibuja la propia como overlay
// absoluto — layout 100% nuestro, cero dependencias ocultas.
const TABS = [
  { route: "/", match: "/", icon: "home-outline", iconActive: "home", label: "Inicio" },
  { route: "/materias", match: "/materias", icon: "book-outline", iconActive: "book", label: "Materias" },
  { route: "/agenda", match: "/agenda", icon: "calendar-outline", iconActive: "calendar", label: "Agenda" },
  { route: "/horario", match: "/horario", icon: "time-outline", iconActive: "time", label: "Horario" },
] as const;

const GLASS_AVAILABLE = isLiquidGlassAvailable();

function TabBarGlass() {
  if (GLASS_AVAILABLE) {
    return <GlassView glassEffectStyle="regular" colorScheme="dark" style={StyleSheet.absoluteFill} />;
  }
  return (
    <>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
    </>
  );
}

function FloatingTabBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // Targets del tour guiado (ver app/onboarding/wizard.tsx, PASOS_TOUR) —
  // hooks a nivel de componente (nunca dentro de TABS.map) y un lookup
  // simple por ruta más abajo, para no llamar hooks en un callback.
  const materiasTabRef = useTourTarget("tab-materias");
  const horarioTabRef = useTourTarget("tab-horario");
  const tourRefPorRuta: Partial<Record<(typeof TABS)[number]["route"], typeof materiasTabRef>> = {
    "/materias": materiasTabRef,
    "/horario": horarioTabRef,
  };

  return (
    <View
      style={{
        position: "absolute",
        left: tabBar.sideMargin,
        right: tabBar.sideMargin,
        bottom: insets.bottom + (Platform.OS === "ios" ? tabBar.bottomGapIOS : tabBar.bottomGapOther),
        height: tabBar.height,
        borderRadius: radii.round,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 28,
        elevation: 12,
      }}
    >
      <View style={{ flex: 1, borderRadius: radii.round, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
        <TabBarGlass />
        <View style={styles.topHighlight} />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", paddingHorizontal: 6 }}>
        {TABS.map((tab) => {
          const focused = tab.match === "/" ? pathname === "/" : pathname.startsWith(tab.match);
          const color = focused ? colors.accent : "rgba(255,255,255,0.75)";
          return (
            <View key={tab.route} ref={tourRefPorRuta[tab.route]} style={{ flex: 1 }}>
              <PressableScale
                scaleTo={0.94}
                onPress={() => router.navigate(tab.route)}
                style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: focused }}
              >
                <AppIcon name={focused ? tab.iconActive : tab.icon} size={19} color={color} weight={focused ? "semibold" : "regular"} />
                <AppText weight="600" style={{ fontSize: 10, color }}>
                  {tab.label}
                </AppText>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="materias" />
        <Tabs.Screen name="agenda" />
        <Tabs.Screen name="horario" />
      </Tabs>
      <FloatingTabBar />
      <AsistenciaDiarioGate />
    </View>
  );
}

const styles = StyleSheet.create({
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
