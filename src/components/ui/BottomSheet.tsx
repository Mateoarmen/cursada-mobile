import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Keyboard, Modal, Pressable, View, type KeyboardEvent } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ visible, onClose, children }: Props) {
  // Antes usaba KeyboardAvoidingView (behavior="padding"): anima una
  // propiedad de layout (padding), que no puede correr en el hilo nativo
  // (useNativeDriver no soporta padding/height) y se sentía lenta/con
  // lag, sobre todo con el hilo de JS ocupado. Este traslado a mano usa
  // `transform: translateY` con useNativeDriver, sincronizado a la
  // duración real que reporta el evento de teclado de iOS — mismo
  // resultado visual, corre en el hilo nativo, se siente instantáneo.
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e: KeyboardEvent) => {
      Animated.timing(translateY, {
        toValue: -e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener("keyboardWillHide", (e: KeyboardEvent) => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [translateY]);

  // Si el sheet se cierra (p.ej. tocando el backdrop) con el teclado
  // todavía abierto, no esperamos a keyboardWillHide para resetear — la
  // próxima vez que se abra debe arrancar en su posición normal.
  useEffect(() => {
    if (!visible) translateY.setValue(0);
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Pressable
            style={{
              backgroundColor: colors.surfaceRaised,
              borderTopLeftRadius: radii.xxl,
              borderTopRightRadius: radii.xxl,
              paddingTop: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.xxl + spacing.xs,
              gap: spacing.lg,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radii.round,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignSelf: "center",
              }}
            />
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
