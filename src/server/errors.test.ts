import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { toUserMessage } from "./errors";

describe("toUserMessage", () => {
  it("traduit les erreurs métier levées par la base", () => {
    expect(toUserMessage({ code: "P0001", message: "last_admin" })).toBe(fr.errors.last_admin);
    expect(toUserMessage({ code: "P0001", message: "invitation_used" })).toBe(fr.errors.invitation_used);
  });

  it("traduit un refus de la RLS", () => {
    expect(toUserMessage({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      fr.errors.forbidden,
    );
  });

  it("ne montre jamais le message technique brut", () => {
    expect(toUserMessage({ code: "XX000", message: "connection refused" })).toBe(fr.errors.generic);
    expect(toUserMessage(null)).toBe(fr.errors.generic);
  });
});
