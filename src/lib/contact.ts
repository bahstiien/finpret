import { z } from "zod";
import { fr } from "@/i18n/fr";

/** Famille ou association : change le sujet proposé et les champs demandés. */
export const CONTACT_AUDIENCES = ["famille", "asso"] as const;
export type ContactAudience = (typeof CONTACT_AUDIENCES)[number];

/** Sujets proposés pour chaque public (libellés de l'écran, repris tels quels dans l'e-mail à l'équipe). */
export const contactSubjects = (audience: ContactAudience): readonly string[] => fr.contact.subjects[audience];

const text = (max: number) => z.string().trim().max(max);

/** Message du formulaire de contact : le sujet doit faire partie de la liste du public choisi. */
export const contactSchema = z
  .object({
    audience: z.enum(CONTACT_AUDIENCES),
    name: text(60).min(1),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    subject: text(120),
    message: text(2000).min(10),
    association: text(120).optional(),
    school: text(160).optional(),
    // Champ piège : un robot le remplit, une personne ne le voit pas.
    website: z.string().max(0).optional(),
  })
  .refine((v) => contactSubjects(v.audience).includes(v.subject));

export type ContactInput = z.infer<typeof contactSchema>;
