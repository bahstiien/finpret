"use client";

import { useState } from "react";
import { Checklist, Segmented, TipCoachmark, Sheet, Stepper, Toggle } from "./index";
import { Button } from "./Button";

/** Démos interactives de la galerie du design system. */
export function InteractiveDemo() {
  const [view, setView] = useState<"week" | "day">("week");
  const [on, setOn] = useState(true);
  const [n, setN] = useState(4);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tip, setTip] = useState(true);
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
      <Checklist
        title="Ta première semaine"
        subtitle="Chaque étape se coche toute seule quand tu la fais."
        progressText="2 sur 3"
        progressLabel="2 étapes sur 3 terminées"
        value={66}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        toggleLabel={collapsed ? "Développer la carte" : "Réduire la carte"}
        testId="gallery-checklist"
        items={[
          { key: "a", label: "Découvrir ton menu", done: true, doneLabel: "Fait" },
          { key: "b", label: "Ajuster un repas", done: true, doneLabel: "Fait" },
          {
            key: "c",
            label: "Cocher tes courses",
            hint: "Coche chaque article au fil du magasin.",
            done: false,
            doneLabel: "Fait",
            actions: <Button size="sm">Ouvrir ma liste</Button>,
          },
        ]}
      />
      {tip && (
        <TipCoachmark okLabel="Compris" closeLabel="Fermer le conseil" regionLabel="Conseil" onDismiss={() => setTip(false)}>
          Ta liste est rangée par rayon. Coche en magasin : la liste se met à jour en direct.
        </TipCoachmark>
      )}
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
