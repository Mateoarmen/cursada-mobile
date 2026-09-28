import { useEffect } from "react";
import { router } from "expo-router";
import { AccessibilityInfo, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { paletteColors, radii, spacing } from "@/theme/tokens";
import { AppText, PressableScale } from "@/components/ui";

// Video de bienvenida hecho en Claude Design (proyecto "Videos animados para
// login", Bienvenida Widgets): recorre Inicio → Lo próximo → KPIs → Curva
// del semestre → Progreso → ¡Aprobada! y vuelve a la marca, así que loopea
// sin corte. Trae las frases abajo incrustadas. Re-encodeado a HEVC 3 Mbps
// (11,5 → 5,3 MB) sin pérdida visible en el texto chico.
const VIDEO = require("../../assets/video/bienvenida.mp4");
const VIDEO_ASPECT = 9 / 16;
// Con "Reducir movimiento" no se reproduce: queda quieto en un cuadro que
// ya muestra Inicio con su frase ("Sabé qué viene antes de que llegue.").
const CUADRO_QUIETO_S = 3;

// El video es oscuro (fondo #0F1116 de punta a punta): la intro va siempre
// en la paleta oscura, aunque la preferencia guardada sea Claro — si no, el
// video quedaría como un recuadro negro sobre fondo claro.
const C = paletteColors("dark");

const BOTON_H = 50;
const BOTONES_GAP = spacing.sm;

// Primera pantalla de cualquier estado sin sesión (gate en
// app/_layout.tsx) — incluido después de cerrar sesión, no sólo la primera
// vez que se abre la app. Reemplaza al beat de marca + stories de íconos:
// el video ya arranca y termina en el logo, así que empalma con el splash.
export default function IntroScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const player = useVideoPlayer(VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    // Sin audio: que no corte la música que el usuario tenga sonando.
    p.audioMixingMode = "mixWithOthers";
  });

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((reduced) => {
        if (!mounted) return;
        if (reduced) player.currentTime = CUADRO_QUIETO_S;
        else player.play();
      })
      .catch(() => mounted && player.play());
    return () => {
      mounted = false;
    };
  }, [player]);

  // El video entero (sin recortar: las frases van pegadas al borde de
  // abajo) en el alto que dejan libre la barra de estado y los botones.
  const botonesH = spacing.lg + BOTON_H * 2 + BOTONES_GAP + Math.max(insets.bottom, spacing.lg) + spacing.sm;
  const disponible = height - insets.top - botonesH;
  const videoH = Math.min(width / VIDEO_ASPECT, disponible);
  const videoW = videoH * VIDEO_ASPECT;

  const empezar = (destino: "signin" | "signup") => {
    router.replace({ pathname: "/login", params: { mode: destino } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, paddingTop: insets.top, alignItems: "center" }}>
        <View style={{ width: videoW, height: videoH }}>
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="contain"
            allowsPictureInPicture={false}
            allowsVideoFrameAnalysis={false}
            accessible
            accessibilityLabel="Video: un recorrido por Inicio y Progreso de Cursada"
            style={{ width: videoW, height: videoH, backgroundColor: C.bg }}
          />
          {/* En las escenas de zoom el teléfono del video sale por arriba:
              se funde con el fondo en vez de cortarse en seco bajo la barra
              de estado. Abajo el video ya trae su propio degradé. */}
          <LinearGradient pointerEvents="none" colors={[C.bg, "rgba(15,17,22,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 36 }} />
        </View>
      </View>

      <View
        style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm, gap: BOTONES_GAP }}
      >
        <Boton label="Comencemos el viaje" onPress={() => empezar("signup")} primario />
        <Boton label="Ya tengo cuenta" onPress={() => empezar("signin")} />
      </View>
    </View>
  );
}

// Mismas medidas que PrimaryButton (accent / ghost), pero con la paleta
// oscura fija de esta pantalla en vez de la del tema activo.
function Boton({ label, onPress, primario }: { label: string; onPress: () => void; primario?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{
        minHeight: BOTON_H,
        borderRadius: radii.sm,
        backgroundColor: primario ? C.accent : C.surfaceSoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText weight="600" style={{ fontSize: 16, color: primario ? C.white : C.text }}>
        {label}
      </AppText>
    </PressableScale>
  );
}
