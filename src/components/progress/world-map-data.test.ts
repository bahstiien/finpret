import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeOrigin } from "@/engine/passport";
import { WORLD_MAP } from "./world-map-data";

/** Origines (`o`) des repas de batch du catalogue (plats, soupes, dîners express). */
function catalogOrigins(): string[] {
  const out = new Set<string>();
  for (const file of ["mains", "soups", "simples"]) {
    const data: unknown = JSON.parse(readFileSync(`seed/${file}.json`, "utf8"));
    const rows = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>).flat();
    for (const r of rows as { o?: string }[]) {
      const o = normalizeOrigin(r?.o);
      if (o) out.add(o);
    }
  }
  return [...out];
}

describe("mappemonde du passeport", () => {
  it("dessine chaque pays d'origine du catalogue (sinon : relancer scripts/build-world-map.mjs)", () => {
    const origins = catalogOrigins();
    expect(origins.length).toBeGreaterThan(10);
    expect(origins.filter((o) => !WORLD_MAP.countries[o])).toEqual([]);
  });
});
