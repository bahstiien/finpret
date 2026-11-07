import { describe, expect, it } from "vitest";
import { renewalNoticeDue } from "./renewal";

const TZ = "Europe/Paris";
// Reconduction le 4 janvier 2028 (midi à Paris).
const END = "2028-01-04T11:00:00Z";

describe("rappel de reconduction annuelle (L215-1)", () => {
  it("part entre J-60 et J-31, à partir de 10 h, avec la date de reconduction pour clé", () => {
    expect(renewalNoticeDue(END, TZ, new Date("2027-11-05T09:00:00Z"))).toEqual({ days: 60, renewalDay: "2028-01-04" });
    expect(renewalNoticeDue(END, TZ, new Date("2027-12-04T15:00:00Z"))).toEqual({ days: 31, renewalDay: "2028-01-04" });
  });
  it("rattrape un passage manqué dans la fenêtre", () => {
    expect(renewalNoticeDue(END, TZ, new Date("2027-11-20T18:00:00Z"))?.days).toBe(45);
  });
  it("ne part ni trop tôt, ni trop tard, ni avant 10 h", () => {
    expect(renewalNoticeDue(END, TZ, new Date("2027-11-04T12:00:00Z"))).toBeNull(); // J-61
    expect(renewalNoticeDue(END, TZ, new Date("2027-12-05T12:00:00Z"))).toBeNull(); // J-30
    expect(renewalNoticeDue(END, TZ, new Date("2027-11-20T08:30:00Z"))).toBeNull(); // 9 h 30 à Paris
  });
});
