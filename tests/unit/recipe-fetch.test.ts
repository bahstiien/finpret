import { describe, expect, it } from "vitest";
import { fetchRecipePage, MAX_BYTES } from "@/server/recipe-fetch";

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

describe("récupération d'une page de recette", () => {
  it("refuse les liens privés sans faire de requête", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return html("");
    }) as typeof fetch;
    expect(await fetchRecipePage("http://192.168.1.10/recette", { fetchImpl })).toEqual({ ok: false, error: "blocked" });
    expect(await fetchRecipePage("file:///etc/passwd", { fetchImpl })).toEqual({ ok: false, error: "blocked" });
    expect(called).toBe(false);
  });

  it("lit une page publique", async () => {
    const res = await fetchRecipePage("http://8.8.8.8/recette", { fetchImpl: (async () => html("<h1>ok</h1>")) as typeof fetch });
    expect(res).toMatchObject({ ok: true, html: "<h1>ok</h1>" });
  });

  it("refuse une redirection vers une adresse privée", async () => {
    const fetchImpl = (async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } })) as typeof fetch;
    expect(await fetchRecipePage("http://8.8.8.8/r", { fetchImpl })).toEqual({ ok: false, error: "blocked" });
  });

  it("abandonne après le délai maximal", async () => {
    const fetchImpl = ((_: unknown, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))) as typeof fetch;
    expect(await fetchRecipePage("http://8.8.8.8/r", { fetchImpl, timeoutMs: 50 })).toEqual({ ok: false, error: "timeout" });
  });

  it("refuse une page de plus de 3 Mo", async () => {
    const big = "a".repeat(MAX_BYTES + 10);
    expect(await fetchRecipePage("http://8.8.8.8/r", { fetchImpl: (async () => html(big)) as typeof fetch })).toEqual({
      ok: false,
      error: "too_big",
    });
  });

  it("refuse ce qui n'est pas une page web", async () => {
    const fetchImpl = (async () => html("%PDF", { "content-type": "application/pdf" })) as typeof fetch;
    expect(await fetchRecipePage("http://8.8.8.8/r", { fetchImpl })).toEqual({ ok: false, error: "not_html" });
  });
});
