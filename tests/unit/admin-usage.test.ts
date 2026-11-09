import { describe, expect, it } from "vitest";
import { fillSeries, parsePeriod, share, topBy, usageRange } from "@/lib/admin-usage";

describe("page Usage et communauté", () => {
  it("retombe sur 30 jours pour une période inconnue", () => {
    expect(parsePeriod(undefined)).toBe("30");
    expect(parsePeriod("90")).toBe("90");
    expect(parsePeriod("7")).toBe("30");
  });

  it("découpe 30 jours en jours et compare aux 30 jours précédents", () => {
    const r = usageRange("30", "2026-11-09");
    expect(r).toMatchObject({ since: "2026-10-11", prevSince: "2026-09-11", unit: "day" });
    expect(r.keys).toHaveLength(30);
    expect(r.keys.at(-1)).toBe("2026-11-09");
  });

  it("découpe 13 semaines en lundis, la dernière étant la semaine en cours", () => {
    const r = usageRange("90", "2026-11-11");
    expect(r.unit).toBe("week");
    expect(r.keys).toHaveLength(13);
    expect(r.keys.at(-1)).toBe("2026-11-09");
    expect(r.since).toBe("2026-08-17");
    expect(r.prevSince).toBe("2026-05-18");
  });

  it("complète la série par des zéros", () => {
    expect(fillSeries([{ key: "b", n: "3" }], ["a", "b", "c"])).toEqual([
      { key: "a", n: 0 },
      { key: "b", n: 3 },
      { key: "c", n: 0 },
    ]);
  });

  it("classe par score puis par nom, sans les scores nuls", () => {
    const items = [
      { name: "Tajine", s: 2 },
      { name: "Curry", s: 2 },
      { name: "Soupe", s: 0 },
      { name: "Pot-au-feu", s: 5 },
    ];
    expect(topBy(items, (i) => i.s, 2).map((i) => i.name)).toEqual(["Pot-au-feu", "Curry"]);
    expect(topBy(items, (i) => i.s).map((i) => i.name)).not.toContain("Soupe");
  });

  it("affiche une part en pourcentage", () => {
    expect(share(1, 3)).toBe("33 %");
    expect(share(1, 0)).toBe("—");
  });
});
