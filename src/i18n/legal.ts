/**
 * Texte des pages légales (mentions légales, CGU, CGV), rendu par `LegalPage`.
 * Mise en forme dans les chaînes : `**gras**`, `[libellé](/lien)` et `{{à confirmer}}` pour une information encore
 * manquante (surlignée à l'écran, et un bandeau prévient que le document est en cours de finalisation).
 * Toute modification substantielle des CGU ou CGV change aussi `TERMS_VERSION` (src/lib/legal.ts).
 */

export type LegalBlock =
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { h3: string }
  | { table: { head: string[]; rows: string[][] } }
  /** Encadré (garantie légale, formulaire) : bordure, titre facultatif. */
  | { box: { title?: string; blocks: LegalBlock[] } };

export type LegalSection = { title: string; blocks: LegalBlock[] };

export type LegalDoc = {
  /** Date de la version affichée sous le titre. */
  version: string;
  intro?: LegalBlock[];
  sections: LegalSection[];
};

const EDITOR = "Bastien LE CALVEZ, entrepreneur individuel (EI), nom commercial BLC CORPORATION";
const ADDRESS = "120 rue Alexis Perroncel, 69100 Villeurbanne, France";
const EMAIL = "[bonjour@finpret.app](mailto:bonjour@finpret.app)";
const PHONE = "{{numéro de téléphone à confirmer}}";
const VAT = "TVA non applicable, art. 293 B du CGI";

