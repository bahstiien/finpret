import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC_PROGRES §3.6 : aucun prénom ni nom de foyer sur la carte, aucune donnée personnelle dans l'URL.
describe("carte de palier", () => {
  const source = readFileSync("src/app/api/share/streak/route.tsx", "utf8");

  it("n'utilise ni le nom du foyer ni un prénom", () => {
    expect(source).not.toMatch(/household\.name|display_name|\.name\b.*household|members/);
  });

  it("ne reçoit que le palier dans l'URL", () => {
    expect([...source.matchAll(/searchParams\.get\("(\w+)"\)/g)].map((m) => m[1])).toEqual(["milestone"]);
  });
});
