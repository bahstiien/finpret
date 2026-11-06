import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("migrations", () => {
  it("ont chacune un numéro de version unique", () => {
    // scripts/migrate.mjs identifie une migration par le préfixe avant « _ » : deux fichiers au même préfixe
    // font échouer le déploiement (clé primaire de schema_migrations).
    const versions = readdirSync("db/migrations")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0]);
    const doublons = versions.filter((v, i) => versions.indexOf(v) !== i);
    expect(doublons).toEqual([]);
  });
});
