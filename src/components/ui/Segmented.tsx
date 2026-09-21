import { View } from "react-native";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

// Elección excluyente entre 2–3 opciones: a diferencia de un Pill (que se
// lee como chip de filtro o botón), el riel + segmento activo deja claro
// que son alternativas del mismo campo.
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", padding: 3, borderRadius: radii.sm, backgroundColor: colors.bg }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            scaleTo={0.98}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.md,
              borderRadius: radii.sm - 3,
              backgroundColor: active ? colors.surface : "transparent",
            }}
          >
            <AppText weight={active ? "600" : "500"} style={{ fontSize: 14, color: active ? colors.text : colors.textSecondary }}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}
