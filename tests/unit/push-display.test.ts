import { describe, expect, it } from "vitest";
import { notificationFor, notificationTarget, readPayload } from "@/lib/push-display";

const data = (raw: string) => ({ json: () => JSON.parse(raw), text: () => raw });

describe("notification reçue par le service worker", () => {
  it("affiche le titre, le texte et garde le lien vers l'onglet", () => {
    const n = notificationFor(readPayload(data('{"kind":"shopping","title":"Courses","body":"Courses : 12 articles.","url":"/app/shopping"}')));
    expect(n.title).toBe("Courses");
    expect(n.options).toMatchObject({ body: "Courses : 12 articles.", tag: "shopping", data: { url: "/app/shopping" }, lang: "fr" });
  });

  it("tolère un message texte ou vide", () => {
    expect(notificationFor(readPayload(data("Bonjour"))).options.body).toBe("Bonjour");
    expect(notificationFor(readPayload(null)).title).toBe("Fin Prêt");
  });

  it("n'ouvre que des pages de l'application", () => {
    const origin = "https://finpret.example";
    expect(notificationTarget("/app/session", origin)).toBe("https://finpret.example/app/session");
    expect(notificationTarget("https://evil.example/x", origin)).toBe("https://finpret.example/app");
    expect(notificationTarget("//evil.example/x", origin)).toBe("https://finpret.example/app");
    expect(notificationTarget(undefined, origin)).toBe("https://finpret.example/app");
  });
});
