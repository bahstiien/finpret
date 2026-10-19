"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/errors";
import { Button } from "./Button";
import { FormMessage } from "./Field";

/**
 * Petit formulaire d'une action serveur (retirer, révoquer…) : confirmation facultative,
 * bouton désactivé pendant l'envoi et message d'erreur en ligne.
 */
export function ActionForm({
  action,
  fields,
  label,
  confirm,
  variant = "outline",
  ariaLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  fields: Record<string, string>;
  label: string;
  confirm?: string;
  variant?: "primary" | "outline" | "dark";
  ariaLabel?: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await action(formData);
          setError(result && !result.ok ? result.error : undefined);
        });
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} disabled={pending} aria-label={ariaLabel}>
        {label}
      </Button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </form>
  );
}
