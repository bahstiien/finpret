import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { GettingStartedEmail } from "@/emails/templates";
import { MESSAGE_KEYS } from "@/engine/getting-started-messages";
import { type MessageVars, messagesFr } from "@/i18n/getting-started-messages";

const VARS: MessageVars = {
  name: "Camille",
  meals: 10,
  sessionDay: "dimanche",
  sessionTime: "14:00",
  articles: 42,
  duration: "3 h 30",
  end: "17:30",
  boxes: 12,
  fridge: 8,
  freezer: 4,
};
const FORBIDDEN = [/pas encore/i, /n['’]as pas/i, /aurais dû/i, /en retard/i, /oublié/i, /undefined|NaN/];

describe("séquence de prise en main : gabarits et textes", () => {
  it.each(MESSAGE_KEYS)("%s : rendu complet avec bouton, lien de désinscription et sans texte vide", async (key) => {
    const copy = messagesFr[key];
    const element = createElement(GettingStartedEmail, {
      title: copy.subject,
      paragraphs: copy.paragraphs(VARS),
      cta: copy.cta,
      url: `https://finpret.app${copy.url}`,
      secondary: copy.secondary && { label: copy.secondary.label, url: `https://finpret.app${copy.secondary.url}` },
      unsubscribeUrl: "https://finpret.app/api/unsubscribe?u=1&t=2",
    });
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
    expect(html).toContain(copy.cta);
    expect(html).toContain(`https://finpret.app${copy.url}`);
    expect(html).toContain("/api/unsubscribe");
    expect(html).toContain('lang="fr"');
    expect(text.length).toBeGreaterThan(40);
    for (const re of FORBIDDEN) expect(`${html}\n${text}`).not.toMatch(re);
  });

  it.each(MESSAGE_KEYS)("%s : objet court, bouton et push présents, tutoiement, jamais de reproche", (key) => {
    const copy = messagesFr[key];
    expect(copy.subject.length).toBeLessThanOrEqual(50);
    expect(copy.cta.length).toBeGreaterThan(0);
    expect(copy.url.startsWith("/")).toBe(true);
    const texts = [copy.subject, ...copy.paragraphs(VARS), copy.push.title, copy.push.body(VARS)];
    expect(copy.push.title.length).toBeLessThanOrEqual(40);
    expect(copy.push.body(VARS).length).toBeLessThanOrEqual(90);
    for (const t of texts) for (const re of FORBIDDEN) expect(t).not.toMatch(re);
    // Tutoiement, sauf « vous cochez chacun de votre côté » (la personne et celle qui fait les courses avec elle).
    if (key !== "shopping_eve") expect(texts.join(" ")).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
  });

  it("le message « pas de session » propose de décaler ou d'alléger, sans reproche", () => {
    const copy = messagesFr.session_late;
    expect(copy.paragraphs(VARS).join(" ")).toMatch(/autre jour|alléger/);
    expect(copy.secondary?.url).toBe("/settings/menu");
  });

  it("les variables manquantes ne cassent pas les phrases (foyer sans prénom)", () => {
    for (const key of MESSAGE_KEYS) {
      const text = messagesFr[key].paragraphs({ ...VARS, name: "" }).join(" ");
      expect(text).not.toMatch(/undefined|NaN|\s,/);
    }
  });
});
