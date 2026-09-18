import type { StyleProp, ViewStyle } from "react-native";
import { radii } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

type Variant = "accent" | "light" | "outline" | "ghost" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
  disabled?: boolean;
};

function makeVariantStyles(colors: ReturnType<typeof useTheme>["colors"]): Record<Variant, { bg: string; fg: string; border?: string }> {
  return {
    accent: { bg: colors.accent, fg: colors.white },
    light: { bg: colors.text, fg: colors.bg },
    outline: { bg: "transparent", fg: colors.text, border: "rgba(255,255,255,0.14)" },
    ghost: { bg: colors.surfaceSoft, fg: colors.text },
    danger: { bg: colors.dangerSofter, fg: colors.dangerText },
  };
}

export function PrimaryButton({ label, onPress, variant = "accent", style, flex, disabled }: Props) {
  const { colors } = useTheme();
  const variantStyles = makeVariantStyles(colors);
  const v = variantStyles[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          minHeight: 50,
          paddingVertical: 8,
          borderRadius: radii.sm,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
        },
        flex ? { flex: 1 } : null,
        style,
      ]}
    >
      <AppText weight="600" style={{ fontSize: 16, color: v.fg }}>
        {label}
      </AppText>
    </PressableScale>
  );
}
