"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { fr } from "@/i18n/fr";

/** Texte à copier-coller (e-mail type, message pour les groupes de parents). */
export function CopyBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-5">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <pre className="font-sans text-sm whitespace-pre-wrap">{text}</pre>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? fr.asso.kit.copied : fr.asso.kit.copy}
      </Button>
    </section>
  );
}
