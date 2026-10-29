// Génère src/styles/tokens.css depuis design-system/tokens.json (SPEC_JANVIER J0).
// Usage : pnpm tokens          écrit le fichier
//         pnpm tokens --check  échoue si le fichier généré n'est pas à jour (CI)
import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../design-system/tokens.json", import.meta.url);
const target = new URL("../src/styles/tokens.css", import.meta.url);
const { color, radius, motion, border, shadow, role, touch, duration, tilt, zIndex } = JSON.parse(readFileSync(source, "utf8"));

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

/* Rôles et domaines (alias), rayons, cibles tactiles, durées, inclinaisons, z-index du design system « Fin Prêt Néo ». */
:root {
${vars(role, "  ")}
  --r0: ${radius.r0};
  --r1: ${radius.r1};
  --r2: ${radius.r2};
  --r-pill: 999px;
  --touch-min: ${touch.min};
  --touch-main: ${touch.main};
  --touch-session: ${touch.session};
  --t-fast: ${duration.fast};
  --t-stamp: ${duration.stamp};
${vars(Object.fromEntries(Object.entries(tilt).filter(([k]) => k !== "note").map(([k, v]) => ["tilt-" + k, v])), "  ")}
${vars(Object.fromEntries(Object.entries(zIndex).map(([k, v]) => ["z-" + k, v])), "  ")}
}

/* Bordure et ombres dures (néo-brutalisme) : 2 px / 3 px, décalage x = y, flou 0. */
:root {
  --bw: ${border.mobile};
  --shadow-sm-px: ${shadow.sm};
  --shadow-base-px: ${shadow.base};
  --shadow-lg-px: ${shadow.lg};
  --off-sm: var(--shadow-sm-px);
  --off: var(--shadow-base-px);
  --off-lg: var(--shadow-lg-px);
  --sh-sm: var(--off-sm) var(--off-sm) 0 var(--line);
  --sh: var(--off) var(--off) 0 var(--line);
  --sh-lg: var(--off-lg) var(--off-lg) 0 var(--line);
  --sh-violet: var(--off) var(--off) 0 var(--violet);
  --sh-banane: var(--off) var(--off) 0 var(--banane);
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
