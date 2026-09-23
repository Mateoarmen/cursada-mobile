import type { ReactNode } from "react";
import { View } from "react-native";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "@/components/ui";

// Tarjeta plana (sin sombra ni borde) — mismo contenedor que usan las demás
// pantallas; el sistema visual no permite elevación en contenido.
export function Card({ children, gap = spacing.md }: { children: ReactNode; gap?: number }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap }}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2, paddingBottom: spacing.sm }}>
      {children}
    </AppText>
  );
}
