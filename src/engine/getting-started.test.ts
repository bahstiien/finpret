import { describe, expect, it } from "vitest";
import {
  type ChecklistInput,
  computeChecklist,
  type EventRow,
  newlyDone,
  type StepKey,
  tipFor,
  withSolo,
} from "./getting-started";

const H = "h1";
const NOW = new Date("2027-01-12T10:00:00Z");
const ev = (name: string, userId = "u1", householdId = H, at = "2027-01-11T10:00:00Z"): EventRow => ({
  name,
  householdId,
  userId,
  at,
});
const input = (o: Partial<ChecklistInput> = {}): ChecklistInput => ({
  now: NOW,
  householdId: H,
  createdAt: "2027-01-10T10:00:00Z",
  events: [],
  accountCount: 1,
  saved: {},
  dismissedAt: null,
  completedAt: null,
  ...o,
});
const done = (o: Partial<ChecklistInput>) => {
  const s = computeChecklist(input(o));
  return (Object.keys(s.steps) as StepKey[]).filter((k) => s.steps[k].done);
};

describe("checklist « Ta première semaine »", () => {
  it("a. découvrir ton menu : cochée dès l'arrivée, « 1 sur 6 »", () => {
    const s = computeChecklist(input());
    expect(done({})).toEqual(["discover_menu"]);
    expect(s.doneCount).toBe(1);
    expect(s.total).toBe(6);
    expect(s.mode).toBe("card");
    expect(s.next).toBe("adjust_meal");
  });

  it.each(["menu_swap", "menu_move", "menu_removed"])("b. ajuster un repas : cochée par %s", (name) => {
    expect(done({ events: [ev(name)] })).toContain("adjust_meal");
  });

  it("c. inviter : cochée par une invitation envoyée", () => {
    expect(done({ events: [ev("invitation_sent")] })).toContain("invite");
  });
  it("c. inviter : cochée par un 2e compte dans le foyer", () => {
    expect(done({ accountCount: 2 })).toContain("invite");
  });
  it("c. inviter : validée par « Je cuisine seul·e », sans invitation", () => {
    const saved = withSolo({}, "u1", NOW);
    const s = computeChecklist(input({ saved }));
    expect(s.steps.invite).toMatchObject({ done: true, via: "solo", by: "u1" });
  });
  it("c. inviter : reste cochée si le 2e compte part", () => {
    const first = computeChecklist(input({ accountCount: 2 }));
    const saved = { invite: { done_at: first.steps.invite.doneAt!, by: null, via: "event" as const } };
    expect(computeChecklist(input({ saved, accountCount: 1 })).steps.invite.done).toBe(true);
  });
  it("c. « Je cuisine seul·e » ne remplace pas une étape déjà cochée", () => {
    const saved = { invite: { done_at: "2027-01-11T00:00:00Z", by: "u2", via: "event" as const } };
    expect(withSolo(saved, "u1", NOW).invite?.via).toBe("event");
  });

  it("d. cocher tes courses : shopping_checked", () => {
    expect(done({ events: [ev("shopping_checked")] })).toContain("shop");
  });
  it("e. lancer ta session : session_started", () => {
    expect(done({ events: [ev("session_started")] })).toContain("start_session");
  });
  it("f. terminer ta session : session_done", () => {
    expect(done({ events: [ev("session_done")] })).toContain("finish_session");
  });

  it("une coche par un autre membre du foyer coche l'étape pour tous", () => {
    const s = computeChecklist(input({ events: [ev("shopping_checked", "u2")] }));
    expect(s.steps.shop).toMatchObject({ done: true, by: "u2" });
  });
  it("les événements d'un autre foyer sont ignorés", () => {
    expect(done({ events: [ev("shopping_checked", "u9", "autre")] })).not.toContain("shop");
  });
  it("une étape cochée le reste même si l'événement disparaît", () => {
    const saved = { shop: { done_at: "2027-01-11T10:00:00Z", by: "u1", via: "event" as const } };
    expect(computeChecklist(input({ saved })).steps.shop.done).toBe(true);
  });
  it("newlyDone ne renvoie que les étapes pas encore enregistrées", () => {
    const state = computeChecklist(input({ events: [ev("menu_swap")] }));
    expect(newlyDone({ discover_menu: { done_at: "x", by: null, via: "event" } }, state)).toEqual(["adjust_meal"]);
  });

  const requiredEvents = ["menu_swap", "shopping_checked", "session_started", "session_done"].map((n) => ev(n));
  it("fin : les cinq étapes obligatoires suffisent, l'invitation ne bloque pas", () => {
    const s = computeChecklist(input({ events: requiredEvents }));
    expect(s.completed).toBe(true);
    expect(s.steps.invite.done).toBe(false);
    expect(s.mode).toBe("success");
    expect(s.completedAt).toBe(NOW.toISOString());
  });
  it("pas de fin sans la session terminée, même avec l'invitation", () => {
    const events = [...requiredEvents.slice(0, 3), ev("invitation_sent")];
    const s = computeChecklist(input({ events }));
    expect(s.completed).toBe(false);
    expect(s.next).toBe("finish_session");
  });
  it("la réussite reste visible 3 jours puis disparaît", () => {
    expect(computeChecklist(input({ events: requiredEvents, completedAt: "2027-01-10T10:00:00Z" })).mode).toBe(
      "success",
    );
    expect(computeChecklist(input({ events: requiredEvents, completedAt: "2027-01-08T09:00:00Z" })).mode).toBe(
      "hidden",
    );
  });
  it("masquée par le foyer", () => {
    const dismissedAt = "2027-01-11T00:00:00Z";
    expect(computeChecklist(input({ dismissedAt })).mode).toBe("hidden");
    expect(computeChecklist(input({ events: requiredEvents, dismissedAt })).mode).toBe("hidden");
  });
  it("réduite d'office après 21 jours, sans être masquée", () => {
    const s = computeChecklist(input({ createdAt: "2026-12-20T10:00:00Z" }));
    expect(s.autoCollapsed).toBe(true);
    expect(s.mode).toBe("card");
    expect(computeChecklist(input()).autoCollapsed).toBe(false);
  });
});

describe("conseils contextuels", () => {
  const base = { tab: "shopping" as const, seen: [], shownToday: 0, otherTransient: false, canPantry: true };
  it("affiche la bulle d'un onglet jamais vu", () => {
    expect(tipFor(base)).toBe("shopping");
  });
  it("ignore une clé déjà vue", () => {
    expect(tipFor({ ...base, seen: ["shopping"] })).toBeNull();
  });
  it("au plus 2 par jour", () => {
    expect(tipFor({ ...base, shownToday: 1 })).toBe("shopping");
    expect(tipFor({ ...base, shownToday: 2 })).toBeNull();
  });
  it("jamais en même temps qu'une autre aide transitoire", () => {
    expect(tipFor({ ...base, otherTransient: true })).toBeNull();
  });
  it("la bulle Stock est masquée hors offre payante", () => {
    expect(tipFor({ ...base, tab: "stock", canPantry: false })).toBeNull();
    expect(tipFor({ ...base, tab: "stock" })).toBe("stock");
  });
});
