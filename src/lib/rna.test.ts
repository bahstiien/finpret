import { describe, expect, it } from "vitest";
import { checkAssociationEmail, checkRnaOrSiren } from "./rna";

describe("numéro d'association", () => {
  it("accepte un RNA bien formé", () => {
    expect(checkRnaOrSiren("W691234567")).toMatchObject({ kind: "rna", valid: true });
    expect(checkRnaOrSiren("w 691 234 567").valid).toBe(true);
  });
  it("vérifie la clé de contrôle d'un SIREN", () => {
    expect(checkRnaOrSiren("552 100 554")).toMatchObject({ kind: "siren", valid: true });
    expect(checkRnaOrSiren("552100555")).toMatchObject({ kind: "siren", valid: false });
  });
  it("refuse un format inconnu", () => {
    expect(checkRnaOrSiren("12345")).toMatchObject({ kind: null, valid: false });
    expect(checkRnaOrSiren("W12")).toMatchObject({ valid: false });
  });
  it("signale une adresse jetable", () => {
    expect(checkAssociationEmail("bureau@ape-ferry.fr").valid).toBe(true);
    expect(checkAssociationEmail("x@yopmail.com").valid).toBe(false);
    expect(checkAssociationEmail("pas-un-mail").valid).toBe(false);
  });
});
