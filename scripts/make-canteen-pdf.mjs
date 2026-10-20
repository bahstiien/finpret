// Génère tests/fixtures/canteen/menu-exemple.pdf : un menu de cantine fictif d'une semaine (texte seul).
// Usage : node scripts/make-canteen-pdf.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { textPdf } from "./lib/text-pdf.mjs";

const lines = [
  "Restaurant scolaire - Menus de la semaine (exemple fictif)",
  "Lundi 19 octobre 2026",
  "Carottes rapees",
  "Coquillettes bolognaise",
  "Yaourt nature",
  "Mardi 20 octobre 2026",
  "Filet de colin, riz pilaf",
  "Compote",
  "Mercredi 21 octobre 2026 : pas de cantine",
  "Jeudi 22 octobre 2026",
  "Omelette, puree de potiron",
  "Fromage blanc",
  "Vendredi 23 octobre 2026",
  "Poulet roti, haricots verts",
  "Fruit de saison",
];

mkdirSync("tests/fixtures/canteen", { recursive: true });
writeFileSync("tests/fixtures/canteen/menu-exemple.pdf", textPdf(lines));
console.log("tests/fixtures/canteen/menu-exemple.pdf");
