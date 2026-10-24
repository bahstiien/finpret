/** Contenu d'une notification push reçue par le service worker (§12), testable hors navigateur. */

export type PushPayload = { title?: string; body?: string; url?: string; kind?: string };

export function readPayload(data: { json(): unknown; text(): string } | null | undefined): PushPayload {
  if (!data) return {};
  try {
    const value = data.json();
    return value && typeof value === "object" ? (value as PushPayload) : {};
  } catch {
    return { body: data.text() };
  }
}

export function notificationFor(p: PushPayload): { title: string; options: NotificationOptions } {
  return {
    title: p.title || "Fin Prêt",
    options: {
      body: p.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "fr",
      // Un rappel du même type remplace le précédent au lieu de s'empiler.
      tag: p.kind,
      data: { url: p.url ?? "/app" },
    },
  };
}

/** Adresse ouverte au clic : uniquement un chemin de l'application (pas de redirection vers un autre site). */
export function notificationTarget(path: unknown, origin: string): string {
  const safe =
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
  return new URL(safe ? path : "/app", origin).href;
}
