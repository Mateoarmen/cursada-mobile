// Tokens del design system "Cursada Mobile Premium" (claude.ai/design).
// Fondo #0F1116, superficie #191C22, acento #2C7BFF → #0A63F0.
// Instrument Sans para texto, JetBrains Mono para cifras y horas.

export const colors = {
  bg: "#0F1116",
  surface: "#191C22",
  surfaceRaised: "#171A21",
  surfaceSoft: "rgba(255,255,255,0.07)",
  surfaceSofter: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.07)",
  borderFaint: "rgba(255,255,255,0.06)",

  accent: "#2C7BFF",
  accentDeep: "#0A63F0",
  accentText: "#5C9BFF",
  accentSoft: "rgba(44,123,255,0.16)",
  accentSofter: "rgba(44,123,255,0.10)",

  text: "#F5F5F7",
  textBody: "rgba(245,245,247,0.8)",
  textSecondary: "rgba(245,245,247,0.6)",
  textTertiary: "rgba(245,245,247,0.45)",
  textFaint: "rgba(245,245,247,0.4)",
  textGhost: "rgba(245,245,247,0.3)",

  success: "#34C759",
  successText: "#34C759",
  successSoft: "rgba(52,199,89,0.16)",

  warning: "#FF9500",
  warningText: "#FF9F0A",
  warningSoft: "rgba(255,149,0,0.16)",

  danger: "#FF3B30",
  dangerText: "#FF453A",
  dangerSoft: "rgba(255,59,48,0.16)",
  dangerSofter: "rgba(255,59,48,0.10)",

  purple: "#BF5AF2",
  cyan: "#64D2FF",
  cyanSoft: "rgba(100,210,255,0.10)",
  yellow: "#FFD60A",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export const gradients = {
  accent: [colors.accent, colors.accentDeep] as const,
  avatar: [colors.accent, colors.accentDeep] as const,
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 22,
  round: 999,
} as const;

// Grid de 8pt — todo espaciado es múltiplo de 4/8.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  smd: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fonts = {
  sans: "InstrumentSans_400Regular",
  sansMedium: "InstrumentSans_500Medium",
  sansSemiBold: "InstrumentSans_600SemiBold",
  sansBold: "InstrumentSans_700Bold",
  mono: "JetBrainsMono_500Medium",
} as const;

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
  },
  fab: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
