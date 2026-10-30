/**
 * Polices des images de partage (Archivo Black, Space Grotesk, Space Mono), chargées depuis Google Fonts au premier
 * appel puis gardées en mémoire. En cas d'échec (hors ligne), on renvoie une liste vide : ImageResponse retombe alors
 * sur sa police système par défaut.
 */
type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

async function load(family: string, weight: 400 | 700, name: string): Promise<Font | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, { cache: "force-cache" })
    ).text();
    const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url) return null;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return { name, data: await res.arrayBuffer(), weight, style: "normal" };
  } catch {
    return null;
  }
}

let cache: Promise<Font[]> | null = null;

export function shareFonts(): Promise<Font[]> {
  cache ??= Promise.all([
    load("Archivo+Black", 400, "Archivo Black"),
    load("Space+Grotesk", 700, "Space Grotesk"),
    load("Space+Mono", 700, "Space Mono"),
  ]).then((fonts) => {
    const ok = fonts.filter((f): f is Font => f !== null);
    // Ne garde pas un échec en cache : le prochain appel réessaie.
    if (ok.length < 3) cache = null;
    return ok;
  });
  return cache;
}
