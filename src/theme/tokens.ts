// Tokens del design system "Cursada Mobile Premium" (claude.ai/design).
// Fondo #0F1116, superficie #191C22, acento #2C7BFF → #0A63F0 (oscuro) /
// #0A63F0 → #0847B4 (claro). Instrument Sans para texto, JetBrains Mono
// para cifras y horas.
//
// Paleta clara portada 1:1 de los tokens ya bloqueados para la web en
// `cursada-design-system/design.md` (sección "Theme" → "Claro"): paper
// #FFFFFF / paper-2 #EDEDF0 / paper-3 #FBFBFD / ink oklch(19.9% ...) ≈
// #0F1116 (mismo hex que el bg oscuro, coincidencia de la misma familia de
// tono) / accent #0A63F0 / accent-to #0847B4. No se inventó paleta nueva.

import { Easing } from "react-native";

export type ThemeMode = "light" | "dark";

const darkColors = {
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

const lightColors = {
  bg: "#EDEDF0",
  surface: "#FFFFFF",
  surfaceRaised: "#FBFBFD",
  surfaceSoft: "rgba(15,17,22,0.05)",
  surfaceSofter: "rgba(15,17,22,0.04)",
  border: "rgba(15,17,22,0.10)",
  borderSoft: "rgba(15,17,22,0.08)",
  borderFaint: "rgba(15,17,22,0.07)",

  accent: "#0A63F0",
  accentDeep: "#0847B4",
  // Sobre fondo claro el azul de marca ya tiene contraste de sobra como
  // texto — a diferencia del oscuro no hace falta aclararlo.
  accentText: "#0A63F0",
  accentSoft: "rgba(10,99,240,0.12)",
  accentSofter: "rgba(10,99,240,0.08)",
  ctaGlowHighlight: "#CFE3FF",

  text: "#0F1116",
  textBody: "rgba(15,17,22,0.82)",
  textSecondary: "rgba(15,17,22,0.64)",
  textTertiary: "rgba(15,17,22,0.55)",
  textFaint: "rgba(15,17,22,0.55)",
  textGhost: "rgba(15,17,22,0.32)",

  // Colores de sistema (success/warning/danger) preservados sin cambios —
  // ya son alfa-blend sobre el color puro, no sobre blanco/negro, así que
  // leen bien en las dos superficies (ver design.md: "se preserva sin
  // cambios" para la paleta de 9 colores de materia, mismo criterio).
  success: "#34C759",
  successText: "#248A3D",
  successSoft: "rgba(52,199,89,0.14)",

  warning: "#FF9500",
  warningText: "#C93400",
  warningSoft: "rgba(255,149,0,0.14)",

  danger: "#FF3B30",
  dangerText: "#D70015",
  dangerSoft: "rgba(255,59,48,0.14)",
  dangerSofter: "rgba(255,59,48,0.08)",

  // Gris de sistema en modo claro (Apple systemGray) — el de modo oscuro
  // (#C7C7CC) queda demasiado claro para leer sobre fondo blanco.
  neutral: "#8E8E93",
  neutralText: "rgba(15,17,22,0.7)",
  neutralSoft: "rgba(142,142,147,0.14)",

  purple: "#AF52DE",
  cyan: "#32ADE6",
  cyanSoft: "rgba(50,173,230,0.10)",
  yellow: "#FFCC00",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export function paletteColors(mode: ThemeMode) {
  return mode === "light" ? lightColors : darkColors;
}

// Export estático (oscuro) — identidad original del producto y red de
// contención para cualquier módulo no-visual (tipos, helpers puros) que
// todavía importe los tokens directo en vez de vía useTheme(). El código de
// pantallas/componentes debe leer colores desde useTheme(), no de acá.
export const colors = darkColors;

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
export function paletteTone(mode: ThemeMode) {
  const c = paletteColors(mode);
  return {
    success: { strong: c.success, text: c.successText, soft: c.successSoft },
    warning: { strong: c.warning, text: c.warningText, soft: c.warningSoft },
    danger: { strong: c.danger, text: c.dangerText, soft: c.dangerSoft },
    neutral: { strong: c.neutral, text: c.neutralText, soft: c.neutralSoft },
  } as const;
}

export const tone = paletteTone("dark");

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

export function paletteGradients(mode: ThemeMode) {
  const c = paletteColors(mode);
  return {
    accent: [c.accent, c.accentDeep] as const,
    avatar: [c.accent, c.accentDeep] as const,
  };
}

export const gradients = paletteGradients("dark");

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

// Sombra "ambient" — reservada, igual que en la web (--c-shadow:none en
// tema oscuro), a los tres lugares donde el mockup SÍ la muestra: FAB, día
// activo de Horario, y modales. Las tarjetas de contenido son opacas y
// CHATAS a propósito (ver design.md del repo cursada-design-system,
// sección "Pro Edition") — no agregar una entrada tipo `card` acá, es
// justo lo que esa dirección visual prohíbe.
export function paletteShadows(mode: ThemeMode) {
  const c = paletteColors(mode);
  return {
    fab: {
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.42,
      shadowRadius: 20,
      elevation: 8,
    },
    // Segundo (y último) lugar sancionado además del FAB — la celda del día
    // activo en Horario (ver html[data-theme="oscuro"] .horario-day.is-on en
    // styles.css). No agregar una entrada `card` acá, ver comentario arriba.
    horarioDiaActivo: {
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 6,
    },
  } as const;
}

export const shadows = paletteShadows("dark");

// Curvas de easing del sistema web (design.md/styles.css), portadas a RN.
// Mismos cuatro nombres, mismo criterio de uso — "algo con más punch que
// el ease-out plano de RN por default":
// - out: algo que entra/aparece.
// - inOut: algo que se mueve en pantalla.
// - drawer: cajones/sheets estilo iOS.
// spring (rebote/overshoot) no se porta como bezier: se implementa con
// Animated.spring (ver CtaGlow.tsx/Switch.tsx) — más natural en RN que
// simular overshoot con Easing.bezier — y sigue reservado a momentos de
// primer uso, nunca a botones de acción repetida (Guardar, + Nuevo, etc).
export const easing = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  drawer: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

// Tabla de duraciones (ver animate.md): feedback inmediato, cambio de
// estado rutinario, transición de layout/overlay, entrada autoral única.
export const motionDuration = {
  feedback: 120,
  routine: 220,
  layout: 320,
  focal: 600,
} as const;
