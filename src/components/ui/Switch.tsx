import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { colors } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";

const WIDTH = 46;
const HEIGHT = 28;
const THUMB = 20;
const PAD = 2;

type Props = {
  value: boolean;
  onValueChange?: (v: boolean) => void;
};

// Track de contorno (sin relleno) con la perilla del mismo color — variante
// de switch del design system, distinta del switch iOS "de fábrica" (track
// sólido + perilla blanca) que usa el resto del ecosistema RN.
export function Switch({ value, onValueChange }: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, WIDTH - THUMB - PAD * 2] });
  const tint = value ? colors.accent : "rgba(255,255,255,0.2)";

  return (
    <PressableScale scaleTo={0.94} onPress={() => onValueChange?.(!value)}>
      <Animated.View
        style={{
          width: WIDTH,
          height: HEIGHT,
          borderRadius: HEIGHT / 2,
          borderWidth: 2,
          borderColor: tint,
          padding: PAD,
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: tint,
            transform: [{ translateX }],
          }}
        />
      </Animated.View>
    </PressableScale>
  );
}
