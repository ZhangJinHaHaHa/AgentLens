import * as React from "react";

export type ThemeMode = "light" | "dark";
export const ART_THEMES = ["swiss", "atelier", "nocturne", "pixel", "crimson"] as const;
export type ArtTheme = (typeof ART_THEMES)[number];
export const DEFAULT_ART_THEME: ArtTheme = "swiss";
export const ART_THEME_DEFAULT_VERSION = "swiss-precision-20260606-v3";

const STORAGE_MODE_KEY = "agentlens-theme-mode";
const STORAGE_ART_KEY = "agentlens-art-theme";
const STORAGE_ART_DEFAULT_VERSION_KEY = "agentlens-art-theme-default-version";
const LEGACY_ART_THEME_MAP: Record<string, ArtTheme> = {
  aqua: "atelier",
  flora: "atelier",
  sierra: "nocturne",
  vangogh: "nocturne",
  monet: "atelier",
  klimt: "atelier"
};

const ART_THEME_DEFAULT_MODE: Record<ArtTheme, ThemeMode> = {
  swiss: "light",
  atelier: "light",
  nocturne: "dark",
  pixel: "dark",
  crimson: "light"
};

interface ThemeContextValue {
  theme: ThemeMode;
  artTheme: ArtTheme;
  setTheme: (next: ThemeMode) => void;
  setArtTheme: (next: ArtTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function readInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_MODE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function normalizeArtTheme(value: string | null | undefined): ArtTheme {
  if (value && ART_THEMES.includes(value as ArtTheme)) return value as ArtTheme;
  if (value && LEGACY_ART_THEME_MAP[value]) return LEGACY_ART_THEME_MAP[value];
  return DEFAULT_ART_THEME;
}

export function resolveInitialArtTheme(
  storedArtTheme: string | null | undefined,
  storedDefaultVersion: string | null | undefined
): ArtTheme {
  if (storedDefaultVersion !== ART_THEME_DEFAULT_VERSION) {
    return DEFAULT_ART_THEME;
  }
  return normalizeArtTheme(storedArtTheme);
}

function readInitialArt(): ArtTheme {
  if (typeof window === "undefined") return DEFAULT_ART_THEME;
  const stored = window.localStorage.getItem(STORAGE_ART_KEY);
  const storedDefaultVersion = window.localStorage.getItem(STORAGE_ART_DEFAULT_VERSION_KEY);
  return resolveInitialArtTheme(stored, storedDefaultVersion);
}

function applyTheme(mode: ThemeMode, art: ArtTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  root.classList.add(mode);

  root.setAttribute("data-theme", art);
  root.style.colorScheme = mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => readInitialMode());
  const [artTheme, setArtThemeState] = React.useState<ArtTheme>(() => readInitialArt());

  React.useEffect(() => {
    applyTheme(theme, artTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_MODE_KEY, theme);
      window.localStorage.setItem(STORAGE_ART_KEY, artTheme);
      window.localStorage.setItem(STORAGE_ART_DEFAULT_VERSION_KEY, ART_THEME_DEFAULT_VERSION);
    }
  }, [theme, artTheme]);

  const setTheme = React.useCallback((next: ThemeMode) => setThemeState(next), []);
  const setArtTheme = React.useCallback((next: ArtTheme) => {
    setArtThemeState(next);
    setThemeState(ART_THEME_DEFAULT_MODE[next]);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, artTheme, setTheme, setArtTheme, toggleTheme }),
    [theme, artTheme, setTheme, setArtTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
