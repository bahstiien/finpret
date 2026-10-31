"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { createPromoCode, setPromoActive } from "@/server/actions/admin";

/** Création d'un code promo (réduction en %), créé côté Stripe. */
export function PromoForm() {
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [duration, setDuration] = useState("once");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const res = await createPromoCode(fd);
          setError(res.ok ? undefined : res.error);
          setDone(res.ok);
          if (res.ok) form.reset();
        });
      }}
    >
      <label className="field-label flex flex-col gap-1">
        Code
        <input name="code" required minLength={3} maxLength={30} placeholder="BIENVENUE20" className="input mono" />
      </label>
      <label className="field-label flex flex-col gap-1">
        Réduction (%)
        <input name="percent" type="number" required min={1} max={100} className="input" />
      </label>
      <label className="field-label flex flex-col gap-1">
        Durée
        <select name="duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="input">
          <option value="once">Premier paiement</option>
          <option value="repeating">Plusieurs mois</option>
          <option value="forever">Tant que l&apos;abonnement dure</option>
        </select>
      </label>
      {duration === "repeating" && (
        <label className="field-label flex flex-col gap-1">
          Mois
          <input name="months" type="number" required min={1} max={36} className="input" />
        </label>
      )}
      <label className="field-label flex flex-col gap-1">
        Utilisations max (option)
        <input name="maxRedemptions" type="number" min={1} className="input" />
      </label>
      <label className="field-label flex flex-col gap-1">
        Expire le (option)
        <input name="expires" type="date" className="input" />
      </label>
      <label className="field-label flex flex-col gap-1">
        Montant minimum € (option)
        <input name="minEuros" type="number" min={1} step="any" className="input" />
      </label>
      <label className="field-label flex items-center gap-2">
        <input name="firstTime" type="checkbox" />
        Premier achat seulement
      </label>
      <Button type="submit" disabled={pending}>
        Créer le code
      </Button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {done && !error && <FormMessage tone="success">Code créé.</FormMessage>}
    </form>
  );
}

/** Active ou désactive un code existant. */
export function PromoToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("active", String(!active));
        start(async () => void (await setPromoActive(fd)));
      }}
    >
      {active ? "Désactiver" : "Réactiver"}
    </Button>
  );
}
