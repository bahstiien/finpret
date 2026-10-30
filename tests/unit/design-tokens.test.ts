import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css =
  readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8") +
  readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

/** Valeur d'un token dans le premier bloc qui commence par `selector`. */
function tokenIn(selector: string, name: string): string | undefined {
  const start = css.indexOf(selector);
  if (start < 0) return undefined;
  const block = css.slice(start, css.indexOf("}", start));
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toUpperCase();
}

// SPEC §11, mode clair.
const light: Record<string, string> = {
  bg: "#FFF8E7",
  surface: "#FFFFFF",
  ink: "#17151F",
  muted: "#4A4658",
  line: "#17151F",
  violet: "#7A5AF8",
  banana: "#FFD23F",
  green: "#1FA85A",
  "blue-soft": "#4D96FF",
  "blue-ink": "#17151F",
  "pink-soft": "#FF6B9D",
  "pink-ink": "#17151F",
  "yellow-soft": "#FFF6D6",
  peach: "#FF8C42",
  "peach-ink": "#17151F",
  chip: "#FFF6D6",
};

// Mode sombre : neutres limités à la liste du skill landing-page-design (#000000, #181818, #1F1F1F, #272727, #313131, #131209).
const dark: Record<string, string> = {
  bg: "#181818",
  surface: "#1F1F1F",
  ink: "#F3F1F8",
  muted: "#A6A2B4",
  line: "#313131",
  chip: "#272727",
  nav: "#000000",
};

const DARK_NEUTRALS = ["#000000", "#181818", "#1F1F1F", "#272727", "#313131", "#131209"];

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

  it("garde les fonds sombres neutres dans la liste autorisée", () => {
    for (const name of ["bg", "surface", "chip", "line", "nav"]) {
      expect(DARK_NEUTRALS).toContain(dark[name]);
    }
  });

  it("expose les rayons (échelle Tailwind), la courbe de mouvement et une seule police", () => {
    expect(css).toContain("--radius-card: 0.25rem"); // 4 px
    expect(css).toContain("--radius-sheet: 0.25rem");
    expect(css).toContain("--radius-pill: 9999px");
    expect(css).toContain("--ease-base: steps(2)");
    expect(css).toContain("--font-display: var(--font-archivo)");
    expect(css).toContain("--font-sans: var(--font-grotesk)");
  });
});
