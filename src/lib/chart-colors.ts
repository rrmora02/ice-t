"use client";

import { useSyncExternalStore } from "react";

// Paleta validada del skill de dataviz (references/palette.md). Se usa tal
// cual (sin swaps) por lo que no requiere re-validar con el script.
export const CATEGORICAL = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

export const SEQUENTIAL_BLUE = {
  light: "#2a78d6",
  dark: "#3987e5",
};

export const CHROME = {
  light: {
    surface: "#fcfcfb",
    primaryInk: "#0b0b0b",
    secondaryInk: "#52514e",
    mutedInk: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
  },
  dark: {
    surface: "#1a1a19",
    primaryInk: "#ffffff",
    secondaryInk: "#c3c2b7",
    mutedInk: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
  },
};

function subscribeToColorScheme(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getColorSchemeSnapshot(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getColorSchemeServerSnapshot(): "light" | "dark" {
  return "light";
}

export function useChartTheme() {
  const mode = useSyncExternalStore(subscribeToColorScheme, getColorSchemeSnapshot, getColorSchemeServerSnapshot);

  return {
    mode,
    categorical: CATEGORICAL[mode],
    sequential: SEQUENTIAL_BLUE[mode],
    chrome: CHROME[mode],
  };
}
