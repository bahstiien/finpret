import { describe, expect, it } from "vitest";
import {
  activeWeekStart,
  closeWeek,
  computeStreak,
  isInSessionWindow,
  quarterOf,
  type StreakWeek,
} from "./streak";

const done = (n: number): StreakWeek[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2027, 0, 4 + i * 7));
    return { weekStart: d.toISOString().slice(0, 10), outcome: "done" as const };
  });
const week = (weekStart: string, outcome: StreakWeek["outcome"]): StreakWeek => ({ weekStart, outcome });
const cur = (o: Partial<Parameters<typeof computeStreak>[1]> = {}) => ({
  weekStart: "2030-01-07",
  sessionDone: false,
  hasBatch: true,
  plannedPause: false,
  ...o,
});

describe("streak", () => {
  it("la série augmente et signale le palier 4", () => {
    const s = computeStreak(done(3), cur({ sessionDone: true }), []);
    expect(
      closeWeek({ sessionDoneInWindow: true, hasBatch: true, plannedPause: false, pausesUsedInQuarter: 0 })
        .outcome,
    ).toBe("done");
    expect(s.current).toBe(4);
    expect(s.reachedMilestone).toBe(4);
    expect(s.nextMilestone).toBe(12);
  });

  it("une session terminée le mardi compte encore", () => {
    expect(isInSessionWindow(new Date("2027-02-09T19:00:00Z"), "2027-02-08", "Europe/Paris")).toBe(true); // mardi 20 h
    expect(isInSessionWindow(new Date("2027-02-11T12:00:00Z"), "2027-02-08", "Europe/Paris")).toBe(false); // jeudi
    expect(isInSessionWindow(new Date("2027-02-03T23:30:00Z"), "2027-02-08", "Europe/Paris")).toBe(true); // jeudi 4, 00:30 local
    expect(isInSessionWindow(new Date("2027-02-03T22:30:00Z"), "2027-02-08", "Europe/Paris")).toBe(false); // mercredi 3, 23:30 local
  });

  it("une semaine manquée consomme une pause automatiquement", () => {
    const r = closeWeek({
      sessionDoneInWindow: false,
      hasBatch: true,
      plannedPause: false,
      pausesUsedInQuarter: 0,
    });
    expect(r).toEqual({ outcome: "paused", source: "auto" });
    const s = computeStreak([...done(6), week("2027-02-15", "paused")], cur({ weekStart: "2027-02-22" }), []);
    expect(s.current).toBe(6);
    expect(s.pausesLeftThisQuarter).toBe(1);
  });

  it("sans pause, la série repart à zéro et la meilleure est gardée", () => {
    expect(
      closeWeek({ sessionDoneInWindow: false, hasBatch: true, plannedPause: false, pausesUsedInQuarter: 2 })
        .outcome,
    ).toBe("missed");
    const s = computeStreak([...done(9), week("2027-03-08", "missed")], cur({ weekStart: "2027-03-15" }), []);
    expect(s.current).toBe(0);
    expect(s.best).toBe(9);
  });

  it("une pause planifiée est rendue si la session a lieu", () => {
    const planned = { weekStart: "2027-03-15", sessionDone: false, hasBatch: true, plannedPause: true };
    expect(computeStreak([], planned, []).pausesLeftThisQuarter).toBe(1);
    expect(computeStreak([], { ...planned, sessionDone: true }, []).pausesLeftThisQuarter).toBe(2);
    expect(
      closeWeek({ sessionDoneInWindow: true, hasBatch: true, plannedPause: true, pausesUsedInQuarter: 1 })
        .outcome,
    ).toBe("done");
  });

  it("une semaine sans plat à préparer est neutre", () => {
    expect(
      closeWeek({ sessionDoneInWindow: false, hasBatch: false, plannedPause: false, pausesUsedInQuarter: 0 })
        .outcome,
    ).toBe("neutral");
    const s = computeStreak([...done(3), week("2027-01-25", "neutral")], cur({ hasBatch: false }), []);
    expect(s.current).toBe(3);
    expect(s.currentWeek).toBe("neutral");
  });

  it("les jetons repartent à 2 au trimestre suivant", () => {
    const h = [week("2027-03-01", "paused"), week("2027-03-15", "paused")];
    expect(computeStreak(h, cur({ weekStart: "2027-03-22" }), []).pausesLeftThisQuarter).toBe(0);
    expect(computeStreak(h, cur({ weekStart: "2027-04-05" }), []).pausesLeftThisQuarter).toBe(2);
    expect(quarterOf("2027-04-05")).toBe(quarterOf("2027-06-28"));
  });

  it("un palier déjà célébré n'est pas recélébré", () => {
    const s = computeStreak(done(3), cur({ sessionDone: true }), [4]);
    expect(s.current).toBe(4);
    expect(s.reachedMilestone).toBeNull();
  });

  it("au-delà de 52, un palier tous les 52", () => {
    expect(computeStreak(done(103), cur({ sessionDone: true }), [4, 12, 26, 52]).reachedMilestone).toBe(104);
    expect(computeStreak(done(52), cur({ sessionDone: true }), [4, 12, 26, 52]).nextMilestone).toBe(104);
  });

  it("semaine active : fenêtre jeudi à mercredi", () => {
    expect(activeWeekStart("2027-02-08")).toBe("2027-02-08"); // lundi
    expect(activeWeekStart("2027-02-10")).toBe("2027-02-08"); // mercredi
    expect(activeWeekStart("2027-02-11")).toBe("2027-02-15"); // jeudi
    expect(activeWeekStart("2027-02-14")).toBe("2027-02-15"); // dimanche : la session prépare la semaine suivante
  });
});
