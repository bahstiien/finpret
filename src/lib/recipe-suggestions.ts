import { z } from "zod";
import { EDITABLE_KINDS } from "@/engine/catalog/admin-recipe";

/** Suggestions de recettes envoyées par les utilisateurs (Découvrir), traitées dans /admin/recettes. */

export const SUGGESTION_STATUSES = ["new", "accepted", "rejected"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: "À traiter",
  accepted: "Appliquée",
  rejected: "Refusée",
};

/** Envoi par un utilisateur : modification d'une recette de la bibliothèque, ou nouvelle recette. */
export const suggestionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("edit"),
    recipeId: z.string().min(1).max(80),
    message: z.string().trim().min(5).max(4000),
  }),
  z.object({
    kind: z.literal("new"),
    recipeKind: z.enum(EDITABLE_KINDS),
    title: z.string().trim().min(2).max(120),
    message: z.string().trim().min(5).max(4000),
    sourceUrl: z
      .union([z.literal(""), z.url({ protocol: /^https?$/ }).max(2000)])
      .optional()
      .transform((v) => v || null),
  }),
]);
export type SuggestionInput = z.input<typeof suggestionSchema>;

/** Au plus 10 suggestions par compte sur 24 heures. */
export const SUGGESTIONS_PER_DAY = 10;
