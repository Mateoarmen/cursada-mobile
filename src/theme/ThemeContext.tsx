import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { paletteColors, paletteGradients, paletteShadows, paletteTone, type ThemeMode } from "./tokens";

const STORAGE_KEY = "cursada:theme-preference";

// "system" sigue el modo del SO (Appearance); "light"/"dark" lo fuerzan sin
// importar el SO — mismas tres opciones que expone el picker de Apariencia
// en Perfil.
export type ThemePreference = ThemeMode | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  mode: ThemeMode;
  setPreference: (p: ThemePreference) => void;
  colors: ReturnType<typeof paletteColors>;
  tone: ReturnType<typeof paletteTone>;
  gradients: ReturnType<typeof paletteGradients>;
  shadows: ReturnType<typeof paletteShadows>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Oscuro es la identidad original del producto (ver tokens.ts) — mientras
// se carga la preferencia guardada, arrancamos ahí en vez de en "system"
// para no destellar un tema distinto al abrir la app.
const DEFAULT_PREFERENCE: ThemePreference = "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_PREFERENCE);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme() ?? "dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") setPreferenceState(saved);
    });
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove();
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const mode: ThemeMode = preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      mode,
      setPreference,
      colors: paletteColors(mode),
      tone: paletteTone(mode),
      gradients: paletteGradients(mode),
      shadows: paletteShadows(mode),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preference, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
