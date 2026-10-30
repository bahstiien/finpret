"use client";

import { useState } from "react";
import { Segmented, Sheet, Stepper, Toggle } from "./index";
import { Button } from "./Button";

/** Démos interactives de la galerie du design system. */
export function InteractiveDemo() {
  const [view, setView] = useState<"week" | "day">("week");
  const [on, setOn] = useState(true);
  const [n, setN] = useState(4);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Affichage"
        value={view}
        onChange={setView}
        options={[
          { value: "week", label: "Semaine" },
          { value: "day", label: "Jour" },
        ]}
      />
      <Toggle label="Rappels" hint="Une notification le samedi soir" checked={on} onChange={setOn} />
      <Stepper label="Convives" value={n} min={1} max={12} onChange={setN} />
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Ouvrir une feuille
        </Button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Exemple de feuille">
          <p className="text-muted">Une feuille modale : Échap ou le fond pour fermer.</p>
        </Sheet>
      </div>
    </div>
  );
}
