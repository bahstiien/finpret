// Génère src/components/ui/glyphs.ts : les tracés Phosphor (graisse « regular ») des icônes utilisées.
// Les composants Phosphor embarquent leurs 6 graisses ; on ne garde que celle de l'application pour alléger le JS client.
// Les icônes utilisées sont lues dans les composants Icon (valeurs "NomPhosphor" de leurs tables).
// Usage : pnpm icons          écrit le fichier
//         pnpm icons --check  échoue si le fichier généré n'est pas à jour (CI)
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Phosphor from "@phosphor-icons/react/ssr";

const sources = ["../src/components/ui/Icon.tsx", "../src/components/landing/Icon.tsx"];
const target = new URL("../src/components/ui/glyphs.ts", import.meta.url);

const names = new Set();
for (const s of sources) {
  const text = readFileSync(new URL(s, import.meta.url), "utf8");
  for (const [, name] of text.matchAll(/^\s+\w+: "([A-Z]\w*)",$/gm)) names.add(name);
}

const entries = [...names].sort().map((name) => {
  const Glyph = Phosphor[name];
  if (!Glyph) throw new Error(`Icône Phosphor inconnue : ${name}`);
  const svg = renderToStaticMarkup(createElement(Glyph));
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const paths = [...inner.matchAll(/<path d="([^"]+)"><\/path>/g)].map((m) => m[1]);
  if (paths.map((d) => `<path d="${d}"></path>`).join("") !== inner) {
    throw new Error(`${name} : tracé autre qu'une suite de <path d> (${inner.slice(0, 80)}…)`);
  }
  return `  ${name}: [${paths.map((d) => JSON.stringify(d)).join(", ")}],`;
});

const ts = `/* Fichier généré par \`pnpm icons\` (scripts/icons.mjs) : ne pas modifier à la main. */
/** Tracés Phosphor « regular » (viewBox 0 0 256 256) des icônes de l'application. */
export const GLYPHS = {
${entries.join("\n")}
} as const satisfies Record<string, readonly string[]>;

export type GlyphName = keyof typeof GLYPHS;
`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // Absent : signalé ci-dessous.
  }
  if (current.replace(/\r\n/g, "\n") !== ts) {
    console.error("src/components/ui/glyphs.ts n'est pas à jour : lance `pnpm icons`.");
    process.exit(1);
  }
} else {
  writeFileSync(target, ts);
  console.log(`${entries.length} icônes écrites dans src/components/ui/glyphs.ts`);
}
