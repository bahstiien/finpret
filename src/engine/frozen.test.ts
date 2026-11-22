import { describe, expect, it } from "vitest";
import { portionsFromSnapshot, snapshotPortions } from "./frozen";
import { legacyPortions } from "./portions";

describe("semaine figée : instantané des portions", () => {
  it("restitue les mêmes portions et convives pour chaque créneau", () => {
    const pm = legacyPortions(0.5);
    const back = portionsFromSnapshot(JSON.parse(JSON.stringify(snapshotPortions(pm))));
    for (let d = 1; d <= 7; d++) {
      for (const m of ["lunch", "dinner"] as const) {
        expect(back.base(d, m)).toBe(pm.base(d, m));
        expect(back.counts(d, m)).toEqual(pm.counts(d, m));
      }
    }
    expect(back.childFactor).toBe(pm.childFactor);
  });
});
