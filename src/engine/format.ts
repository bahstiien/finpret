import type { Library } from "./types";

/** Quantités et contenants (§7.4) : port de num, snapNum, packBest, packBuy, fmtQ, shopQ, fill, fmtRaw. */

/** Nombre au format français (virgule décimale). */
export const num = (x: number) => String(x).replace(".", ",");
/** Portions arrondies au centième. */
export const fmtP = (p: number) => num(Math.round(p * 100) / 100);
/** Durée en minutes : « 2 h 05 » ou « 45 min ». */
export function dur(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h} h ${String(mm).padStart(2, "0")}` : `${mm} min`;
}

type Pack = { s: number[]; l: string; tol?: number };

function packCombos(p: Pack, maxN: number): number[] {
  const out = new Set<number>();
  const s = p.s;
  for (let a = 0; a <= maxN; a++) {
    for (let b = 0; b <= (s[1] ? maxN : 0); b++) {
      if (a + b === 0 || a + b > maxN) continue;
      out.add(a * s[0]! + (s[1] ? b * s[1] : 0));
    }
  }
  return [...out].sort((x, y) => x - y);
}

/** Ramène une quantité de recette au contenant du commerce le plus proche (4 au plus) si l'écart reste dans la tolérance. */
export function snapNum(lib: Library, k: string, q: number): number {
  const p = lib.packs[k];
  if (!p || !(q > 0)) return q;
  const tol = p.tol || 0.2;
  let best: number | null = null;
  for (const c of packCombos(p, 4)) {
    const d = Math.abs(c - q) / q;
    if (d <= tol && (best === null || Math.abs(c - q) < Math.abs(best - q))) best = c;
  }
  return best === null ? q : best;
}

/** Plus petite combinaison de contenants couvrant au moins 97 % du besoin. */
export function packBest(lib: Library, k: string, q: number) {
  const p = lib.packs[k];
  if (!p) return null;
  const s = p.s;
  let best: { a: number; b: number; tot: number; n: number } | null = null;
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= (s[1] ? 12 : 0); b++) {
      const tot = a * s[0]! + (s[1] ? b * s[1] : 0);
      if (tot === 0 || tot < q * 0.97) continue;
      if (!best || tot < best.tot || (tot === best.tot && a + b < best.n)) best = { a, b, tot, n: a + b };
    }
  }
  return best;
}

/** Contenants à acheter : « 2 bouteilles de 700 g ». */
export function packBuy(lib: Library, k: string, q: number): string {
  const p = lib.packs[k]!;
  const s = p.s;
  const u = lib.ingredients[k]!.u;
  const best = packBest(lib, k, q);
  if (!best) return fmtQ(lib, k, q);
  const pl = (n: number, w: string) => (n > 1 ? (w.endsWith("s") ? w : w + "s") : w);
  const parts: string[] = [];
  if (best.a) parts.push(`${best.a} ${pl(best.a, p.l)} de ${s[0]} ${u}`);
  if (best.b) parts.push(`${best.b} ${pl(best.b, p.l)} de ${s[1]} ${u}`);
  return parts.join(" + ");
}

/** Quantité affichée dans une recette (arrondie, en contenants quand c'est possible). */
export function fmtQ(lib: Library, k: string, q: number): string {
  const g = lib.ingredients[k];
  if (!g) return "";
  const q0 = q;
  q = snapNum(lib, k, q);
  if (lib.packs[k] && q !== q0 && (g.u === "g" || g.u === "ml")) {
    return q >= 1000 ? num(Math.round(q / 100) / 10) + (g.u === "g" ? " kg" : " l") : q + " " + g.u;
  }
  if (g.u === "g" || g.u === "ml") {
    const r = q < 50 ? Math.max(5, Math.round(q / 5) * 5) : Math.round(q / 10) * 10;
    if (r >= 1000) return num(Math.round(r / 100) / 10) + (g.u === "g" ? " kg" : " l");
    return r + " " + g.u;
  }
  if (g.u === "cs" || g.u === "cc") {
    const r = Math.max(0.5, Math.round(q * 2) / 2);
    return num(r) + (g.u === "cs" ? " c.s." : " c.c.");
  }
  if (g.u === "boite") {
    const r = Math.max(1, Math.round(q));
    return r + (r > 1 ? " boîtes" : " boîte");
  }
  if (g.u === "pc") {
    const n = g.n ?? [g.l, g.l];
    if (g.half) {
      const r = Math.max(0.5, Math.round(q * 2) / 2);
      return r === 0.5 ? "½ " + n[0] : num(r) + " " + (r > 1 ? n[1] : n[0]);
    }
    const r = Math.max(1, Math.round(q));
    return r + " " + (r > 1 ? n[1] : n[0]);
  }
  return num(q);
}

/** Quantité affichée dans la liste de courses. */
export function shopQ(lib: Library, k: string, q: number): string {
  const g = lib.ingredients[k]!;
  if (g.u === "boite") {
    const r = Math.max(1, Math.ceil(q - 0.25));
    return r + (r > 1 ? " boîtes" : " boîte") + (g.s ?? "");
  }
  if (lib.packs[k] && (g.u === "g" || g.u === "ml")) return packBuy(lib, k, q);
  if (g.u === "pc") {
    const r = Math.max(1, Math.ceil(g.half ? q : Math.round(q)));
    const n = g.n ?? [g.l, g.l];
    return g.showN ? r + " " + (r > 1 ? n[1] : n[0]) : String(r);
  }
  return fmtQ(lib, k, q);
}

/** Remplace les placeholders `{clé}` par la quantité mise à l'échelle. */
export const fill = (lib: Library, txt: string, ing: Record<string, number>, sc: number) =>
  txt.replace(/\{(\w+)\}/g, (_, k: string) => (ing[k] !== undefined ? fmtQ(lib, k, ing[k]! * sc) : k));

/** Reste brut (garde-manger), arrondi à 10 g ou 10 ml. */
export function fmtRaw(lib: Library, k: string, q: number): string {
  const u = lib.ingredients[k]!.u;
  if (u === "g" || u === "ml") {
    const r = Math.max(10, Math.round(q / 10) * 10);
    return r >= 1000 ? num(Math.round(r / 100) / 10) + (u === "g" ? " kg" : " l") : r + " " + u;
  }
  return fmtQ(lib, k, q);
}
