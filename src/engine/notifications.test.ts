import { describe, expect, it } from "vitest";
import { autoPausedNoticeDue, dueNotifications, localTime, type NotificationPrefs } from "./notifications";

const PREFS: NotificationPrefs = {
  push: true,
  email: false,
  dinner: { enabled: true, time: "17:30" },
  thaw: { enabled: true, time: "20:30" },
  shoppingReady: true,
  sessionStart: true,
  consentAt: "2026-10-01T10:00:00Z",
};
// Session le dimanche à 14 h, courses le samedi.
const SCHEDULE = { sessionDay: 0, sessionTime: "14:00", shoppingDay: 6 };
const at = (iso: string, tz = "Europe/Paris") => localTime(new Date(iso), tz);
const kinds = (iso: string, prefs = PREFS, tz = "Europe/Paris") =>
  dueNotifications(prefs, SCHEDULE, at(iso, tz)).map((d) => d.kind);

describe("heure locale du foyer", () => {
  it("suit le fuseau et l'heure d'été", () => {
    // 20 octobre 2026 (heure d'été, UTC+2) puis 3 novembre (heure d'hiver, UTC+1).
    expect(at("2026-10-20T15:30:00Z")).toEqual({ date: "2026-10-20", weekday: 2, minutes: 17 * 60 + 30 });
    expect(at("2026-11-03T16:30:00Z")).toEqual({ date: "2026-11-03", weekday: 2, minutes: 17 * 60 + 30 });
    expect(at("2026-10-20T22:30:00Z")).toMatchObject({ date: "2026-10-21", weekday: 3 });
    expect(at("2026-10-20T15:30:00Z", "America/Montreal")).toMatchObject({ date: "2026-10-20", minutes: 11 * 60 + 30 });
  });
});

describe("rappels dus dans la fenêtre de 15 min", () => {
  it("plat du soir et décongélation à l'heure choisie", () => {
    expect(kinds("2026-10-20T15:30:00Z")).toEqual(["dinner"]); // 17 h 30 à Paris
    expect(kinds("2026-10-20T15:44:00Z")).toEqual(["dinner"]);
    expect(kinds("2026-10-20T15:45:00Z")).toEqual([]);
    expect(kinds("2026-10-20T15:29:00Z")).toEqual([]);
    expect(kinds("2026-10-20T18:30:00Z")).toEqual(["thaw"]);
  });

  it("courses le jour des courses à 9 h, session 30 min avant son début", () => {
    expect(kinds("2026-10-24T07:00:00Z")).toEqual(["shopping"]); // samedi 9 h
    expect(kinds("2026-10-23T07:00:00Z")).toEqual([]); // vendredi
    expect(kinds("2026-10-25T12:30:00Z")).toEqual(["session"]); // dimanche 13 h 30 (heure d'hiver : UTC+1)
  });

  it("rappel de session la veille quand la session commence juste après minuit", () => {
    const schedule = { ...SCHEDULE, sessionDay: 1, sessionTime: "00:10" };
    // Dimanche 23 h 40 à Paris → lundi 0 h 10.
    expect(dueNotifications(PREFS, schedule, at("2026-11-01T22:40:00Z")).map((d) => d.kind)).toEqual(["session"]);
  });

  it("rien sans consentement, sans canal ou rappel désactivé", () => {
    expect(kinds("2026-10-20T15:30:00Z", { ...PREFS, consentAt: null })).toEqual([]);
    expect(kinds("2026-10-20T15:30:00Z", { ...PREFS, push: false })).toEqual([]);
    expect(kinds("2026-10-20T15:30:00Z", { ...PREFS, push: false, email: true })).toEqual(["dinner"]);
    expect(kinds("2026-10-20T15:30:00Z", { ...PREFS, dinner: { enabled: false, time: "17:30" } })).toEqual([]);
  });

  it("deux passages dans la même fenêtre donnent la même clé d'idempotence", () => {
    const a = dueNotifications(PREFS, SCHEDULE, at("2026-10-20T15:31:00Z"));
    const b = dueNotifications(PREFS, SCHEDULE, at("2026-10-20T15:40:00Z"));
    expect(a).toEqual([{ kind: "dinner", day: "2026-10-20" }]);
    expect(b).toEqual(a);
  });
});

describe("autoPausedNoticeDue", () => {
  const at = (iso: string) => localTime(new Date(iso), "Europe/Paris");
  it("jeudi à partir de 9 h pour la semaine qui vient de se clore", () => {
    expect(autoPausedNoticeDue("2027-02-08", at("2027-02-11T08:30:00Z"))).toBe(true); // jeudi 9 h 30 locales
    expect(autoPausedNoticeDue("2027-02-08", at("2027-02-11T07:30:00Z"))).toBe(false); // 8 h 30 locales
  });
  it("pas un autre jour, pas une autre semaine", () => {
    expect(autoPausedNoticeDue("2027-02-08", at("2027-02-12T09:00:00Z"))).toBe(false); // vendredi
    expect(autoPausedNoticeDue("2027-02-01", at("2027-02-11T09:00:00Z"))).toBe(false);
  });
});
