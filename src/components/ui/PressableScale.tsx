import { useRef } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Replica el `style-active` del prototipo: feedback táctil real con un
// spring sutil en vez del opacity-fade por defecto de Pressable.
// Una sola animated component (no un <Animated.View> envolviendo el
// <Pressable>) para que `style` — flex, width, etc — participe del layout
// del padre igual que cualquier otro Pressable.
export function PressableScale({ style, scaleTo = 0.96, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <AnimatedPressable
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(e) => {
        animateTo(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      {...rest}
    />
  );
}
