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
  // Celeste de relleno del marco giratorio de las CTA destacadas (.cta-glow
  // en styles.css) — mismo valor en ambos temas de la web.
  ctaGlowHighlight: "#CFE3FF",

  text: "#F5F5F7",
  textBody: "rgba(245,245,247,0.8)",
  textSecondary: "rgba(245,245,247,0.6)",
  // Alphas subidas desde 0.45/0.4 — al valor original, texto chico (<17pt)
  // sobre `bg` quedaba bajo el piso de contraste AA (~3.6-4.2:1); 0.55
  // despeja 4.5:1 sin perder la jerarquía "atenuado" frente a textSecondary.
  textTertiary: "rgba(245,245,247,0.55)",
  textFaint: "rgba(245,245,247,0.55)",
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

  // Estado "cursando/pendiente" (ni éxito ni riesgo) — mismo gris que usa
  // el badge neutral de la web (ESTADO_TONE) para esos dos estados.
  neutral: "#C7C7CC",
  neutralText: "rgba(245,245,247,0.7)",
  neutralSoft: "rgba(199,199,204,0.14)",

  purple: "#BF5AF2",
  cyan: "#64D2FF",
  cyanSoft: "rgba(100,210,255,0.10)",
  yellow: "#FFD60A",

  white: "#FFFFFF",
  black: "#000000",
} as const;

// Los 9 colores de identidad de materia — mismos valores que `ACCENTS` en
// runtime.js (web). "strong" es el color sólido (tile, ring, dot); "soft"
// el fondo tenue a igual alpha que ya usa el resto de la paleta dark
// (~0.12–0.2, ver accentSoft/dangerSoft arriba) en vez del alpha pensado
// para fondo claro que usa el badge de la web.
export const materiaColors = {
  azul: { strong: "#0A63F0", soft: "rgba(10,99,240,0.18)" },
  verde: { strong: "#34C759", soft: "rgba(52,199,89,0.16)" },
  violeta: { strong: "#5E5CE6", soft: "rgba(94,92,230,0.18)" },
  coral: { strong: "#FF6B5B", soft: "rgba(255,107,91,0.18)" },
  amarillo: { strong: "#FFD60A", soft: "rgba(255,214,10,0.2)" },
  turquesa: { strong: "#64D2FF", soft: "rgba(100,210,255,0.18)" },
  rosa: { strong: "#FF375F", soft: "rgba(255,55,95,0.18)" },
  indigo: { strong: "#BF5AF2", soft: "rgba(191,90,242,0.18)" },
  gris: { strong: "#98989D", soft: "rgba(152,152,157,0.18)" },
} as const;

export type MateriaColorId = keyof typeof materiaColors;

// Tono académico (riesgo) → color sólido. Corresponde 1:1 a `TONE` en
// runtime.js. "neutral" es "sin notas cargadas todavía", no un estado de
// riesgo. Independiente del tono de *estado* (cursando/aprobada/...): una
// materia "cursando" con buen promedio usa tone:"success" en el ring pero
// sigue mostrando el badge gris de "Cursando".
export const tone = {
  success: { strong: colors.success, text: colors.successText, soft: colors.successSoft },
  warning: { strong: colors.warning, text: colors.warningText, soft: colors.warningSoft },
  danger: { strong: colors.danger, text: colors.dangerText, soft: colors.dangerSoft },
  neutral: { strong: colors.neutral, text: colors.neutralText, soft: colors.neutralSoft },
} as const;

export type Tone = keyof typeof tone;

// Mismos 4 estados de materia que la web (ver ESTADO_LABEL/ESTADO_TONE).
export const estadoLabel = {
  cursando: "Cursando",
  aprobada: "Aprobada",
  recursando: "Recursando",
  pendiente: "Pendiente",
} as const;

export type EstadoMateria = keyof typeof estadoLabel;

export const estadoTone: Record<EstadoMateria, Tone> = {
  cursando: "neutral",
  aprobada: "success",
  recursando: "danger",
  pendiente: "neutral",
};

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

// Tab bar flotante (ver app/(tabs)/_layout.tsx): dimensiones compartidas con
// cualquier pantalla de tab que necesite reservar espacio real para no
// quedar tapada, en vez de adivinar un padding fijo.
export const tabBar = {
  height: 54,
  bottomGapIOS: 8,
  bottomGapOther: 16,
  sideMargin: 20,
} as const;

export const fonts = {
  sans: "InstrumentSans_400Regular",
  sansMedium: "InstrumentSans_500Medium",
  sansSemiBold: "InstrumentSans_600SemiBold",
  sansBold: "InstrumentSans_700Bold",
  // Cifras/horas van en la misma familia que el resto del texto — antes usaban
  // JetBrains Mono, pero se leía "de código" en vez de un dato de la app.
  mono: "InstrumentSans_600SemiBold",
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
