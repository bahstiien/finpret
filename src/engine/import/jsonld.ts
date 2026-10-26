/** Extraction des données structurées d'une page de recette (§8.8, étape 2) : JSON-LD schema.org Recipe, puis microdonnées. */

export type ExtractedRecipe = {
  name: string;
  yield: string | null;
  ingredients: string[];
  /** Instructions d'origine : servent uniquement à la reformulation, jamais stockées. */
  instructions: string[];
  prepTime: string | null;
  cookTime: string | null;
  totalTime: string | null;
  cuisine: string | null;
  category: string | null;
  keywords: string | null;
  nutrition: { calories?: string; protein?: string; servingSize?: string } | null;
  siteName: string | null;
};

type Node = Record<string, unknown>;

const text = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string") return decodeEntities(v).trim() || null;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object" && "name" in (v as Node)) return text((v as Node).name);
  return null;
};

export function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&ccedil;/g, "ç")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

const isRecipe = (n: Node) => {
  const type = n["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
};

/** Cherche un nœud Recipe dans une structure JSON-LD (tableau, @graph imbriqué). */
function findRecipe(data: unknown): Node | null {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) {
    for (const d of data) {
      const r = findRecipe(d);
      if (r) return r;
    }
    return null;
  }
  const node = data as Node;
  if (isRecipe(node)) return node;
  if (node["@graph"]) return findRecipe(node["@graph"]);
  if (node.mainEntity) return findRecipe(node.mainEntity);
  return null;
}

/** Instructions : texte, liste, HowToStep ou HowToSection (avec itemListElement). */
function instructions(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") {
    return v
      .replace(/<\/(p|li)>|<br\s*\/?>/gi, "\n")
      .split(/\n|(?<=\.)\s+(?=\d+[.)]\s)/)
      .map((s) => decodeEntities(s))
      .filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap(instructions);
  if (typeof v === "object") {
    const n = v as Node;
    if (n.itemListElement) return instructions(n.itemListElement);
    return [text(n.text) ?? text(n.name)].filter((s): s is string => !!s);
  }
  return [];
}

function fromNode(node: Node, site: string | null): ExtractedRecipe {
  const nutrition = node.nutrition as Node | undefined;
  const keywords = node.keywords;
  return {
    name: text(node.name) ?? "",
    yield: text(
      Array.isArray(node.recipeYield)
        ? (node.recipeYield.find((y) => /\D/.test(String(y))) ?? node.recipeYield[0])
        : node.recipeYield,
    ),
    ingredients: ((node.recipeIngredient ?? node.ingredients ?? []) as unknown[])
      .map((i) => text(i))
      .filter((s): s is string => !!s),
    instructions: instructions(node.recipeInstructions),
    prepTime: text(node.prepTime),
    cookTime: text(node.cookTime),
    totalTime: text(node.totalTime),
    cuisine: text(node.recipeCuisine),
    category: text(node.recipeCategory),
    keywords: Array.isArray(keywords) ? keywords.join(", ") : text(keywords),
    nutrition: nutrition
      ? {
          calories: text(nutrition.calories) ?? undefined,
          protein: text(nutrition.proteinContent) ?? undefined,
          servingSize: text(nutrition.servingSize) ?? undefined,
        }
      : null,
    siteName: site,
  };
}

/** Recette trouvée dans le HTML (JSON-LD d'abord, microdonnées ensuite), ou null. */
export function extractRecipe(
  html: string,
): { recipe: ExtractedRecipe; method: "jsonld" | "microdata" } | null {
  const site =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const node = findRecipe(JSON.parse(m[1]!.trim()));
      if (node) {
        const recipe = fromNode(node, site ? decodeEntities(site) : null);
        if (recipe.name && recipe.ingredients.length) return { recipe, method: "jsonld" };
      }
    } catch {
      // JSON-LD mal formé : on essaie le bloc suivant.
    }
  }
  const micro = extractMicrodata(html);
  return micro
    ? { recipe: { ...micro, siteName: site ? decodeEntities(site) : null }, method: "microdata" }
    : null;
}

/** Microdonnées schema.org (itemprop) : second recours. */
function extractMicrodata(html: string): Omit<ExtractedRecipe, "siteName"> | null {
  if (!/itemtype=["']https?:\/\/schema\.org\/Recipe["']/i.test(html)) return null;
  const props = (name: string) =>
    [
      ...html.matchAll(
        new RegExp(
          `<[^>]+itemprop=["']${name}["'][^>]*?(?:content=["']([^"']*)["'][^>]*)?>([\\s\\S]*?)<\\/`,
          "gi",
        ),
      ),
    ].map((m) => decodeEntities(m[1] ?? m[2] ?? ""));
  const name = props("name")[0] ?? "";
  const ingredients = [...props("recipeIngredient"), ...props("ingredients")].filter(Boolean);
  if (!name || !ingredients.length) return null;
  return {
    name,
    yield: props("recipeYield")[0] ?? null,
    ingredients,
    instructions: props("recipeInstructions").filter(Boolean),
    prepTime: props("prepTime")[0] ?? null,
    cookTime: props("cookTime")[0] ?? null,
    totalTime: props("totalTime")[0] ?? null,
    cuisine: props("recipeCuisine")[0] ?? null,
    category: props("recipeCategory")[0] ?? null,
    keywords: null,
    nutrition: null,
  };
}

/** Texte principal d'une page (repli par modèle de langage) : sans scripts, styles ni navigation. */
export function mainText(html: string, max = 12000): string {
  const body = html
    .replace(/<(script|style|noscript|nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|li|h\d|div|br)>/gi, "\n");
  const article = body.match(/<(article|main)[\s\S]*?<\/\1>/i)?.[0] ?? body;
  return decodeEntities(article.replace(/\n/g, " ¶ ")).replace(/ ¶ /g, "\n").slice(0, max);
}
