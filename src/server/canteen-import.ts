import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { type DatedMenu, splitByDate } from "@/engine/canteen";
import { callModel, llmAvailable } from "@/server/recipe-fetch";

/**
 * Import d'un menu de cantine (§13) : texte du PDF, puis découpage par date (règles, puis modèle de langage
 * s'il est configuré). Le PDF n'est pas conservé : seuls les menus datés, à valider, sont enregistrés.
 * Écart avec la spec : pas de passage par Storage ni d'Edge Function (extraction dans l'action serveur).
 */

export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export async function pdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text.slice(0, 50_000);
  } catch {
    return null;
  }
}

const llmMenusSchema = z.object({
  menus: z
    .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), text: z.string().min(3).max(300) }))
    .max(60),
});

/** Menus datés d'un texte : règles d'abord ; modèle de langage en repli si rien n'est trouvé. */
export async function menusFromText(text: string, today: string): Promise<DatedMenu[]> {
  const found = splitByDate(text, today);
  if (found.length || !llmAvailable()) return found;
  try {
    const raw = await callModel(
      `Voici le texte d'un menu de cantine scolaire. Nous sommes le ${today}. Réponds uniquement avec ` +
        `{"menus": [{"date": "AAAA-MM-JJ", "text": "plats du jour séparés par des virgules"}]}, un élément par jour ` +
        `avec repas (ignore les jours fériés ou sans cantine).\n\n${text.slice(0, 12_000)}`,
    );
    const parsed = llmMenusSchema.safeParse(raw);
    return parsed.success ? parsed.data.menus : [];
  } catch {
    return [];
  }
}
