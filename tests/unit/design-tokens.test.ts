import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

/** Valeur d'un token dans le premier bloc qui commence par `selector`. */
function tokenIn(selector: string, name: string): string | undefined {
  const start = css.indexOf(selector);
  if (start < 0) return undefined;
  const block = css.slice(start, css.indexOf("}", start));
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toUpperCase();
}

// SPEC §11, mode clair.
const light: Record<string, string> = {
  bg: "#F4F3F8",
  surface: "#FFFFFF",
  ink: "#17151F",
  muted: "#6B6878",
  line: "#ECEAF2",
  violet: "#7A5AF8",
  banana: "#FFD23F",
  green: "#1FA85A",
  "blue-soft": "#DCEBFF",
  "blue-ink": "#1F4E8C",
  "pink-soft": "#FFE6EC",
  "pink-ink": "#A3264A",
  "yellow-soft": "#FFF6D6",
  peach: "#FFE3D6",
  "peach-ink": "#A33A12",
  chip: "#F1F0F5",
};

// SPEC §11, mode sombre (tokens de base).
const dark: Record<string, string> = {
  bg: "#121019",
  surface: "#1E1B27",
  ink: "#F3F1F8",
  muted: "#A6A2B4",
  line: "#2C2838",
};

describe("design tokens", () => {
  it.each(Object.entries(light))("mode clair : --%s = %s", (name, value) => {
    expect(tokenIn(":root {", name)).toBe(value);
  });

  it.each(Object.entries(dark))("mode sombre forcé : --%s = %s", (name, value) => {
    expect(tokenIn(':root[data-theme="dark"]', name)).toBe(value);
  });

  it.each(Object.entries(dark))("mode sombre système : --%s = %s", (name, value) => {
    expect(tokenIn(':root:not([data-theme="light"])', name)).toBe(value);
  });

  it("expose les rayons de la refonte v2", () => {
    expect(css).toMatch(/--radius-card:\s*28px/);
    expect(css).toMatch(/--radius-sheet:\s*32px/);
    expect(css).toMatch(/--radius-pill:\s*999px/);
  });
});
