import { afterEach, describe, expect, it, vi } from "vitest";
import { publicEnv } from "./env";

describe("publicEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepte une configuration valide", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "cle-anonyme");
    expect(publicEnv().NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("nomme les variables manquantes", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "pas-une-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => publicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
