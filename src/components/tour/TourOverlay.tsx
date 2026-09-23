import { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTourContext, type TourRect } from "@/hooks/TourContext";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale, PrimaryButton } from "@/components/ui";

// Presupuesto de tiempo para encontrar el target real (measureInWindow),
// no cantidad de frames: el primer paso apunta a "Progreso del semestre"
// en Inicio, que recién existe una vez que cargaron materias/agenda desde
// Supabase.
const PRESUPUESTO_MEDICION_MS = 6000;
const INTERVALO_MEDICION_MS = 120;
const PAD = 8;

// Recorte tipo "spotlight" armado con 4 paneles oscuros alrededor del hueco
// en vez de un mask/SVG — sin dependencias nuevas, mismo criterio que
// ProgressRing/CtaGlow (simular con geometría lo que RN no da nativo). El
// hueco queda interactivo a propósito (no tiene ninguna vista encima): se
// puede tocar el elemento real mientras el tour lo señala. Los 4 paneles sí
// bloquean touch (pointerEvents="auto") para que el resto de la pantalla
// quede protegido mientras dura el tour.
function Recorte({ rect, color }: { rect: TourRect; color: string }) {
  const left = Math.max(0, rect.x - PAD);
  const top = Math.max(0, rect.y - PAD);
  const width = rect.width + PAD * 2;
  const height = rect.height + PAD * 2;

  return (
    <>
      <View pointerEvents="auto" style={{ position: "absolute", left: 0, top: 0, right: 0, height: top, backgroundColor: color }} />
      <View pointerEvents="auto" style={{ position: "absolute", left: 0, top: top + height, right: 0, bottom: 0, backgroundColor: color }} />
      <View pointerEvents="auto" style={{ position: "absolute", left: 0, top, width: left, height, backgroundColor: color }} />
      <View pointerEvents="auto" style={{ position: "absolute", left: left + width, top, right: 0, height, backgroundColor: color }} />
      <View
        pointerEvents="none"
        style={{ position: "absolute", left, top, width, height, borderRadius: radii.md, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" }}
      />
    </>
  );
}

// Nada de Animated acá a propósito — versión anterior animaba opacity
// compartida entre fondo/tarjeta/botón y, en el dispositivo real, quedaba
// todo invisible salvo el fondo oscuro (reportado 2 veces seguidas). En vez
// de seguir adivinando la causa exacta del Animated, se saca por completo:
// todo aparece de una, sin fade — funcional primero, pulido después.
export function TourOverlay() {
  const tour = useTourContext();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [rect, setRect] = useState<TourRect | null>(null);
  const paso = tour.pasos[tour.pasoIdx];

  useEffect(() => {
    if (!tour.activo || !paso) {
      setRect(null);
      return;
    }
    setRect(null);
    let cancelado = false;
    const inicio = Date.now();
    const medir = () => {
      if (cancelado) return;
      const view = tour.obtenerRef(paso.id)?.current;
      view?.measureInWindow((x, y, width, height) => {
        if (cancelado) return;
        const visible = (width > 0 || height > 0) && y < winH && y + height > 0;
        if (visible) {
          setRect({ x, y, width, height });
          return;
        }
        if (Date.now() - inicio < PRESUPUESTO_MEDICION_MS) setTimeout(medir, INTERVALO_MEDICION_MS);
      });
      if (!view && Date.now() - inicio < PRESUPUESTO_MEDICION_MS) setTimeout(medir, INTERVALO_MEDICION_MS);
    };
    medir();

    return () => {
      cancelado = true;
    };
  }, [tour, paso, winH]);

  if (!tour.activo || !paso) return null;

  const huecoAbajo = rect ? rect.y + rect.height + 220 < winH : true;
  const cardTop = rect
    ? huecoAbajo
      ? rect.y + rect.height + PAD * 2 + spacing.md
      : Math.max(insets.top + spacing.xl, rect.y - PAD * 2 - 200)
    : winH / 2 - 100;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {rect ? (
        <Recorte rect={rect} color="rgba(6,8,14,0.78)" />
      ) : (
        <View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(6,8,14,0.78)" }]} />
      )}

      <View style={{ position: "absolute", right: spacing.lg, top: insets.top + spacing.sm }}>
        <PressableScale
          scaleTo={0.96}
          onPress={tour.saltar}
          accessibilityLabel="Saltar tour"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: spacing.md,
            height: 44,
            borderRadius: radii.round,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText weight="600" style={{ fontSize: 13, color: colors.text }}>
            Saltar tour
          </AppText>
          <AppIcon name="close" size={14} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <View style={{ position: "absolute", left: spacing.xl, right: spacing.xl, top: cardTop }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing.lg,
            gap: spacing.sm,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <View style={{ flexDirection: "row", gap: 4 }}>
            {tour.pasos.map((p, i) => (
              <View key={p.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= tour.pasoIdx ? colors.accent : colors.surfaceSoft }} />
            ))}
          </View>
          <AppText weight="700" style={{ fontSize: 17, letterSpacing: -0.2 }}>
            {paso.titulo}
          </AppText>
          <AppText style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>{paso.texto}</AppText>
          <View style={{ flexDirection: "row", gap: spacing.sm, paddingTop: spacing.xs }}>
            {tour.pasoIdx > 0 ? <PrimaryButton label="Atrás" variant="ghost" onPress={tour.anterior} /> : null}
            <PrimaryButton label={tour.pasoIdx + 1 === tour.pasos.length ? "Listo" : "Siguiente"} flex onPress={tour.siguiente} />
          </View>
        </View>
      </View>
    </View>
  );
}
