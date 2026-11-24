/** Matériel d'une recette : modes de cuisson du catalogue, puis ustensiles nommés dans ses étapes. */

export const MODE_LABEL: Record<string, string> = {
  feu: "plaques de cuisson",
  four: "four",
  airfryer: "airfryer",
  micro: "micro-ondes",
  blender: "blender chauffant",
  mixeur: "mixeur plongeant",
  robot: "robot de cuisine",
  plan: "plan de travail",
};
export const MODE_ORDER = ["feu", "four", "airfryer", "micro", "blender", "mixeur", "robot"];

// shortcut: mots-clés dans le texte des étapes ; à remplacer par un champ `tools` du catalogue s'il apparaît.
const TOOLS: [RegExp, string][] = [
  [/\bfour\b|au four/, "four"],
  [/air ?fryer/, "airfryer"],
  [/micro-ondes/, "micro-ondes"],
  [/\bpo[êe]le/, "poêle"],
  [/\bcasserole/, "casserole"],
  [/\bsauteuse/, "sauteuse"],
  [/\bcocotte/, "cocotte"],
  [/\bwok\b/, "wok"],
  [/\b(un|le|du|au) moule\b/, "moule"],
  [/plat à gratin|plat allant au four/, "plat à gratin"],
  [/\bsaladier/, "saladier"],
  [/\bfouet/, "fouet"],
  [/\br[âa]pe\b/, "râpe"],
  // Pas de \b devant une lettre accentuée : en JS, \b ne connaît que [A-Za-z0-9_].
  [/égoutt|\bpassoire/, "passoire"],
  [/papier cuisson/, "papier cuisson"],
  [/\bmixe|\bmixeur/, "mixeur plongeant"],
];

export function equipmentOf(modes: string[], texts: string[]): string[] {
  const out = MODE_ORDER.filter((m) => modes.includes(m)).map((m) => MODE_LABEL[m]!);
  const text = texts.join(" ").toLowerCase();
  for (const [re, label] of TOOLS) if (re.test(text) && !out.includes(label)) out.push(label);
  return out;
}
