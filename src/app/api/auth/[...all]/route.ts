import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

/** Points d'entrée de Better Auth : vérification du lien magique, retours OAuth, session. */
export const GET = (request: Request) => toNextJsHandler(auth()).GET(request);
export const POST = (request: Request) => toNextJsHandler(auth()).POST(request);
