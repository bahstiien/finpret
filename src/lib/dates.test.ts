import { describe, expect, it } from "vitest";
import { addDays, dayIndex, isoWeekday, mondayOf, nextMonday, todayIn } from "./dates";

describe("dates", () => {
  it("calcule le jour de la semaine et le lundi", () => {
    expect(isoWeekday("2027-03-01")).toBe(1); // lundi
    expect(isoWeekday("2027-03-07")).toBe(7);
    expect(mondayOf("2027-03-04")).toBe("2027-03-01");
    expect(mondayOf("2027-03-07")).toBe("2027-03-01");
  });

  it("donne le lundi suivant comme le prototype (le lendemain le dimanche)", () => {
    expect(nextMonday("2027-03-07")).toBe("2027-03-08");
    expect(nextMonday("2027-03-01")).toBe("2027-03-08");
    expect(nextMonday("2027-03-05")).toBe("2027-03-08");
  });

  it("compte les jours depuis le lundi", () => {
    expect(dayIndex("2027-03-01", "2027-03-01")).toBe(1);
    expect(dayIndex("2027-03-01", "2027-02-28")).toBe(0);
    expect(addDays("2027-02-27", 2)).toBe("2027-03-01");
  });

  it("lit la date dans le fuseau du foyer", () => {
    const lateUtc = new Date("2027-03-01T23:30:00Z");
    expect(todayIn("Europe/Paris", lateUtc)).toBe("2027-03-02");
    expect(todayIn("America/New_York", lateUtc)).toBe("2027-03-01");
  });
});
