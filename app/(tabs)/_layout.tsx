import { Tabs } from "expo-router";
import type { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radii } from "@/theme/tokens";
import { PressableScale } from "@/components/ui";

// Tabbar flotante "vidrio líquido" (design system: "Navegación mobile —
// tabbar flotante": pill de vidrio flotante, acento de marca en vez de azul
// iOS genérico). En iOS 26+ usa el material nativo Liquid Glass
// (UIVisualEffectView vía expo-glass-effect); en todo lo demás (iOS viejo,
// Android, web) cae a un blur oscuro + velo translúcido que imita el mismo
// efecto — GlassView ahí sería un <View> sin estilo.
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

function GlassTabButton({ children, style, ...rest }: BottomTabBarButtonProps) {
  // El tab bar pasa el estado activo como prop ARIA cruda ("aria-selected"),
  // no como accessibilityState — ver BottomTabItem.js (button({ ...,
  // 'aria-selected': focused })) en el bottom-tabs vendorizado de expo-router.
  const focused = !!rest["aria-selected"];
  return (
    <PressableScale scaleTo={0.94} style={style} {...rest}>
      {/* Pill decorativa como capa absoluta detrás del contenido en vez de
          margin/estilo sobre el Pressable en sí — el layout uikit nativo mide
          su propia altura por contenido, y tocar el tamaño del Pressable acá
          hacía crecer la barra entera y descolgaba la pill por encima. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            margin: 6,
            borderRadius: radii.round,
            backgroundColor: focused ? "rgba(255,255,255,0.92)" : "transparent",
          },
          focused ? styles.itemActiveShadow : null,
        ]}
      />
      {children}
    </PressableScale>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: "rgba(255,255,255,0.85)",
        tabBarButton: (props) => <GlassTabButton {...props} />,
        tabBarStyle: {
          position: "absolute",
          left: 20,
          right: 20,
          bottom: insets.bottom + (Platform.OS === "ios" ? 8 : 16),
          height: 64,
          borderRadius: radii.round,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          paddingHorizontal: 6,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 28,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, borderRadius: radii.round, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
            <TabBarGlass />
            <View style={styles.topHighlight} />
          </View>
        ),
        tabBarLabelStyle: {
          fontFamily: fonts.sansSemiBold,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={focused ? colors.accent : color} />
          ),
        }}
      />
      <Tabs.Screen
        name="materias"
        options={{
          title: "Materias",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "book" : "book-outline"} size={22} color={focused ? colors.accent : color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={focused ? colors.accent : color} />
          ),
        }}
      />
      <Tabs.Screen
        name="horario"
        options={{
          title: "Horario",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={22} color={focused ? colors.accent : color} />
          ),
        }}
      />
    </Tabs>
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
  itemActiveShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
});
