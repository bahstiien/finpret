import jsQR from "jsqr";
import { PNG } from "pngjs";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { familyUrl, type TutoInput, tutoContent, tutoSourceHash } from "@/lib/tuto";
import { qrDataUrl, renderTutoPdf } from "@/server/pdf/tuto-pdf";

const input: TutoInput = {
  associationName: "APE Jules Ferry",
  code: "APE-JULESFERRY",
  schools: [{ name: "École Jules Ferry", city: "Lyon" }],
  startDate: "4 janvier 2027",
  generatedAt: "20 décembre 2026",
  baseUrl: "https://finpret.app",
};

describe("fiche tuto d'association", () => {
  it("se génère en 2 pages A4 sans valeur manquante", async () => {
    const pdf = await renderTutoPdf(input);
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    expect(doc.numPages).toBe(2);
    const { text } = await extractText(doc, { mergePages: true });
    expect(text).not.toMatch(/undefined|null|NaN/);
    expect(text).toContain("APE Jules Ferry vous présente Fin Prêt");
    expect(text).toContain("APE-JULESFERRY");
    expect(text).toContain("39,99");
    expect(text).toContain("bonjour@finpret.app");
  });

  it("porte un QR code qui mène à la page de l'association", async () => {
    const url = await qrDataUrl(input.baseUrl, input.code);
    const png = PNG.sync.read(Buffer.from(url.replace(/^data:image\/png;base64,/, ""), "base64"));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe("https://finpret.app/ecole/APE-JULESFERRY");
    expect(familyUrl("https://finpret.app/", "APE-X")).toBe("https://finpret.app/ecole/APE-X");
  });

  it("la version web et le PDF partagent le même contenu", () => {
    const c = tutoContent(input);
    expect(c.family.steps[0]).toContain("finpret.app/ecole/APE-JULESFERRY");
    expect(c.family.benefit).toContain("APE Jules Ferry");
    expect(c.bureau.summary).toContainEqual(["Code", "APE-JULESFERRY"]);
  });

  it("change de hash quand le nom, le code ou l'école change", () => {
    const base = tutoSourceHash(input);
    expect(tutoSourceHash({ ...input })).toBe(base);
    expect(tutoSourceHash({ ...input, code: "APE-FERRY" })).not.toBe(base);
    expect(tutoSourceHash({ ...input, associationName: "APE Ferry" })).not.toBe(base);
    expect(tutoSourceHash({ ...input, schools: [{ name: "École Pasteur", city: "Lyon" }] })).not.toBe(base);
  });
});
