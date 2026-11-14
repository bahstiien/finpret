import { describe, expect, it } from "vitest";
import { type MessageInput, planMessage } from "./getting-started-messages";

// Calendrier de référence (Europe/Paris, hiver : UTC+1) : inscription le lundi 4 janvier 2027 ;
// jour de courses samedi (6), session dimanche (0).
const base: MessageInput = {
  now: new Date("2027-01-04T12:00:00Z"),
  tz: "Europe/Paris",
  isCreator: true,
  signupAt: "2027-01-04T09:00:00Z",
  sessionDay: 0,
  shoppingDay: 6,
  hasWeek: true,
  steps: { shop: false, startSession: false },
  sessionDoneAt: null,
  secondWeekGenerated: false,
  dismissed: false,
  channels: { email: true, push: false },
  sent: {},
};
const at = (iso: string, o: Partial<MessageInput> = {}) => planMessage({ ...base, now: new Date(iso), ...o });

describe("séquence de messages de la prise en main", () => {
  it("J0 : bienvenue au compte créateur, pas aux autres comptes", () => {
    expect(at("2027-01-04T10:00:00Z").send).toBe("welcome");
    expect(at("2027-01-04T10:00:00Z", { isCreator: false }).send).toBeNull();
  });

  it("la bienvenue se rattrape le lendemain, pas au-delà", () => {
    expect(at("2027-01-05T10:00:00Z").send).toBe("welcome");
    expect(at("2027-01-06T10:00:00Z").send).toBeNull();
  });

  it("veille du jour de courses : « Ta liste est prête » à partir de 18 h locales", () => {
    // Vendredi 8 janvier, la veille du samedi.
    expect(at("2027-01-08T16:00:00Z", { sent: { welcome: "2027-01-04" } }).send).toBeNull(); // 17 h locales
    expect(at("2027-01-08T17:30:00Z", { sent: { welcome: "2027-01-04" } }).send).toBe("shopping_eve"); // 18 h 30
  });

  it("veille de la session : préparation, avec la priorité sur les courses quand elles tombent le même jour", () => {
    // Courses le dimanche et session le dimanche : les deux veilles sont le samedi.
    const both = { shoppingDay: 7, sent: { welcome: "2027-01-04" } };
    const plan = at("2027-01-09T17:30:00Z", both);
    expect(plan.eligible).toEqual(expect.arrayContaining(["session_eve", "shopping_eve"]));
    expect(plan.send).toBe("session_eve");
  });

  it("une veille n'est jamais reportée au lendemain (le texte « demain » serait faux)", () => {
    const sent = { welcome: "2027-01-04", session_eve: "2027-01-09" };
    const next = at("2027-01-10T17:30:00Z", { shoppingDay: 7, sent });
    expect(next.eligible).not.toContain("shopping_eve");
  });

  it("au plus un message par jour et par compte", () => {
    const plan = at("2027-01-09T17:30:00Z", { shoppingDay: 7, sent: { welcome: "2027-01-09" } });
    expect(plan.send).toBeNull();
    expect(plan.reason).toBe("one_per_day");
  });

  describe("un message n'est pas envoyé si son étape est faite", () => {
    const sent = { welcome: "2027-01-04" };
    it("shopping_eve : courses déjà cochées", () => {
      expect(at("2027-01-08T17:30:00Z", { sent, steps: { shop: true, startSession: false } }).send).toBeNull();
    });
    it("session_eve : session déjà lancée", () => {
      const plan = at("2027-01-09T17:30:00Z", { sent, steps: { shop: true, startSession: true } });
      expect(plan.eligible).not.toContain("session_eve");
    });
    it("session_late : session lancée entre-temps", () => {
      const plan = at("2027-01-13T10:00:00Z", { sent, steps: { shop: true, startSession: true } });
      expect(plan.eligible).not.toContain("session_late");
    });
    it("week2 : 2e semaine déjà générée", () => {
      const plan = at("2027-01-15T10:00:00Z", {
        sent,
        sessionDoneAt: "2027-01-10T15:00:00Z",
        secondWeekGenerated: true,
      });
      expect(plan.eligible).not.toContain("week2");
    });
  });

  it("pas de session : proposition de décaler 3 jours après la date prévue, sans reproche", () => {
    // Session prévue dimanche 10 janvier, jamais lancée ; mercredi 13 janvier à 10 h locales.
    const sent = { welcome: "2027-01-04", shopping_eve: "2027-01-08" };
    expect(at("2027-01-12T09:30:00Z", { sent }).send).toBeNull(); // mardi : trop tôt
    expect(at("2027-01-13T08:00:00Z", { sent }).send).toBeNull(); // mercredi 9 h : avant l'heure d'envoi
    expect(at("2027-01-13T09:30:00Z", { sent }).send).toBe("session_late");
    expect(at("2027-01-13T09:30:00Z", { sent: { ...sent, session_late: "2027-01-13" } }).send).toBeNull();
    // Reporté d'un jour si un autre message est passé avant, abandonné ensuite.
    expect(at("2027-01-14T09:30:00Z", { sent: { ...sent, session_eve: "2027-01-14" } }).send).toBeNull();
    expect(at("2027-01-14T09:30:00Z", { sent }).send).toBe("session_late");
    expect(at("2027-01-15T09:30:00Z", { sent }).send).toBeNull();
  });

  it("session_late n'est jamais envoyé avant J+3", () => {
    const sent = { welcome: "2027-01-04" };
    expect(at("2027-01-12T10:00:00Z", { sent }).eligible).not.toContain("session_late");
  });

  it("lendemain de la session : bravo ; J+5 : semaine 2", () => {
    const sent = { welcome: "2027-01-04", shopping_eve: "2027-01-08", session_eve: "2027-01-09" };
    const done = { sessionDoneAt: "2027-01-10T15:00:00Z", steps: { shop: true, startSession: true } };
    expect(at("2027-01-11T09:30:00Z", { sent, ...done }).send).toBe("session_after");
    expect(at("2027-01-15T09:30:00Z", { sent: { ...sent, session_after: "2027-01-11" }, ...done }).send).toBe("week2");
  });

  it("un message perdant la priorité est reporté d'un jour s'il l'autorise, puis abandonné", () => {
    const sent = { welcome: "2027-01-04", shopping_eve: "2027-01-08", session_eve: "2027-01-09" };
    const done = { sessionDoneAt: "2027-01-10T15:00:00Z", steps: { shop: true, startSession: true } };
    // J+5 tombe un vendredi 15 : un autre message est parti ce jour-là, week2 part le samedi 16 à 10 h.
    const day16 = at("2027-01-16T09:30:00Z", { sent: { ...sent, session_after: "2027-01-15" }, ...done });
    expect(day16.send).toBe("week2");
    // Au-delà d'un jour de retard : abandonné.
    const day17 = at("2027-01-17T09:30:00Z", { sent: { ...sent, session_after: "2027-01-15" }, ...done });
    expect(day17.send).toBeNull();
  });

  it("idempotence : un message déjà envoyé ne part plus, un second passage ne change rien", () => {
    const first = at("2027-01-04T10:00:00Z");
    expect(first.send).toBe("welcome");
    const again = at("2027-01-04T10:15:00Z", { sent: { welcome: "2027-01-04" } });
    expect(again.send).toBeNull();
  });

  describe("fuseau du foyer", () => {
    // Le samedi 9 janvier à 18 h 30 à Paris est le samedi 9 à 07 h 30 à Auckland (UTC+13) : veille de dimanche des deux côtés
    // seulement à des instants différents.
    const instant = "2027-01-09T17:30:00Z";
    it("Europe/Paris : 18 h 30 la veille de dimanche", () => {
      expect(at(instant, { sent: { welcome: "2027-01-04" } }).send).toBe("session_eve");
    });
    it("Pacific/Auckland : à ce même instant, c'est dimanche 06 h 30, plus la veille", () => {
      const plan = at(instant, { tz: "Pacific/Auckland", sent: { welcome: "2027-01-04" } });
      expect(plan.eligible).not.toContain("session_eve");
    });
  });

  it("aucun canal : aucun envoi (désinscrit et sans Web Push)", () => {
    const plan = at("2027-01-04T10:00:00Z", { channels: { email: false, push: false } });
    expect(plan).toMatchObject({ send: null, reason: "no_channel" });
    // Un appareil autorisé suffit : le Web Push n'est pas un e-mail.
    expect(at("2027-01-04T10:00:00Z", { channels: { email: false, push: true } }).send).toBe("welcome");
  });

  it("checklist masquée : coupe shopping_eve, session_late et week2, pas session_eve ni session_after", () => {
    const sent = { welcome: "2027-01-04" };
    expect(at("2027-01-08T17:30:00Z", { sent, dismissed: true }).eligible).not.toContain("shopping_eve");
    expect(at("2027-01-13T09:30:00Z", { sent, dismissed: true }).eligible).not.toContain("session_late");
    expect(at("2027-01-13T09:30:00Z", { sent }).eligible).toContain("session_late");
    expect(at("2027-01-09T17:30:00Z", { sent, dismissed: true }).send).toBe("session_eve");
    const done = { sessionDoneAt: "2027-01-10T15:00:00Z", steps: { shop: true, startSession: true } };
    expect(at("2027-01-11T09:30:00Z", { sent, dismissed: true, ...done }).send).toBe("session_after");
    expect(at("2027-01-15T09:30:00Z", { sent: { ...sent, session_after: "2027-01-11" }, dismissed: true, ...done }).send).toBeNull();
  });

  it("fenêtre J0 à J14, prolongée pour les messages rattachés à la session", () => {
    const sent = { welcome: "2027-01-04" };
    // J+16 : plus rien, même si la session n'a jamais eu lieu.
    expect(at("2027-01-20T08:00:00Z", { sent }).send).toBeNull();
    // Session terminée tard (J+13) : session_after et week2 partent malgré J+14 dépassé.
    const done = { sessionDoneAt: "2027-01-17T15:00:00Z", steps: { shop: true, startSession: true } };
    expect(at("2027-01-18T09:30:00Z", { sent, ...done }).send).toBe("session_after");
    expect(at("2027-01-22T09:30:00Z", { sent: { ...sent, session_after: "2027-01-18" }, ...done }).send).toBe("week2");
  });

  it("sans semaine préparée : ni courses ni préparation de session", () => {
    const sent = { welcome: "2027-01-04" };
    expect(at("2027-01-08T17:30:00Z", { sent, hasWeek: false }).send).toBeNull();
    expect(at("2027-01-09T17:30:00Z", { sent, hasWeek: false }).send).toBeNull();
  });

  it("foyer qui saute la première session : session_late une seule fois, puis plus rien", () => {
    const sent = { welcome: "2027-01-04", shopping_eve: "2027-01-08", session_eve: "2027-01-09" };
    const first = at("2027-01-13T09:30:00Z", { sent });
    expect(first.send).toBe("session_late");
    const second = at("2027-01-13T09:45:00Z", { sent: { ...sent, session_late: "2027-01-13" } });
    expect(second.send).toBeNull();
  });
});
