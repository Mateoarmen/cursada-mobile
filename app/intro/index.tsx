import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { easing, motionDuration, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BrandMark, PrimaryButton } from "@/components/ui";

// Mismo copy e íconos que ya usaba el onboarding genérico (app/onboarding/
// index.tsx, PASOS) — se reusa acá como contenido de las stories en vez de
// escribir texto nuevo, y de paso queda consistente con esa otra pantalla
// (mismo mensaje, mismo ícono). Esa pantalla sigue mostrando su propia
// versión en cascada para quien llega ahí sin haber pasado por /intro (ver
// su comentario: "cualquier otro caso cae acá").
const SLIDES = [
  { icon: "book-outline" as const, texto: "Cargá tus materias con horario, salón y nota de aprobación." },
  { icon: "checkmark-done-outline" as const, texto: "Agregá parciales, entregas y también tus planes personales." },
  { icon: "calendar-outline" as const, texto: "Mirá todo junto: calendario, horario y cómo vas de nota." },
];
const SLIDE_MS = 4000;

// Primera pantalla de cualquier estado sin sesión (gate en
// app/_layout.tsx) — incluido después de cerrar sesión, no sólo la primera
// vez que se abre la app. Dos beats: marca (logo + nombre animando) y
// stories (autoplay, tap para adelantar/retroceder) que termina en la
// elección de cuenta — nunca se muestra a alguien con sesión activa.
export default function IntroScreen() {
  const { colors } = useTheme();
  const [beat, setBeat] = useState<"marca" | "stories">("marca");
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    const pasarAStories = () => mounted && setBeat("stories");

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((reduced) => {
        if (!mounted) return;
        if (reduced) {
          brandOpacity.setValue(1);
          brandScale.setValue(1);
          timer = setTimeout(pasarAStories, 500);
          return;
        }
        Animated.parallel([
          Animated.timing(brandOpacity, { toValue: 1, duration: motionDuration.focal, easing: easing.out, useNativeDriver: true }),
          Animated.timing(brandScale, { toValue: 1, duration: motionDuration.focal, easing: easing.out, useNativeDriver: true }),
        ]).start();
        timer = setTimeout(pasarAStories, motionDuration.focal + 500);
      })
      .catch(() => {
        timer = setTimeout(pasarAStories, motionDuration.focal + 500);
      });

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [brandOpacity, brandScale]);

  if (beat === "marca") {
    return (
      <Pressable style={{ flex: 1 }} onPress={() => setBeat("stories")}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={{ opacity: brandOpacity, transform: [{ scale: brandScale }], alignItems: "center", gap: spacing.md }}>
            <BrandMark size={64} />
            <AppText weight="700" style={{ fontSize: 28, letterSpacing: -0.5, color: colors.text }}>
              cursada
            </AppText>
          </Animated.View>
        </SafeAreaView>
      </Pressable>
    );
  }

  return <StoriesBeat />;
}

function StoriesBeat() {
  const { colors } = useTheme();
  const [idx, setIdx] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const contenido = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) setIdx((i) => (i + 1) % SLIDES.length);
    });
    return () => anim.stop();
  }, [idx, progress]);

  useEffect(() => {
    // Un solo momento autoral por cambio de story (fade + leve translateY),
    // en vez del corte seco de antes — mismo criterio que Reveal en el
    // resto de la app (fade-in de contenido, nunca scattered effects).
    contenido.setValue(0);
    Animated.timing(contenido, { toValue: 1, duration: motionDuration.routine, easing: easing.out, useNativeDriver: true }).start();
  }, [idx, contenido]);

  const avanzar = () => setIdx((i) => (i + 1) % SLIDES.length);
  const retroceder = () => setIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length);

  const empezar = (destino: "signin" | "signup") => {
    router.replace({ pathname: "/login", params: { mode: destino } });
  };

  const slide = SLIDES[idx];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        {SLIDES.map((_, i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
            <Animated.View
              style={{
                height: "100%",
                backgroundColor: colors.accent,
                width: i < idx ? "100%" : i > idx ? "0%" : progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }}
            />
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        <Animated.View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.xxl,
            gap: spacing.xl,
            opacity: contenido,
            transform: [{ translateY: contenido.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentSofter, alignItems: "center", justifyContent: "center" }}>
            <AppIcon name={slide.icon} size={30} color={colors.accentText} />
          </View>
          <AppText weight="700" style={{ fontSize: 24, letterSpacing: -0.4, textAlign: "center", lineHeight: 30, color: colors.text }}>
            {slide.texto}
          </AppText>
        </Animated.View>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" }}>
          <Pressable style={{ flex: 3 }} onPress={retroceder} accessibilityRole="button" accessibilityLabel="Anterior" />
          <Pressable style={{ flex: 7 }} onPress={avanzar} accessibilityRole="button" accessibilityLabel="Siguiente" />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm }}>
        <PrimaryButton label="Comencemos el viaje" onPress={() => empezar("signup")} />
        <PrimaryButton label="Ya tengo cuenta" variant="ghost" onPress={() => empezar("signin")} />
      </View>
    </SafeAreaView>
  );
}
