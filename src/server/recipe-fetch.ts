import "server-only";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { checkUrl, isPrivateIp } from "@/engine/import/url";
import { type ExtractedRecipe, extractRecipe, mainText } from "@/engine/import/jsonld";

/**
 * Récupération d'une page de recette (§8.8, étape 1) : une seule requête à la demande de l'utilisateur,
 * IP résolue vérifiée (SSRF), 10 s et 3 Mo au plus, User-Agent identifié.
 *
 * Écart avec la spec : le pipeline tourne dans une action serveur Next.js et non dans une Edge Function
 * Supabase (pas de jeton de déploiement des fonctions pour l'instant). Les règles sont les mêmes.
 */

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "MenuDeLaSemaine/1.0 (import de recette à la demande d'un utilisateur)";

export type FetchError = "blocked" | "timeout" | "too_big" | "http" | "not_html" | "network";
export type FetchResult = { ok: true; html: string; finalUrl: URL } | { ok: false; error: FetchError };

/**
 * Pages de test servies sans réseau (e2e uniquement) : hôte réservé `.test`, actif seulement si
 * IMPORT_FIXTURES_DIR est défini (jamais en production).
 */
async function fixture(url: URL): Promise<FetchResult | null> {
  const dir = process.env.IMPORT_FIXTURES_DIR;
  if (!dir || url.hostname !== "recettes.test") return null;
  const name = path.basename(url.pathname).replace(/[^a-z0-9-]/gi, "");
  if (name === "lent") return { ok: false, error: "timeout" };
  try {
    return { ok: true, html: await readFile(path.join(dir, `${name}.html`), "utf8"), finalUrl: url };
  } catch {
    return { ok: false, error: "http" };
  }
}

async function resolvesPublic(host: string): Promise<boolean> {
  try {
    const addresses = await lookup(host.replace(/^\[|\]$/g, ""), { all: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

/** Lit le corps en s'arrêtant à `max` octets. */
async function readLimited(res: Response, max: number): Promise<Buffer | null> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

type FetchOptions = { fetchImpl?: typeof fetch; timeoutMs?: number };
type BytesResult = { ok: true; bytes: Buffer; finalUrl: URL } | { ok: false; error: FetchError };

/**
 * Requête unique vers un site public : IP résolue vérifiée à chaque redirection (3 au plus), délai et taille bornés.
 * `accept` : page web (recette) ou PDF (menu de la cantine).
 */
export async function fetchPublic(
  raw: string,
  accept: "html" | "pdf",
  { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS }: FetchOptions = {},
): Promise<BytesResult> {
  const check = checkUrl(raw);
  if (!check.ok) return { ok: false, error: "blocked" };
  const signal = AbortSignal.timeout(timeoutMs);
  let url = check.url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await resolvesPublic(url.hostname))) return { ok: false, error: "blocked" };
      const res = await fetchImpl(url, {
        redirect: "manual",
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: accept === "pdf" ? "application/pdf" : "text/html,application/xhtml+xml",
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = checkUrl(new URL(res.headers.get("location")!, url).toString());
        if (!next.ok) return { ok: false, error: "blocked" };
        url = next.url;
        continue;
      }
      if (!res.ok) return { ok: false, error: "http" };
      const type = res.headers.get("content-type") ?? "";
      const expected = accept === "pdf" ? /pdf|octet-stream/i : /html|xml/i;
      if (type && !expected.test(type)) return { ok: false, error: "not_html" };
      if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return { ok: false, error: "too_big" };
      const bytes = await readLimited(res, MAX_BYTES);
      if (bytes === null) return { ok: false, error: "too_big" };
      return { ok: true, bytes, finalUrl: url };
    }
    return { ok: false, error: "http" };
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return { ok: false, error: "timeout" };
    return { ok: false, error: "network" };
  }
}

export async function fetchRecipePage(raw: string, options: FetchOptions = {}): Promise<FetchResult> {
  const check = checkUrl(raw);
  if (!check.ok) return { ok: false, error: "blocked" };
  const fromFixture = await fixture(check.url);
  if (fromFixture) return fromFixture;
  const res = await fetchPublic(raw, "html", options);
  return res.ok ? { ok: true, html: new TextDecoder("utf-8").decode(res.bytes), finalUrl: res.finalUrl } : res;
}

// ---------------------------------------------------------------------------
// Modèle de langage (facultatif) : extraction sans données structurées, et reformulation des étapes.
// Actif seulement si ANTHROPIC_API_KEY est défini.
// ---------------------------------------------------------------------------

const LLM_MODEL = "claude-haiku-5-5";

const llmRecipeSchema = z.object({
  name: z.string().min(1).max(160),
  servings: z.number().positive().max(50).nullable(),
  ingredients: z.array(z.string().min(1).max(200)).min(1).max(60),
  steps: z.array(z.string().min(2).max(400)).min(1).max(30),
  prepMinutes: z.number().int().min(0).max(1440).nullable(),
  cookMinutes: z.number().int().min(0).max(1440).nullable(),
});
const stepsSchema = z.object({ steps: z.array(z.string().min(2).max(400)).min(1).max(30) });

export const llmAvailable = () => !!process.env.ANTHROPIC_API_KEY;

export async function callModel(prompt: string, maxTokens = 2000): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: LLM_MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`modèle : ${res.status}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

const STYLE =
  "Étapes : phrases courtes à l'impératif, au tutoiement, en français, sans reprendre le texte d'origine mot pour mot. " +
  "Ne mentionne ni le site ni l'auteur.";

/** Recette lue dans le texte d'une page sans données structurées. null si rien d'exploitable. */
export async function extractWithModel(html: string): Promise<{ recipe: ExtractedRecipe; steps: string[] } | null> {
  if (!llmAvailable()) return null;
  try {
    const raw = await callModel(
      `Voici le texte d'une page web. S'il contient une recette de cuisine, réponds uniquement avec un objet JSON ` +
        `{"name", "servings", "ingredients" (lignes telles quelles, avec quantités), "steps", "prepMinutes", "cookMinutes"}. ` +
        `${STYLE} S'il n'y a pas de recette, réponds {"name": ""}.\n\n${mainText(html)}`,
    );
    const parsed = llmRecipeSchema.safeParse(raw);
    if (!parsed.success) return null;
    const r = parsed.data;
    return {
      recipe: {
        name: r.name,
        yield: r.servings ? String(r.servings) : null,
        ingredients: r.ingredients,
        instructions: [],
        prepTime: r.prepMinutes !== null ? `PT${r.prepMinutes}M` : null,
        cookTime: r.cookMinutes !== null ? `PT${r.cookMinutes}M` : null,
        totalTime: null,
        cuisine: null,
        category: null,
        keywords: null,
        nutrition: null,
        siteName: null,
      },
      steps: r.steps,
    };
  } catch {
    return null;
  }
}

/** Étapes reformulées dans le style de l'app ; [] sans modèle (l'utilisateur les écrit). */
export async function rewriteSteps(name: string, instructions: string[]): Promise<string[]> {
  if (!llmAvailable() || !instructions.length) return [];
  try {
    const raw = await callModel(
      `Reformule les étapes de la recette « ${name} » pour une application de batch cooking. ${STYLE} ` +
        `Réponds uniquement avec {"steps": [...]}.\n\n${instructions.join("\n").slice(0, 8000)}`,
    );
    const parsed = stepsSchema.safeParse(raw);
    return parsed.success ? parsed.data.steps : [];
  } catch {
    return [];
  }
}

export { extractRecipe };
