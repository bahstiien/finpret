"use client";

import { useRef, useState } from "react";
import { associationsFr } from "@/i18n/associations";
import { estimateAnnualAmount, SIM_FAMILIES, SIM_SHARE } from "@/lib/simulator";
import { recordPublicEvent } from "@/server/actions/public";
import { Card } from "@/components/ui/Card";

const t = associationsFr.simulator;
const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Simulateur de reversement : seul morceau interactif de la landing (le reste est statique). */
export function Simulator() {
  const [families, setFamilies] = useState<number>(SIM_FAMILIES.default);
  const [share, setShare] = useState<number>(SIM_SHARE.default);
  const tracked = useRef(false);
  const touch = () => {
    if (tracked.current) return;
    tracked.current = true;
    void recordPublicEvent("asso_simulator_used");
  };
  const amount = estimateAnnualAmount(families, share);
  return (
    <Card as="div" className="flex flex-col gap-6 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="flex flex-col gap-2 font-bold">
          <span>
            {t.families} : <output>{families}</output>
          </span>
          <input
            type="range"
            min={SIM_FAMILIES.min}
            max={SIM_FAMILIES.max}
            step={10}
            value={families}
            onChange={(e) => {
              touch();
              setFamilies(Number(e.target.value));
            }}
            className="h-11 w-full accent-violet"
          />
        </label>
        <label className="flex flex-col gap-2 font-bold">
          <span>
            {t.share} : <output>{share} %</output>
          </span>
          <input
            type="range"
            min={SIM_SHARE.min}
            max={SIM_SHARE.max}
            step={1}
            value={share}
            onChange={(e) => {
              touch();
              setShare(Number(e.target.value));
            }}
            className="h-11 w-full accent-violet"
          />
        </label>
      </div>
      <p className="text-2xl font-bold sm:text-3xl" aria-live="polite" data-testid="simulator-result">
        {t.result(euros.format(amount))}
      </p>
      <p className="text-sm text-muted">{t.note}</p>
    </Card>
  );
}
