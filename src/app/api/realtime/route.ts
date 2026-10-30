import { z } from "zod";
import { subscribeHousehold } from "@/server/realtime";
import { getHouseholds } from "@/server/session";

export const dynamic = "force-dynamic";

/** Battement régulier : garde la connexion ouverte à travers les proxys et détecte les navigateurs partis. */
const HEARTBEAT_MS = 25_000;

/**
 * Flux SSE des changements d'un foyer (courses, session, achats…) pour un membre connecté.
 * Chaque message dit seulement quelle table a changé pour quelle semaine : le navigateur relit ensuite, sous la RLS.
 */
export async function GET(request: Request) {
  const householdId = new URL(request.url).searchParams.get("household") ?? "";
  if (!z.uuid().safeParse(householdId).success) return new Response(null, { status: 400 });
  // getHouseholds() ne renvoie que les foyers du compte connecté (vide sans session).
  if (!(await getHouseholds()).some((h) => h.id === householdId)) return new Response(null, { status: 403 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = await subscribeHousehold(householdId, (event) =>
        send(`data: ${JSON.stringify({ table: event.t, weekId: event.w })}\n\n`),
      );
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Flux déjà fermé.
        }
      });
      // Délai de reconnexion du navigateur, puis signal « prêt » : il relit ses données à chaque (re)connexion.
      send("retry: 3000\nevent: ready\ndata: {}\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
