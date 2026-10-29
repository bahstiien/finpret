import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { fr } from "@/i18n/fr";

const t = fr.notFoundPage;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

/** Page 404 de marque : une phrase claire et un seul chemin de retour. */
export default function NotFound() {
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-start justify-center gap-6 px-4 py-12">
      <p className="num-xl nb tone-violet px-4 py-2" aria-hidden="true">
        404
      </p>
      <h1 className="t-1">{t.title}</h1>
      <p className="text-lg text-muted">{t.lead}</p>
      <Link href="/" className={buttonClass({ size: "lg" })}>
        {t.home}
      </Link>
    </main>
  );
}
