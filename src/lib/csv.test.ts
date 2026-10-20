import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("export CSV", () => {
  it("met entre guillemets les champs qui contiennent ; ou un saut de ligne", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("deux\nlignes")).toBe('"deux\nlignes"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
  });
  it("neutralise les formules de tableur", () => {
    expect(csvCell("=SOMME(A1)")).toBe("'=SOMME(A1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-800)).toBe("-800");
  });
  it("produit un fichier avec BOM et fins de ligne Windows", () => {
    expect(
      toCsv([
        ["a", 1],
        ["b", null],
      ]),
    ).toBe("﻿a;1\r\nb;\r\n");
  });
});
