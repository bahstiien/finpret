import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSender, sendEmail } from "@/server/email";

afterEach(() => vi.unstubAllEnvs());

describe("parseSender", () => {
  it("sépare le nom et l'adresse", () => {
    expect(parseSender("Fin Prêt <rappels@finpret.app>")).toEqual({
      name: "Fin Prêt",
      email: "rappels@finpret.app",
    });
    expect(parseSender('"Fin Prêt" <rappels@finpret.app>')).toEqual({
      name: "Fin Prêt",
      email: "rappels@finpret.app",
    });
  });

  it("accepte une adresse seule", () => {
    expect(parseSender("rappels@finpret.app")).toEqual({ email: "rappels@finpret.app" });
    expect(parseSender("<rappels@finpret.app>")).toEqual({ email: "rappels@finpret.app" });
  });
});

describe("sendEmail (Brevo)", () => {
  it("n'envoie rien sans clé", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "Fin Prêt <rappels@finpret.app>");
    const fetchImpl = vi.fn();
    expect(await sendEmail({ to: "a@b.fr", subject: "s", html: "h", text: "t" }, fetchImpl)).toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("appelle l'API transactionnelle au format Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("EMAIL_FROM", "Fin Prêt <rappels@finpret.app>");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 201 }));
    const result = await sendEmail(
      {
        to: "a@b.fr",
        subject: "Sujet",
        html: "<p>h</p>",
        text: "t",
        attachments: [{ filename: "releve.pdf", content: Buffer.from("pdf") }],
        unsubscribeUrl: "https://finpret.app/api/unsubscribe?t=x",
      },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: "Fin Prêt", email: "rappels@finpret.app" },
      to: [{ email: "a@b.fr" }],
      subject: "Sujet",
      htmlContent: "<p>h</p>",
      textContent: "t",
      attachment: [{ name: "releve.pdf", content: Buffer.from("pdf").toString("base64") }],
      headers: {
        "List-Unsubscribe": "<https://finpret.app/api/unsubscribe?t=x>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  });

  it("signale un échec de l'API", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("EMAIL_FROM", "rappels@finpret.app");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 400 }));
    expect(
      await sendEmail({ to: "a@b.fr", subject: "s", html: "h", text: "t" }, fetchImpl as unknown as typeof fetch),
    ).toEqual({ ok: false, reason: "failed" });
  });
});
