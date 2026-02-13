import { useEffect } from "react";
import type { ThemeMode } from "../../../domain/settings/types";

export function useThemeSync(theme?: ThemeMode | null) {
  useEffect(() => {
    if (!theme) {
      return () => undefined;
    }
    const root = document.documentElement;
    const resolveTheme = () => {
      if (theme !== "system") {
        return theme;
      }
      if (typeof window === "undefined" || !window.matchMedia) {
        return "light";
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };
    const applyTheme = (value: "light" | "dark") => {
      root.dataset.theme = value;
      root.style.colorScheme = value;
    };
    applyTheme(resolveTheme());
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return () => undefined;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(media.matches ? "dark" : "light");
    if (media.addEventListener) {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, [theme]);
}
