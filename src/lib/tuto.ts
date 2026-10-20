import { createHash } from "node:crypto";

/**
 * Fiche tuto d'une association (SPEC_JANVIER §8 bis B) : un seul contenu, rendu en PDF (2 pages A4) et en page web.
 * Page 1 pour les familles, page 2 pour le bureau et les bénévoles.
 */
export type TutoInput = {
  associationName: string;
  code: string;
  schools: { name: string; city: string }[];
  /** Date de début du partenariat (validation de l'association) et de génération. */
  startDate: string;
  generatedAt: string;
  baseUrl: string;
};

export const CONTACT_EMAIL = "bonjour@finpret.app";

export function familyUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, "")}/ecole/${code}`;
}

/** Adresse lisible sans protocole (« finpret.app/ecole/APE-X »), pour le texte imprimé. */
export function displayUrl(baseUrl: string, code: string): string {
  return familyUrl(baseUrl, code).replace(/^https?:\/\//, "");
}

/** Le PDF est régénéré quand ce hash change : nom, code, écoles (SPEC_JANVIER §8 bis B). */
export function tutoSourceHash(input: Pick<TutoInput, "associationName" | "code" | "schools">): string {
  const schools = input.schools.map((s) => `${s.name}|${s.city}`).sort();
  return createHash("sha256")
    .update(JSON.stringify([input.associationName, input.code, schools]))
    .digest("hex");
}

export function tutoContent(input: TutoInput) {
  const url = displayUrl(input.baseUrl, input.code);
  const schools = input.schools.map((s) => `${s.name} (${s.city})`).join(", ");
  return {
    family: {
      title: `${input.associationName} vous présente Fin Prêt`,
      hook: "Le dimanche, tu cuisines. La semaine est fin prête.",
      stepsTitle: "Comment démarrer en 3 étapes",
      steps: [
        `Scanne le QR code ou va sur ${url}`,
        "Crée ton compte avec ton e-mail et indique l'école de ton enfant",
        "Ta première semaine de repas est prête, avec les menus de la cantine",
      ],
      featuresTitle: "Ce que tu trouveras dans l'app",
      features: [
        "Les menus de la cantine et une alerte quand le dîner ressemble au déjeuner",
        "Un menu de la semaine de saison",
        "La liste de courses partagée",
        "La session du dimanche guidée pas à pas",
      ],
      benefit: `Avec le code ${input.code} : 30 jours d'essai gratuit, puis 39,99 € la première année au lieu de 49,99 €. Chaque abonnement soutient les projets de ${input.associationName}.`,
      address: url,
    },
    bureau: {
      title: "Votre partenariat en bref",
      summary: [
        ["Code", input.code],
        ["Écoles", schools],
        ["Début du partenariat", input.startDate],
        ["Contact Fin Prêt", CONTACT_EMAIL],
      ] as [string, string][],
      roleTitle: "Le rôle de l'association",
      role: [
        "Partager le code (kit : e-mail type, message pour les groupes de parents, affiche, flyer).",
        "Publier les menus de la cantine chaque mois dans l'espace association : import du PDF de la mairie ou saisie, 10 minutes.",
        "Suivre les inscriptions dans votre espace.",
      ],
      payoutsTitle: "Vos reversements",
      payouts: [
        ["Abonnement annuel", "8 €"],
        ["Mois d'abonnement mensuel", "0,50 €"],
      ] as [string, string][],
      payoutsNote: "Versement trimestriel dès 20 €, relevé envoyé par e-mail.",
      rulesTitle: "Les règles à respecter",
      rules: [
        "Communiquer par les canaux de l'association.",
        "Pas de diffusion dans les cartables ni d'affichage sans l'accord du directeur.",
        "Ne jamais s'adresser aux enfants.",
        "L'association ne reçoit et ne demande aucune donnée personnelle des familles.",
      ],
      calendarTitle: "Calendrier type",
      calendar: [
        "Septembre et janvier : lancement auprès des familles",
        "Chaque fin de mois : menus du mois suivant",
        "Fin de trimestre : relevé et virement",
      ],
      generated: `Document généré le ${input.generatedAt}`,
    },
  };
}
