export type ThemeId = "daylight" | "ocean" | "rosewood" | "sand" | "midnight" | "graphite" | "forest" | "plum";

export type ThemeOption = {
  id: ThemeId;
  name: string;
  description: string;
  mode: "dark" | "light";
  swatch: [string, string, string];
};

export const THEMES: ThemeOption[] = [
  { id: "daylight", name: "Daylight", description: "Default clinical white and blue", mode: "light", swatch: ["#f4f7fb", "#1d4ed8", "#047857"] },
  { id: "ocean", name: "Ocean", description: "Cool blue and teal", mode: "light", swatch: ["#eef7fb", "#0369a1", "#0d9488"] },
  { id: "sand", name: "Sand", description: "Warm parchment and teal", mode: "light", swatch: ["#f6f1e9", "#0f766e", "#15803d"] },
  { id: "midnight", name: "Midnight", description: "Institutional navy with sapphire", mode: "dark", swatch: ["#07131c", "#3cb4e8", "#2fbf8f"] },
  { id: "graphite", name: "Graphite", description: "Near-black with signal lime", mode: "dark", swatch: ["#08090b", "#a3e635", "#34d399"] },
  { id: "forest", name: "Forest", description: "Deep green with mint", mode: "dark", swatch: ["#06120f", "#5eead4", "#4ade80"] },
  { id: "plum", name: "Plum", description: "Muted violet with sage", mode: "dark", swatch: ["#120a17", "#e9d5ff", "#86efac"] },
  { id: "rosewood", name: "Rosewood", description: "Warm burgundy with sage", mode: "dark", swatch: ["#170c10", "#fda4af", "#86efac"] },
];

const STORAGE_KEY = "irerc-theme";
const FALLBACK: ThemeId = "daylight";

export function isThemeId(value: string | null): value is ThemeId {
  return !!value && THEMES.some((theme) => theme.id === value);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return FALLBACK;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // localStorage unavailable
  }
  return FALLBACK;
}

export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable
  }
}
