// Génère les icônes PWA provisoires à partir du logo « M » de la maquette v2.
// Usage : node scripts/generate-icons.mjs
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const svg = (size, padding) => {
  const inner = size - padding * 2;
  const r = inner * 0.25;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#7A5AF8"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${r}" fill="#FFD23F"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="${inner * 0.62}" fill="#17151F">M</text>
</svg>`);
};

await mkdir("public/icons", { recursive: true });
const jobs = [
  ["public/icons/icon-192.png", 192, 24],
  ["public/icons/icon-512.png", 512, 64],
  // Icône « maskable » : zone de sécurité de 80 %, donc plus de marge.
  ["public/icons/icon-maskable-512.png", 512, 110],
  ["public/icons/apple-touch-icon.png", 180, 22],
];
for (const [file, size, padding] of jobs) {
  await sharp(svg(size, padding)).png().toFile(file);
  console.log("✓", file);
}
