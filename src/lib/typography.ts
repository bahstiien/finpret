const NBSP = " ";

const UNITS =
  "g|kg|ml|l|min|h|°C|%|repas|recettes?|cuisines?|parts?|portions?|minutes?|secondes?|personnes?|foyers?|comptes?";

/**
 * Typographie française (charte, section 5) : espace insécable avant « : ; ! ? » et dans
 * les guillemets, entre un nombre et son unité, et dans « 2 h 30 ».
 */
export function nb(text: string): string {
  return text
    .replace(/ +([:;!?»])/g, `${NBSP}$1`)
    .replace(/« +/g, `«${NBSP}`)
    .replace(/(\d) +h +(\d)/g, `$1${NBSP}h${NBSP}$2`)
    .replace(new RegExp(`(\\d) +(?=(?:${UNITS})(?!\\p{L}))`, "gu"), `$1${NBSP}`);
}
