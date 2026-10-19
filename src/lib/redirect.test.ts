import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNext } from "./redirect";

describe("safeNext", () => {
  it.each([
    ["/app/shopping", "/app/shopping"],
    ["/join/abc?x=1", "/join/abc?x=1"],
    ["/app/../settings", "/settings"],
  ])("garde le chemin interne %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example/app",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "app",
  ])("refuse %s et revient au menu", (input) => {
    expect(safeNext(input)).toBe("/app");
  });
});

describe("isProtectedPath", () => {
  it.each(["/app", "/app/stock", "/onboarding", "/settings/household"])("%s demande une session", (p) => {
    expect(isProtectedPath(p)).toBe(true);
  });
  it.each(["/", "/login", "/join/abc", "/auth/callback", "/application"])("%s est public", (p) => {
    expect(isProtectedPath(p)).toBe(false);
  });
});
