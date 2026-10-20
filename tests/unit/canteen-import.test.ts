import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { menusFromText, pdfText } from "@/server/canteen-import";

describe("import du PDF de la cantine", () => {
  it("un PDF d'exemple donne des menus datés à valider", async () => {
    const text = await pdfText(new Uint8Array(readFileSync("tests/fixtures/canteen/menu-exemple.pdf")));
    expect(text).toContain("Coquillettes bolognaise");
    expect(await menusFromText(text!, "2026-10-15")).toEqual([
      { date: "2026-10-19", text: "Carottes rapees Coquillettes bolognaise Yaourt nature" },
      { date: "2026-10-20", text: "Filet de colin, riz pilaf Compote" },
      { date: "2026-10-22", text: "Omelette, puree de potiron Fromage blanc" },
      { date: "2026-10-23", text: "Poulet roti, haricots verts Fruit de saison" },
    ]);
  });

  it("un fichier qui n'est pas un PDF lisible ne donne rien", async () => {
    expect(await pdfText(new TextEncoder().encode("pas un pdf"))).toBeNull();
  });
});
