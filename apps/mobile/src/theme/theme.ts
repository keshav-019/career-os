/**
 * Color tokens mirroring apps/web/src/app/globals.css's `:root` (dark, default) and `.light-theme` variable
 * blocks, so the mobile app looks like the same product instead of a reskinned clone. Keep these two objects in
 * sync with globals.css if the web palette ever changes.
 */

export type ThemeMode = "dark" | "light";

export type ThemeColors = {
  bg: string;
  bgSoft: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  mutedStrong: string;
  brand: string;
  brandStrong: string;
  success: string;
  warning: string;
  danger: string;
  violet: string;
};

const dark: ThemeColors = {
  bg: "#101114",
  bgSoft: "#15171b",
  surface: "#1b1e24",
  surfaceElevated: "#20242c",
  surfaceMuted: "#252a33",
  border: "#303744",
  borderStrong: "#485263",
  text: "#f4f7fb",
  muted: "#98a3b3",
  mutedStrong: "#c3cad6",
  brand: "#4f8cff",
  brandStrong: "#2f6fe7",
  success: "#35c58b",
  warning: "#f0b84c",
  danger: "#f06b7d",
  violet: "#9b7cff"
};

const light: ThemeColors = {
  bg: "#f4f6fa",
  bgSoft: "#eef2f7",
  surface: "#ffffff",
  surfaceElevated: "#fbfcfe",
  surfaceMuted: "#edf2f8",
  border: "#d8e0eb",
  borderStrong: "#aeb9c8",
  text: "#111827",
  muted: "#667085",
  mutedStrong: "#344054",
  brand: "#4f8cff",
  brandStrong: "#2f6fe7",
  success: "#35c58b",
  warning: "#f0b84c",
  danger: "#f06b7d",
  violet: "#9b7cff"
};

export const palettes: Record<ThemeMode, ThemeColors> = { dark, light };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999
};

export const fontSize = {
  eyebrow: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28
};
