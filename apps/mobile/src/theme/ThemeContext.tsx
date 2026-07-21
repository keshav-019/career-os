import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance } from "react-native";
import { palettes, radius, spacing, fontSize, type ThemeColors, type ThemeMode } from "./theme";

/**
 * Mirrors apps/web/src/lib/preferences.ts's THEME_PREFERENCE_KEY/readThemePreference/writeThemePreference, but
 * there's no `window`/DOM event bus on a phone, so React Context replaces the CustomEvent pattern - every screen
 * that calls useTheme() re-renders automatically when the mode changes, no manual event wiring needed.
 */
const THEME_STORAGE_KEY = "careeros-theme-preference";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default theme is dark, matching CareerOS's brand default on web/desktop - only flips to the device's light
  // preference if nothing has ever been saved AND the device reports light mode.
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (cancelled) return;
        if (stored === "light" || stored === "dark") {
          setModeState(stored);
        } else {
          const systemScheme = Appearance.getColorScheme();
          setModeState(systemScheme === "light" ? "light" : "dark");
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      void AsyncStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, colors: palettes[mode], spacing, radius, fontSize, setMode, toggleMode, hydrated }),
    [mode, hydrated, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>.");
  }
  return ctx;
}
