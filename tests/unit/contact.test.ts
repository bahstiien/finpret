import { describe, expect, it } from "vitest";
import { contactSchema, contactSubjects } from "@/lib/contact";

const base = {
  audience: "famille",
  name: "Camille",
  email: "Camille.Martin@Exemple.fr",
  subject: "Mon abonnement",
  message: "Bonjour, je voudrais passer à l'abonnement annuel.",
};

describe("formulaire de contact", () => {
  it("accepte un message complet et met l'adresse en minuscules", () => {
    const parsed = contactSchema.parse(base);
    expect(parsed.email).toBe("camille.martin@exemple.fr");
  });

  it("refuse un sujet qui n'est pas dans la liste du public choisi", () => {
    expect(contactSchema.safeParse({ ...base, subject: "Suivre la rétrocession" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, audience: "asso", subject: "Suivre la rétrocession" }).success).toBe(true);
  });

  it("refuse un message trop court, une adresse invalide et le champ piège rempli", () => {
    expect(contactSchema.safeParse({ ...base, message: "Salut" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, email: "pas-une-adresse" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, website: "https://spam.example" }).success).toBe(false);
  });

  it("propose des sujets différents pour les familles et les associations", () => {
    expect(contactSubjects("famille")).not.toEqual(contactSubjects("asso"));
    expect(contactSubjects("asso")).toContain("Devenir association partenaire");
  });
});
