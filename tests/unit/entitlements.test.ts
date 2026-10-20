import { describe, expect, it } from "vitest";
import {
  can,
  type Feature,
  FREE_SWAPS_PER_WEEK,
  type HouseholdOffer,
  MEMBER_LIMIT,
  tierOf,
} from "@/server/entitlements";

const NOW = new Date("2027-01-10T10:00:00Z");
const base = { associationId: null as string | null };
const free: HouseholdOffer = { ...base, plan: "free", status: "canceled", trialEndsAt: null };
const trial: HouseholdOffer = {
  ...base,
  plan: "trial",
  status: "trialing",
  trialEndsAt: "2027-01-20T00:00:00Z",
};
const expired: HouseholdOffer = {
  ...base,
  plan: "trial",
  status: "trialing",
  trialEndsAt: "2027-01-05T00:00:00Z",
};
const monthly: HouseholdOffer = { ...base, plan: "monthly", status: "active", trialEndsAt: null };
const asso = (o: HouseholdOffer): HouseholdOffer => ({ ...o, associationId: "asso-1" });

const PAID: Feature[] = ["menu.move", "menu.guests", "pantry", "notifications.meals", "print"];

describe("tierOf", () => {
  it("distingue gratuit, essai en cours et abonné", () => {
    expect(tierOf(free, NOW)).toBe("free");
    expect(tierOf(trial, NOW)).toBe("trial");
    expect(tierOf(monthly, NOW)).toBe("subscribed");
  });
  it("un essai échu devient gratuit sans basculement", () => {
    expect(tierOf(expired, NOW)).toBe("free");
  });
  it("un abonnement impayé reste actif pendant les relances, puis devient gratuit", () => {
    expect(tierOf({ ...monthly, status: "past_due" }, NOW)).toBe("subscribed");
    expect(tierOf({ ...monthly, status: "canceled" }, NOW)).toBe("free");
    expect(tierOf({ ...monthly, status: "unpaid" }, NOW)).toBe("free");
  });
});

describe("can", () => {
  it("génération, courses, session et Découvrir sont toujours permis", () => {
    for (const f of ["menu.generate", "shopping", "purchases", "session", "discover"] as Feature[]) {
      expect(can(free, f, { now: NOW })).toBe(true);
    }
  });
  it("les fonctions payantes demandent l'essai ou l'abonnement", () => {
    for (const f of PAID) {
      expect(can(free, f, { now: NOW })).toBe(false);
      expect(can(expired, f, { now: NOW })).toBe(false);
      expect(can(trial, f, { now: NOW })).toBe(true);
      expect(can(monthly, f, { now: NOW })).toBe(true);
    }
  });
  it("le rattachement à une association n'ouvre pas les fonctions payantes", () => {
    for (const f of PAID) expect(can(asso(free), f, { now: NOW })).toBe(false);
  });
  it("D12 : cantine et alerte doublon toujours permises à un foyer rattaché", () => {
    for (const f of ["canteen", "canteen.alert"] as Feature[]) {
      expect(can(free, f, { now: NOW })).toBe(false);
      expect(can(asso(free), f, { now: NOW })).toBe(true);
      expect(can(asso(expired), f, { now: NOW })).toBe(true);
      expect(can(monthly, f, { now: NOW })).toBe(true);
    }
  });
  it("Changer : 3 par semaine en gratuit, illimité sinon", () => {
    expect(can(free, "menu.swap", { now: NOW, used: FREE_SWAPS_PER_WEEK - 1 })).toBe(true);
    expect(can(free, "menu.swap", { now: NOW, used: FREE_SWAPS_PER_WEEK })).toBe(false);
    expect(can(trial, "menu.swap", { now: NOW, used: 99 })).toBe(true);
    expect(can(monthly, "menu.swap", { now: NOW, used: 99 })).toBe(true);
  });
  it("comptes du foyer : 2 en gratuit, 8 en essai ou abonné", () => {
    expect(can(free, "household.members", { now: NOW, used: MEMBER_LIMIT.free - 1 })).toBe(true);
    expect(can(free, "household.members", { now: NOW, used: MEMBER_LIMIT.free })).toBe(false);
    expect(can(monthly, "household.members", { now: NOW, used: 7 })).toBe(true);
    expect(can(monthly, "household.members", { now: NOW, used: 8 })).toBe(false);
    expect(can(trial, "household.members", { now: NOW, used: 8 })).toBe(false);
  });
});
