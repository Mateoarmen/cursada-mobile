import { View, type ViewStyle } from "react-native";
import { radii } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "./AppText";

type Props = {
  label: string;
  color?: string;
  background?: string;
  mono?: boolean;
  style?: ViewStyle;
};

export function Pill({ label, color, background, mono, style }: Props) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.text;
  const resolvedBackground = background ?? colors.surfaceSoft;
  return (
    <View
      style={[
        {
          minHeight: 24,
          paddingVertical: 3,
          paddingHorizontal: 11,
          borderRadius: radii.round,
          backgroundColor: resolvedBackground,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <AppText weight="600" mono={mono} style={{ fontSize: 12, color: resolvedColor }}>
        {label}
      </AppText>
    </View>
  );
}
