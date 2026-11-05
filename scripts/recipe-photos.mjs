// Importe les visuels de recettes : `node scripts/recipe-photos.mjs <dossier de PNG>`.
// Chaque `<id>.png` devient `public/recettes/<slug>.webp` (1200 × 900), et chaque slug illustré est écrit
// dans `src/seo/photos.json` avec la couleur du fond uni de chaque visuel (lue par src/seo/images.ts : fond d'attente,
// carrousel de l'accueil). Relancer le script après un ajout de visuels.
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2];
if (!src) {
  console.error("Usage : node scripts/recipe-photos.mjs <dossier de PNG>");
  process.exit(1);
}

const out = path.join(process.cwd(), "public", "recettes");
await mkdir(out, { recursive: true });

const slugOf = (id) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const files = (await readdir(src)).filter((f) => f.toLowerCase().endsWith(".png")).sort();
const colors = {};
const hex = (n) => Math.round(n).toString(16).padStart(2, "0");
let bytes = 0;
for (const f of files) {
  const slug = slugOf(f.slice(0, -4));
  const file = path.join(src, f);
  // Le fond est uni : la moyenne d'une bande du bord gauche, à mi-hauteur (hors vignettage des coins et de l'ombre), suffit.
  const { data, info: px } = await sharp(file)
    .extract({ left: 16, top: 420, width: 48, height: 240 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  colors[slug] = `#${sum.map((v) => hex(v / (px.width * px.height))).join("")}`;
  const info = await sharp(file)
    .resize(1200, 900, { fit: "cover" })
    .webp({ quality: 78, effort: 5 })
    .toFile(path.join(out, `${slug}.webp`));
  bytes += info.size;
}

await writeFile(path.join(process.cwd(), "src", "seo", "photos.json"), `${JSON.stringify(colors)}\n`);
console.log(`${files.length} visuels, ${(bytes / 1e6).toFixed(1)} Mo au total`);
