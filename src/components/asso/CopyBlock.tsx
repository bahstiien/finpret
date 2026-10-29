"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { fr } from "@/i18n/fr";
import { Card } from "@/components/ui/Card";

/** Texte à copier-coller (e-mail type, message pour les groupes de parents). */
export function CopyBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="t-2">{title}</h2>
      <pre className="tone-chip mono t-small rounded-r1 border-[length:var(--bw)] border-line p-3 whitespace-pre-wrap">{text}</pre>
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
    </Card>
  );
}
