// Génère src/styles/tokens.css depuis design-system/tokens.json (SPEC_JANVIER J0).
// Usage : pnpm tokens          écrit le fichier
//         pnpm tokens --check  échoue si le fichier généré n'est pas à jour (CI)
import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../design-system/tokens.json", import.meta.url);
const target = new URL("../src/styles/tokens.css", import.meta.url);
const { color, radius, motion, border, shadow } = JSON.parse(readFileSync(source, "utf8"));

const vars = (set, pad) =>
  Object.entries(set)
    .map(([name, value]) => `${pad}--${name}: ${value};`)
    .join("\n");

const css = `/* Fichier généré par \`pnpm tokens\` depuis design-system/tokens.json : ne pas modifier à la main. */

/* Le thème suit le système ; data-theme="light" | "dark" sur <html> force un choix manuel. */
:root {
  color-scheme: light;
${vars(color.light, "  ")}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${vars(color.dark, "    ")}
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
${vars(color.dark, "  ")}
}

/* Rayons (échelle Tailwind) et courbe de mouvement : utilitaires rounded-card, rounded-sheet, rounded-pill, ease-base. */
@theme {
  --radius-card: ${radius.card};
  --radius-sheet: ${radius.sheet};
  --radius-pill: ${radius.pill};
  --radius-r1: ${radius.r1};
  --radius-r2: ${radius.r2};
  --ease-base: ${motion.ease};
}

/* Bordure et ombres dures (néo-brutalisme) : 2 px / 3 px, décalage x = y, flou 0. */
:root {
  --bw: ${border.mobile};
  --shadow-sm-px: ${shadow.sm};
  --shadow-base-px: ${shadow.base};
  --shadow-lg-px: ${shadow.lg};
}
@media (min-width: 900px) {
  :root {
    --bw: ${border.desktop};
    --shadow-sm-px: 3px;
    --shadow-base-px: 6px;
    --shadow-lg-px: 9px;
  }
}

/* Zone qui reste en mode clair quel que soit le thème : bandeaux de marque et maquettes d'écrans. */
.theme-light {
  color-scheme: light;
${vars(color.light, "  ")}
}
`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {}
  if (current.replace(/\r\n/g, "\n") !== css) {
    console.error("src/styles/tokens.css n'est pas à jour : lance `pnpm tokens`.");
    process.exit(1);
  }
  console.log("tokens.css à jour.");
} else {
  writeFileSync(target, css);
  console.log("src/styles/tokens.css généré.");
}