export const legalDocs = {
  "mentions-legales": {
    version: "6 novembre 2026",
    sections: [
      {
        title: "Éditeur",
        blocks: [
          { p: "Le site et l'application web **Fin Prêt**, accessibles à [finpret.app](https://finpret.app), sont édités par :" },
          {
            ul: [
              `**${EDITOR}**`,
              `Adresse professionnelle : ${ADDRESS}`,
              "SIREN : 923 927 024 — SIRET du siège : 923 927 024 00011",
              "Immatriculé au Registre national des entreprises (RNE) depuis le 1er septembre 2023",
              `Régime de TVA : franchise en base (${VAT})`,
              `E-mail : ${EMAIL}`,
              `Téléphone : ${PHONE}`,
            ],
          },
          { p: "Directeur de la publication : **Bastien LE CALVEZ**." },
        ],
      },
      {
        title: "Hébergement et nom de domaine",
        blocks: [
          {
            p: "L'application est hébergée sur un serveur privé virtuel loué auprès de **Hostinger**, qui assure également la gestion du nom de domaine finpret.app : {{HOSTINGER INTERNATIONAL LIMITED, 61 Lordou Vironos str., 6023 Larnaca, Chypre (entité à confirmer)}} — [hostinger.com](https://www.hostinger.com/fr).",
          },
          { p: "Les données de l'application (base de données et fichiers) sont stockées sur ce serveur." },
        ],
      },
      {
        title: "Propriété intellectuelle",
        blocks: [
          {
            p: "La marque Fin Prêt, l'interface, les textes, les illustrations, le moteur de génération de menus et le catalogue de recettes sont la propriété de l'éditeur ou font l'objet d'une autorisation d'utilisation. Toute reproduction ou réutilisation non autorisée, en dehors des exceptions prévues par la loi, est interdite.",
          },
          { p: "Les menus de cantine publiés par les associations de parents d'élèves restent sous la responsabilité de l'association qui les publie." },
        ],
      },
      {
        title: "Données personnelles et cookies",
        blocks: [
          { p: "Les traitements de données personnelles et l'exercice de vos droits sont décrits dans la [politique de confidentialité](/confidentialite)." },
          {
            p: "Fin Prêt n'utilise ni outil de mesure d'audience tiers ni cookie publicitaire. Les seuls cookies déposés sont nécessaires au fonctionnement du service et ne requièrent pas de consentement :",
          },
          {
            ul: [
              "le cookie de session de connexion (30 jours, renouvelé à l'usage) ;",
              "le cookie fp_asso, qui mémorise pendant 30 jours le code d'association saisi depuis une page école.",
            ],
          },
        ],
      },
      {
        title: "Contact",
        blocks: [
          { p: `Toute question relative au site peut être adressée à ${EMAIL}, via le [formulaire de contact](/contact) ou à l'adresse professionnelle indiquée ci-dessus.` },
        ],
      },
    ],
  },

  cgu: {
    version: "6 novembre 2026",
    sections: [
      {
        title: "1. Objet et éditeur",
        blocks: [
          {
            p: "Les présentes conditions générales d'utilisation (« CGU ») définissent les conditions d'accès et d'utilisation de **Fin Prêt**, application web accessible à [finpret.app](https://finpret.app) et installable sur l'écran d'accueil d'un téléphone ou d'une tablette.",
          },
          { p: `Fin Prêt est édité par ${EDITOR}, SIREN 923 927 024, ${ADDRESS}. Contact : ${EMAIL}. Les informations complètes figurent dans les [mentions légales](/mentions-legales).` },
        ],
      },
      {
        title: "2. Description du service",
        blocks: [
          { p: "Fin Prêt aide les familles à organiser les repas de la semaine. Le service permet notamment :" },
          {
            ul: [
              "de générer un menu de la semaine adapté au foyer (nombre de personnes, préférences et contraintes alimentaires, rythme, équipement), puis de le modifier ;",
              "d'obtenir une liste de courses partagée entre les membres du foyer, consultable hors connexion ;",
              "de suivre une session de préparation guidée (« batch cooking ») avec étapes et minuteurs ;",
              "de gérer un garde-manger, d'imprimer le menu de la semaine et de recevoir des rappels (dîner, décongélation) ;",
              "lorsque l'école de l'enfant est partenaire, de consulter les menus de la cantine publiés par l'association de parents d'élèves et d'être alerté quand le dîner ressemble au déjeuner.",
            ],
          },
          { p: "Le coût par portion affiché sur les recettes est **indicatif** : il est calculé à partir de prix relevés à une date donnée dans un magasin de référence, dont la provenance est détaillée en annexe des [CGV](/cgv)." },
          { h3: "Accès gratuit et offre payante" },
          {
            p: "Une partie du service est accessible gratuitement et sans limite de durée : génération du menu, liste de courses, session de préparation, découverte des recettes, 3 changements de plat par semaine et 2 comptes par foyer.",
          },
          {
            p: "L'offre payante (abonnement mensuel ou annuel, précédé d'un essai gratuit sans carte bancaire) donne accès à l'ensemble des fonctionnalités et à 8 comptes par foyer. Ses conditions figurent dans les [conditions générales de vente](/cgv).",
          },
          { h3: "Public concerné et prérequis" },
          {
            p: "Le service s'adresse aux particuliers majeurs résidant en France, pour un usage personnel et familial. Il nécessite un navigateur web récent et une adresse électronique. Certaines fonctions (rappels, maintien de l'écran allumé pendant la session) dépendent des capacités de l'appareil et des autorisations accordées.",
          },
        ],
      },
      {
        title: "3. Acceptation des CGU",
        blocks: [
          {
            p: "Les CGU sont accessibles à tout moment en bas de chaque page du site et peuvent être enregistrées ou imprimées. Elles sont acceptées, avec la politique de confidentialité, en cochant la case prévue lors de la création du compte. La date et la version acceptées sont conservées.",
          },
        ],
      },
      {
        title: "4. Compte et foyer",
        blocks: [
          { p: "**Création.** Le compte est créé avec une adresse électronique ; la connexion se fait par un lien envoyé par e-mail ou par mot de passe. Chaque compte est rattaché à un foyer." },
          {
            p: "**Foyer.** Le créateur du foyer en est l'administrateur. Il peut inviter d'autres personnes par lien (2 comptes en accès gratuit, 8 avec l'offre payante). Seul un administrateur peut souscrire ou gérer l'abonnement du foyer.",
          },
          { p: `**Exactitude et sécurité.** L'utilisateur fournit des informations exactes et protège l'accès à sa messagerie et à son mot de passe. Il signale tout accès suspect à ${EMAIL}.` },
          {
            p: "**Enfants.** Les informations concernant les enfants (prénom ou surnom, année de naissance, école, jours de cantine) sont saisies par le parent, qui reste responsable de leur exactitude. Les enfants n'ont pas de compte.",
          },
          {
            p: "**Fermeture.** L'utilisateur peut exporter ses données et supprimer son compte à tout moment depuis Réglages › Profil. S'il est le seul administrateur de son foyer, le foyer et son abonnement éventuel sont supprimés avec le compte. La suppression des données est effective dans un délai de 30 jours ; les données de facturation sont conservées selon les obligations comptables.",
          },
        ],
      },
      {
        title: "5. Usages autorisés",
        blocks: [
          { p: "L'utilisateur s'engage à utiliser le service conformément à la loi et aux présentes CGU, pour un usage personnel et non commercial. Il s'interdit notamment :" },
          {
            ul: [
              "d'accéder ou de tenter d'accéder sans autorisation aux comptes, foyers ou données d'autrui ;",
              "d'extraire de manière automatisée le catalogue de recettes ou les contenus du service ;",
              "d'introduire un logiciel malveillant ou de perturber volontairement le fonctionnement du service ;",
              "de détourner le code d'une association à des fins étrangères au partenariat.",
            ],
          },
          { p: "Des limites techniques protègent le service (par exemple, un nombre maximal de liens de connexion par heure)." },
        ],
      },
      {
        title: "6. Contenus et propriété intellectuelle",
        blocks: [
          {
            p: "L'accès au service ne transfère pas à l'utilisateur les droits de propriété intellectuelle détenus par l'éditeur ou des tiers sur l'application, ses recettes, textes et illustrations. L'utilisateur peut imprimer et conserver ses menus et listes de courses pour son usage personnel.",
          },
          {
            p: "Les données saisies par l'utilisateur (composition du foyer, articles de la liste, garde-manger, retours sur les repas) restent les siennes. Elles ne sont visibles que des membres de son foyer et ne sont utilisées que pour fournir le service.",
          },
          { p: "Les associations partenaires ne voient jamais les données d'une famille : elles n'accèdent qu'à des statistiques agrégées, masquées en dessous de 5 foyers." },
        ],
      },
      {
        title: "7. Disponibilité, assistance et responsabilité",
        blocks: [
          { p: `**Assistance.** L'assistance est assurée par e-mail à ${EMAIL} ou par le [formulaire de contact](/contact).` },
          {
            p: "**Disponibilité.** L'éditeur s'efforce d'assurer un accès continu au service, qui peut toutefois être interrompu pour maintenance, mise à jour ou incident. Les données sont sauvegardées quotidiennement.",
          },
          {
            p: "**Alimentation et santé.** Fin Prêt est un outil d'organisation, pas un service de conseil médical ou nutritionnel. Les préférences et exclusions alimentaires saisies orientent la génération des menus mais **ne garantissent pas l'absence d'allergènes** : l'utilisateur vérifie la composition des produits achetés et adapte les recettes aux besoins de son foyer, notamment en cas d'allergie, d'intolérance, de grossesse ou pour les jeunes enfants. Les conseils de conservation et de décongélation s'appliquent avec les précautions d'hygiène habituelles.",
          },
          { p: "**Menus de cantine.** Ils sont saisis et publiés par les associations sous leur responsabilité et peuvent différer des repas réellement servis." },
          { p: "**Coût indicatif.** Le coût par portion est une estimation et ne constitue pas un engagement de prix." },
          {
            p: "Chaque partie répond des manquements qui lui sont imputables dans les conditions prévues par la loi. Les présentes CGU ne suppriment ni les garanties légales ni les droits impératifs de l'utilisateur consommateur.",
          },
        ],
      },
      {
        title: "8. Suspension et fermeture par l'éditeur",
        blocks: [
          {
            p: "En cas de manquement grave aux présentes CGU (notamment accès frauduleux, atteinte à la sécurité du service ou usage commercial non autorisé), l'éditeur peut suspendre l'accès du compte concerné après en avoir informé l'utilisateur par e-mail et lui avoir permis de présenter ses observations, sauf urgence liée à la sécurité. En cas de fermeture d'un compte abonné à l'initiative de l'éditeur sans faute de l'utilisateur, la part de l'abonnement correspondant à la période non utilisée est remboursée.",
          },
          { p: "Si l'éditeur cesse d'exploiter le service, il en informe les utilisateurs au moins 30 jours à l'avance et leur permet d'exporter leurs données." },
        ],
      },
      {
        title: "9. Données personnelles",
        blocks: [
          {
            p: "Les traitements de données sont décrits dans la [politique de confidentialité](/confidentialite). L'acceptation des CGU ne vaut pas consentement aux notifications ou communications facultatives, qui se désactivent à tout moment dans les réglages ; chaque e-mail non transactionnel comporte un lien de désinscription.",
          },
        ],
      },
      {
        title: "10. Évolution des conditions",
        blocks: [
          {
            p: "L'éditeur peut faire évoluer les CGU pour tenir compte d'une évolution du service ou de la réglementation. Les utilisateurs sont informés par e-mail ou dans l'application au moins 30 jours avant l'entrée en vigueur d'une modification substantielle ; l'utilisateur qui la refuse peut supprimer son compte avant cette date. Les modifications ne portent pas atteinte aux droits acquis au titre d'un abonnement en cours.",
          },
        ],
      },
      {
        title: "11. Réclamations et litiges",
        blocks: [
          { p: `Toute réclamation peut être adressée à ${EMAIL} ou à l'adresse professionnelle de l'éditeur.` },
          { p: "Le consommateur peut recourir gratuitement à un médiateur de la consommation dans les conditions prévues à l'article 11 des [CGV](/cgv)." },
          {
            p: "Les présentes CGU sont soumises au droit français, sous réserve des dispositions impératives plus protectrices du pays de résidence du consommateur. La juridiction compétente est déterminée par les règles légales applicables.",
          },
        ],
      },
    ],
  },

  cgv: {
    version: "6 novembre 2026",
    sections: [
      {
        title: "1. Vendeur et champ d'application",
        blocks: [
          {
            p: `Le vendeur est ${EDITOR}, SIREN 923 927 024, SIRET 923 927 024 00011, inscrit au RNE depuis le 1er septembre 2023, ${ADDRESS}. E-mail : ${EMAIL}. Téléphone : ${PHONE}.`,
          },
          {
            p: "Les présentes conditions générales de vente (« CGV ») s'appliquent à la souscription de l'abonnement **Fin Prêt Famille** sur [finpret.app](https://finpret.app) par des consommateurs résidant en France. Elles complètent les [conditions générales d'utilisation](/cgu), qui régissent l'usage du service. Le client les accepte en cochant la case prévue à cet effet avant le paiement.",
          },
        ],
      },
      {
        title: "2. Offre",
        blocks: [
          { p: "L'abonnement Fin Prêt Famille donne accès, pour tous les membres d'un foyer (jusqu'à 8 comptes), à l'ensemble des fonctionnalités du service, en plus de l'accès gratuit décrit dans les CGU :" },
          {
            ul: [
              "changements de plat illimités, déplacement des repas, gestion des invités (« Qui est à table ? ») ;",
              "garde-manger avec quantités, impression du menu de la semaine ;",
              "rappels de dîner et de décongélation ;",
              "menus de la cantine de l'école et alerte quand le dîner ressemble au déjeuner, lorsque l'école est partenaire d'une association.",
            ],
          },
          {
            p: "Le service est fourni en continu, en ligne, pendant toute la durée de l'abonnement. Il nécessite un navigateur web récent et une connexion internet (la liste de courses reste consultable hors connexion). Le service peut évoluer ; ces évolutions ne réduisent pas les fonctionnalités essentielles décrites ci-dessus pendant une période d'abonnement payée.",
          },
        ],
      },
      {
        title: "3. Essai gratuit",
        blocks: [
          {
            p: "Chaque nouveau foyer bénéficie d'un **essai gratuit de 14 jours**, porté à **30 jours** pour un foyer inscrit avec le code d'une association partenaire. L'essai démarre à la création du foyer, **ne nécessite aucune carte bancaire** et ne se transforme jamais automatiquement en abonnement payant.",
          },
          {
            p: "Un rappel est envoyé 3 jours avant la fin de l'essai, puis le dernier jour. À la fin de l'essai sans souscription, le foyer passe à l'accès gratuit ; ses données sont conservées.",
          },
        ],
      },
      {
        title: "4. Prix",
        blocks: [
          {
            table: {
              head: ["Formule", "Prix", "Avec le code d'une association partenaire"],
              rows: [
                ["Mensuelle", "5,99 € par mois", "5,99 € par mois"],
                ["Annuelle", "49,99 € par an", "39,99 € la première année, puis 49,99 € par an"],
              ],
            },
          },
          { p: `Les prix sont indiqués en euros, nets de taxe : **${VAT}**. Aucun frais supplémentaire n'est facturé. Le montant total à payer est récapitulé avant la validation de la commande.` },
          {
            p: "La réduction association s'applique automatiquement, une seule fois, à la première année d'abonnement annuel d'un foyer rattaché à une association partenaire. Un code promotionnel peut être proposé ponctuellement ; ses conditions sont précisées avec l'offre concernée et il ne se cumule pas avec la réduction association.",
          },
          {
            p: "Pour chaque abonnement souscrit par un foyer rattaché, le vendeur reverse à l'association une partie du prix (8 € par abonnement annuel, 0,50 € par mois d'abonnement mensuel), sans surcoût pour le client.",
          },
          {
            p: "Le vendeur peut modifier ses prix pour l'avenir. Un changement de prix ne s'applique pas à la période en cours et est notifié au client au moins 30 jours avant la prochaine échéance ; le client peut résilier avant cette date.",
          },
        ],
      },
      {
        title: "5. Commande",
        blocks: [
          { p: "La souscription est réservée à l'administrateur du foyer, depuis Réglages › Abonnement :" },
          {
            ol: [
              "choix de la formule (mensuelle ou annuelle) ;",
              "redirection vers la page de paiement sécurisée de notre prestataire Stripe, qui récapitule la formule, le prix total et la périodicité ;",
              "saisie ou vérification de l'adresse de facturation et du moyen de paiement ;",
              "acceptation des CGV et demande d'exécution immédiate (case à cocher, voir article 8) ;",
              "validation avec obligation de paiement.",
            ],
          },
          {
            p: "Le contrat est conclu à la validation du paiement. Une confirmation de commande et la facture sont envoyées par e-mail. Les factures restent accessibles depuis Réglages › Abonnement. La version des CGV applicable est celle acceptée lors de la commande.",
          },
        ],
      },
      {
        title: "6. Paiement",
        blocks: [
          {
            p: "Le paiement s'effectue par carte bancaire ou par les autres moyens proposés sur la page de paiement, par l'intermédiaire de **Stripe Payments Europe Ltd.** (Dublin, Irlande). Le vendeur n'a jamais accès aux numéros de carte.",
          },
          { p: "Le prix est débité à la souscription, puis automatiquement au début de chaque nouvelle période (chaque mois ou chaque année) tant que l'abonnement n'est pas résilié." },
          {
            p: "En cas d'échec de paiement, le client est prévenu par e-mail et de nouvelles tentatives sont effectuées pendant 7 jours. Faute de régularisation, l'abonnement prend fin et le foyer repasse à l'accès gratuit, sans perte de données. Aucune pénalité ni frais de retard n'est appliqué.",
          },
        ],
      },
      {
        title: "7. Durée, changement de formule et résiliation",
        blocks: [
          {
            p: "L'abonnement est **sans engagement au-delà de la période payée** : un mois pour la formule mensuelle, un an pour la formule annuelle. Il se renouvelle automatiquement pour une période identique, au prix en vigueur, sauf résiliation.",
          },
          {
            p: "Pour la formule annuelle, le client est informé par e-mail, au plus tôt trois mois et au plus tard un mois avant le renouvellement, de la date de reconduction et de sa faculté de ne pas reconduire l'abonnement (article L215-1 du Code de la consommation).",
          },
          {
            p: `**Résiliation.** Le client peut résilier à tout moment, en quelques clics, depuis Réglages › Abonnement, sans avoir à se justifier. La résiliation prend effet à la fin de la période déjà payée : l'accès complet reste ouvert jusqu'à cette date, puis le foyer repasse à l'accès gratuit, données conservées. Le client peut aussi résilier par e-mail à ${EMAIL}.`,
          },
          { p: "**Changement de formule.** Le passage du mensuel à l'annuel (ou l'inverse) est possible à tout moment ; la différence est calculée au prorata du temps restant." },
          { p: "**Suppression du compte.** Si l'administrateur unique d'un foyer abonné supprime son compte, l'abonnement est résilié avec la suppression du foyer." },
        ],
      },
      {
        title: "8. Droit de rétractation",
        blocks: [
          {
            p: `Le client consommateur dispose d'un délai de **14 jours** à compter de la souscription pour se rétracter, sans avoir à motiver sa décision. Il notifie sa décision par une déclaration dénuée d'ambiguïté envoyée à ${EMAIL} ou par courrier à l'adresse du vendeur, ou au moyen du formulaire ci-dessous. Un accusé de réception lui est adressé par e-mail.`,
          },
          { h3: "Exécution immédiate" },
          {
            p: "Le service étant accessible dès la souscription, le client demande expressément, en cochant la case prévue avant le paiement, que l'abonnement commence avant la fin du délai de rétractation. Conformément à l'article L221-25 du Code de la consommation, s'il se rétracte ensuite, il paie un montant **proportionnel à la période écoulée** jusqu'à la communication de sa décision ; le reste lui est remboursé. Le client ne perd pas son droit de rétractation du fait de cette exécution immédiate.",
          },
          { h3: "Remboursement" },
          {
            p: "Le remboursement intervient au plus tard 14 jours après la réception de la décision de rétractation, par le moyen de paiement utilisé pour la souscription, sans frais. Le foyer repasse alors à l'accès gratuit, données conservées.",
          },
          {
            box: {
              title: "Formulaire de rétractation",
              blocks: [
                { p: `À l'attention de Bastien LE CALVEZ — EI (Fin Prêt), ${ADDRESS} — ${EMAIL} :` },
                { p: "Je vous notifie par la présente ma rétractation du contrat portant sur l'abonnement Fin Prêt Famille ci-dessous :" },
                {
                  ul: [
                    "Formule (mensuelle ou annuelle) :",
                    "Souscrite le :",
                    "Adresse e-mail du compte :",
                    "Nom du consommateur :",
                    "Adresse du consommateur :",
                    "Date :",
                    "Signature du consommateur (uniquement en cas d'envoi sur papier) :",
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        title: "9. Garanties légales",
        blocks: [
          {
            p: `Le vendeur est tenu de la garantie légale de conformité des contenus et services numériques (articles L224-25-1 et suivants du Code de la consommation) et de la garantie des vices cachés (articles 1641 et suivants du Code civil). Le client adresse sa demande à ${EMAIL} ou à l'adresse du vendeur.`,
          },
          {
            box: {
              title: "Garantie légale de conformité — service numérique fourni de manière continue",
              blocks: [
                {
                  p: "Le consommateur dispose d'un délai correspondant à la durée de fourniture du service numérique pour obtenir la mise en œuvre de la garantie légale de conformité en cas d'apparition d'un défaut de conformité. Durant cette période, le consommateur n'est tenu d'établir que l'existence du défaut de conformité et non la date d'apparition de celui-ci.",
                },
                { p: "La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien de la conformité du service numérique durant toute la durée de sa fourniture." },
                { p: "La garantie légale de conformité donne au consommateur droit à la mise en conformité du service numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui." },
                {
                  p: "Le consommateur peut obtenir une réduction du prix en conservant le service numérique, ou il peut mettre fin au contrat en se faisant rembourser intégralement contre renoncement au service numérique, si :",
                },
                {
                  ol: [
                    "le professionnel refuse de mettre le service numérique en conformité ;",
                    "la mise en conformité du service numérique est retardée de manière injustifiée ;",
                    "la mise en conformité du service numérique ne peut intervenir sans frais imposés au consommateur ;",
                    "la mise en conformité du service numérique occasionne un inconvénient majeur pour le consommateur ;",
                    "la non-conformité du service numérique persiste en dépit de la tentative de mise en conformité du professionnel restée infructueuse.",
                  ],
                },
                {
                  p: "Le consommateur a également droit à une réduction du prix ou à la résolution du contrat lorsque le défaut de conformité est si grave qu'il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n'est alors pas tenu de demander la mise en conformité du service numérique au préalable.",
                },
                { p: "Dans les cas où le défaut de conformité est mineur, le consommateur n'a droit à l'annulation du contrat que si le contrat ne prévoit pas le paiement d'un prix." },
                {
                  p: "Toute période d'indisponibilité du service numérique en vue de sa remise en conformité suspend la garantie qui restait à courir jusqu'à la fourniture du service numérique de nouveau conforme.",
                },
                { p: "Ces droits résultent de l'application des articles L. 224-25-1 à L. 224-25-31 du code de la consommation." },
                {
                  p: "Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d'un montant maximal de 300 000 euros, qui peut être porté jusqu'à 10 % du chiffre d'affaires moyen annuel (article L. 242-18-1 du code de la consommation).",
                },
                {
                  p: "Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le service numérique est conservé ou à un remboursement intégral contre renonciation au service numérique.",
                },
              ],
            },
          },
          { p: "Aucune garantie commerciale n'est proposée en plus des garanties légales." },
        ],
      },
      {
        title: "10. Responsabilité",
        blocks: [
          {
            p: "Chaque partie répond de ses obligations dans les conditions prévues par la loi. Le coût par portion affiché sur les recettes est indicatif et ne constitue pas un engagement de prix (voir l'annexe). Les précautions relatives aux allergènes figurent à l'article 7 des [CGU](/cgu). Aucune disposition des présentes CGV ne limite les droits impératifs du consommateur.",
          },
        ],
      },
      {
        title: "11. Réclamations et médiation",
        blocks: [
          { p: `Le client peut adresser une réclamation écrite à ${EMAIL} ou à l'adresse du vendeur.` },
          {
            p: "Après une réclamation écrite préalable restée sans réponse satisfaisante, et dans un délai d'un an à compter de celle-ci, le consommateur peut recourir gratuitement au médiateur de la consommation : {{nom, adresse et site de saisine du médiateur à confirmer}}.",
          },
        ],
      },
      {
        title: "12. Données personnelles et droit applicable",
        blocks: [
          {
            p: "Les données nécessaires à la souscription (e-mail, adresse de facturation, historique des paiements) sont traitées par le vendeur et par Stripe comme décrit dans la [politique de confidentialité](/confidentialite). Les données de facturation sont conservées 10 ans, durée imposée par les obligations comptables.",
          },
          {
            p: "Les présentes CGV sont soumises au droit français, sous réserve des protections impératives dont bénéficie le consommateur dans son pays de résidence. La compétence des tribunaux résulte des règles légales applicables ; aucune compétence exclusive n'est imposée au consommateur.",
          },
        ],
      },
    ],
  },
} satisfies Record<string, LegalDoc>;

export type LegalDocSlug = keyof typeof legalDocs;

/** Vrai si le document contient encore une information à confirmer (`{{…}}`). */
export function hasPending(doc: LegalDoc): boolean {
  return JSON.stringify(doc).includes("{{");
}
