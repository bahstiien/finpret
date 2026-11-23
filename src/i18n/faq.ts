import type { Faq } from "@/seo/menus";
import { landingV2 } from "./landing";

/**
 * Page /faq : questions fréquentes sur le fonctionnement du menu, tirées des fiches de règles métier
 * (docs/okf/regles, branche okf-export) et du moteur (src/engine). Si une règle du moteur change, mettre à jour ici.
 */
export const faqFr = {
  metaTitle: "Questions fréquentes : comment Fin Prêt compose ta semaine",
  metaDescription:
    "Comment le menu est composé, saisons, conservation des plats, portions des enfants, liste de courses, restes et budget : toutes les réponses sur Fin Prêt.",
  title: "Questions fréquentes",
  lead: "Comment Fin Prêt choisit tes repas, calcule les portions et prépare ta liste de courses. Une question sans réponse ici ? Écris-nous depuis la page contact.",
  contact: "Nous écrire",
  toc: "Sommaire",
  sections: [
    { id: "essentiel", title: "L'essentiel", items: landingV2.faq.items },
    {
      id: "menu",
      title: "Le menu de la semaine",
      items: [
        {
          q: "Comment le menu de la semaine est-il construit ?",
          a: "Chaque plat cuisiné pendant la session sert un dîner et le déjeuner du lendemain. Certains soirs sont des soirs légers : une soupe servie deux soirs, ou un soir simple cuisiné le jour même. Si tu as un congélateur, quelques repas viennent de ta réserve, plutôt en fin de semaine. Les repas que tu décoches ne sont pas prévus.",
        },
        {
          q: "C'est quoi, un soir léger ?",
          a: "Un dîner rapide qui ne demande rien pendant la session. Le réglage « Soirs légers » fixe leur nombre (2 par défaut). Les 2 premiers sont une même soupe, préparée pendant la session et servie deux soirs ; les suivants sont des soirs simples cuisinés le jour même.",
        },
        {
          q: "Comment le menu reste-t-il varié ?",
          a: "Jamais deux plats de la même famille dans la semaine (deux currys, deux lasagnes…). Le nombre de plats par protéine est plafonné : par défaut 2 volaille, 1 bœuf, 1 porc, 1 poisson et 2 végétariens. Le four est limité à 2 plats par session pour qu'elle reste faisable. Tu peux changer tous ces réglages.",
        },
        {
          q: "Combien de plats de pâtes dans la semaine ?",
          a: "Tu choisis le minimum (1 ou 2) ; il n'y en a jamais plus de 3. Et jamais deux repas de pâtes le même jour : si tu en déplaces un, l'application te prévient.",
        },
        {
          q: "Y a-t-il toujours un plat végétarien ?",
          a: "Oui, au moins un dès que la semaine compte 4 plats. Tu peux en demander plus avec le réglage « Repas végétariens minimum par semaine ». Pour un foyer végétarien ou pescétarien, il n'y a pas de plafond.",
        },
        {
          q: "Et les plats réconfort, les recettes du monde ?",
          a: "Tu règles le nombre de plats réconfort (jamais, 1 toutes les 2 semaines, 1 ou 2 par semaine) et un minimum de recettes du monde (2 par défaut). Si les autres réglages ne laissent pas de place, l'objectif de recettes du monde est abandonné pour la semaine.",
        },
        {
          q: "Les mêmes recettes reviennent-elles souvent ?",
          a: "Non. Une recette ne revient pas avant la fin de ta « Période sans répétition » (3 semaines par défaut, de 2 à 6). Seule exception : une recette notée « à refaire » ou « aimé des enfants » peut revenir plus tôt, mais jamais deux semaines de suite.",
        },
        {
          q: "À quoi servent les avis sur les plats ?",
          a: "« À refaire » et « aimé des enfants » font revenir un plat plus souvent. « Trop long » le fait revenir moins souvent, sans l'exclure. « Ne plus proposer » le retire de tes menus.",
        },
        {
          q: "Et si aucun menu ne respecte tous mes réglages ?",
          a: "L'application assouplit les règles une à une : d'abord le minimum de pâtes, puis la période sans répétition, puis les recettes du monde. En tout dernier recours, elle peut reprendre un plat que tu as écarté, et elle te le signale. Si rien ne marche, elle te propose de modifier tes réglages.",
        },
      ],
    },
    {
      id: "saisons",
      title: "Saisons et conservation",
      items: [
        {
          q: "Les recettes suivent-elles les saisons ?",
          a: "Oui. Une recette de saison n'est proposée que les mois où ses légumes sont de saison. Certaines recettes changent de légumes selon la saison. Exception anti-gaspi : si tous ses légumes sont déjà dans ton garde-manger, la recette peut revenir hors saison.",
        },
        {
          q: "Les plats tiennent-ils jusqu'en fin de semaine ?",
          a: "Chaque recette a une durée de conservation au frigo. Les plats qui ne se congèlent pas sont servis en début de semaine, dans cette limite. Ceux qui se congèlent sont placés en fin de semaine et passent par le congélateur.",
        },
        {
          q: "Comment marche la réserve du congélateur ?",
          a: "Double un plat du menu : les portions en plus vont dans ta réserve. Les semaines suivantes, le réglage « Repas tirés du congélateur » (2 par défaut) en place quelques-unes, en commençant par les plus anciennes, plutôt le jeudi et le vendredi. Sans congélateur, ce réglage est à 0.",
        },
      ],
    },
    {
      id: "portions",
      title: "Portions, courses et budget",
      items: [
        {
          q: "Comment les portions sont-elles calculées ?",
          a: "Un adulte compte pour 1 portion. Un enfant compte selon son âge : 0,33 avant 3 ans, 0,5 de 3 à 6 ans, 0,75 de 7 à 11 ans, 1 à partir de 12 ans (0,5 sans date de naissance). Tu peux modifier la portion de chacun. Seules les personnes présentes à un repas comptent : cantine le midi, garde alternée en semaine A ou B.",
        },
        {
          q: "Et si on a des invités un soir ?",
          a: "Ouvre le repas dans ton menu et choisis « Qui est à table ? » pour changer le nombre d'adultes et d'enfants. Les quantités et la liste de courses suivent.",
        },
        {
          q: "Pourquoi les quantités sont-elles arrondies ?",
          a: "Pour coller à ce que tu achètes. Quand une quantité tombe près d'un format du commerce (une brique, un paquet), elle est arrondie à ce format, à 20 % près au plus. Une conserve compte toujours au moins une boîte. Sur la liste, tu achètes le plus petit nombre de paquets qui couvre le besoin.",
        },
        {
          q: "Pourquoi l'huile, le sel ou les épices ne sont-ils pas sur la liste ?",
          a: "Ce sont des produits du placard que tu as en général déjà. Ils ne sont pas ajoutés à la liste de courses par défaut. Ce que tu as déjà au garde-manger est aussi déduit de la liste.",
        },
        {
          q: "Que deviennent les restes ?",
          a: "Après la session, ce qui reste des paquets entamés est rangé dans ton garde-manger (au-delà d'un petit seuil, environ 30 g). Le menu suivant choisit en priorité des recettes qui les utilisent, pour ne rien jeter.",
        },
        {
          q: "Le budget est-il respecté ?",
          a: "Avec « Menus économiques », les plats les moins chers passent en priorité, et un menu qui dépasse ton budget est écarté. Si aucun menu ne tient dedans, tu reçois le moins cher trouvé, signalé comme tel. Les prix sont des prix de référence en supermarché : ton ticket de caisse peut varier.",
        },
      ],
    },
  ] satisfies { id: string; title: string; items: readonly Faq[] }[],
} as const;
