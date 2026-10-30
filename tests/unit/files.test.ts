import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { filePath, readStoredFile, storeFile } from "@/server/files";

describe("fichiers privés", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "finpret-files-"));
    process.env.FILES_DIR = dir;
  });
  afterAll(() => {
    delete process.env.FILES_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("range un fichier sous <bucket>/<chemin> et le relit", async () => {
    const content = Buffer.from("%PDF-1.7 relevé");
    await storeFile("asso-statements", "1b2c/2026-T3.pdf", content);
    expect(await readStoredFile("asso-statements", "1b2c/2026-T3.pdf")).toEqual(content);
    expect(filePath("asso-statements", "1b2c/2026-T3.pdf")).toBe(
      join(dir, "asso-statements", "1b2c", "2026-T3.pdf"),
    );
  });

  it("remplace un fichier existant", async () => {
    await storeFile("asso-kits", "a/fiche-tuto.pdf", Buffer.from("v1"));
    await storeFile("asso-kits", "a/fiche-tuto.pdf", Buffer.from("v2"));
    expect((await readStoredFile("asso-kits", "a/fiche-tuto.pdf"))?.toString()).toBe("v2");
  });

  it("renvoie null pour un fichier absent", async () => {
    expect(await readStoredFile("asso-kits", "absent/fiche-tuto.pdf")).toBeNull();
  });

  it.each(["../secret.pdf", "a/../../secret.pdf", "/etc/passwd", "a//b.pdf", "", "a/.hidden", "a\\b.pdf"])(
    "refuse le chemin %j",
    (path) => {
      expect(() => filePath("asso-kits", path)).toThrow(/refusé/);
    },
  );

  it("ne relit rien hors du bucket", async () => {
    expect(await readStoredFile("asso-kits", "../asso-statements/1b2c/2026-T3.pdf")).toBeNull();
  });
});
