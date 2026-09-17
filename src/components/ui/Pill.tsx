import { View, type ViewStyle } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { AppText } from "./AppText";

type Props = {
  label: string;
  color?: string;
  background?: string;
  mono?: boolean;
  style?: ViewStyle;
};

export function Pill({ label, color = colors.text, background = colors.surfaceSoft, mono, style }: Props) {
  return (
    <View
      style={[
        {
          minHeight: 24,
          paddingVertical: 3,
          paddingHorizontal: 11,
          borderRadius: radii.round,
          backgroundColor: background,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <AppText weight="600" mono={mono} style={{ fontSize: 12, color }}>
        {label}
      </AppText>
    </View>
  );
}
