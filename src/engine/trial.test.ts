import { describe, expect, it } from "vitest";
import { trialDaysLeft, trialReminderDue } from "./trial";

const TZ = "Europe/Paris";

describe("fin d'essai", () => {
  it("compte les jours à la date locale du foyer", () => {
    // 10 h à Paris le 10 janvier (09:00 UTC).
    const now = new Date("2027-01-10T09:00:00Z");
    expect(trialDaysLeft("2027-01-13T12:00:00Z", TZ, now)).toBe(3);
    expect(trialDaysLeft("2027-01-10T23:30:00Z", TZ, now)).toBe(1);
    expect(trialDaysLeft("2027-01-10T11:00:00Z", TZ, now)).toBe(0);
    expect(trialDaysLeft("2027-01-08T11:00:00Z", TZ, now)).toBe(-2);
  });
  it("rappelle à J-3 et J0, à 10 h, une seule fenêtre de 15 minutes", () => {
    const end = "2027-01-13T12:00:00Z";
    expect(trialReminderDue(end, TZ, new Date("2027-01-10T09:05:00Z"))).toBe(3);
    expect(trialReminderDue(end, TZ, new Date("2027-01-13T09:00:00Z"))).toBe(0);
  });
  it("ne rappelle ni à une autre heure, ni un autre jour", () => {
    const end = "2027-01-13T12:00:00Z";
    expect(trialReminderDue(end, TZ, new Date("2027-01-10T09:15:00Z"))).toBeNull();
    expect(trialReminderDue(end, TZ, new Date("2027-01-10T10:00:00Z"))).toBeNull();
    expect(trialReminderDue(end, TZ, new Date("2027-01-11T09:00:00Z"))).toBeNull();
    expect(trialReminderDue(end, TZ, new Date("2027-01-14T09:00:00Z"))).toBeNull();
  });
});
