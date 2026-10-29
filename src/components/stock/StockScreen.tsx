"use client";

import { PageHeader } from "@/components/ui/Layout";
import { useState } from "react";
import { Flag } from "@/components/menu/Flag";
import { useMenuAction } from "@/components/menu/useMenuAction";
import { IngredientPicker } from "@/components/settings/IngredientPicker";
import { FEATURES } from "@/lib/features";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import {
  addToFreezer,
  adjustFreezer,
  bankDoublesAction,
  setPantry,
  updatePantryAfterSession,
} from "@/server/actions/stock";
import type { Flag as FlagData } from "@/server/menu-view";
import { Card } from "@/components/ui/Card";

const t = fr.stock;

type FreezerRow = {
  id: string;
  name: string;
  flag: FlagData;
  portions: number;
  frozenAt: string;
  tooLong: boolean;
  weeks: number;
};
type PantryRow = {
  key: string;
  label: string;
  unit: string;
  qty: number | null;
  step: number;
  display: string;
  usedText: string | null;
  missingText: string | null;
};

const round = (unit: string, value: number) =>
  unit === "g" || unit === "ml" ? Math.round(value) : Math.round(value * 2) / 2;

/** Onglet Stock (§8.4) : réserve du congélateur, garde-manger, mise à jour après la session. */
export function StockScreen({
  canEdit,
  freezer,
  pantry,
  ingredients,
  freezable,
  week,
}: {
  canEdit: boolean;
  freezer: FreezerRow[];
  pantry: PantryRow[];
  ingredients: { key: string; label: string }[];
  freezable: { id: string; name: string }[];
  week: { id: string; start: string; pantryDone: boolean; doublesToBank: boolean } | null;
}) {
  const { run, pending } = useMenuAction();
  const [addRecipe, setAddRecipe] = useState("");
  const total = freezer.reduce((s, f) => s + f.portions, 0);
  return (
    <>
      <PageHeader title={fr.nav.stock} />

      {FEATURES.freezerAndLeftovers && week && canEdit && (!week.pantryDone || week.doublesToBank) && (
        <Card tone="banane" padding="cozy" className="flex flex-col gap-3">
          <h2 className="t-3">{t.afterSession(week.start)}</h2>
          <p className="text-sm">{t.afterSessionHint}</p>
          <div className="flex flex-wrap gap-2">
            {!week.pantryDone && (
              <Button
                type="button"
                disabled={pending}
                onClick={() => run(() => updatePantryAfterSession(week.id))}
              >
                {t.update}
              </Button>
            )}
            {week.doublesToBank && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => bankDoublesAction(week.id))}
              >
                {t.bankDoubles}
              </Button>
            )}
          </div>
        </Card>
      )}

      {FEATURES.freezerAndLeftovers && (
        <Card tone="blue" padding="cozy" className="flex flex-col gap-3" data-testid="freezer">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="t-2">{t.freezer}</h2>
            <span className="mono text-lg font-bold">{t.meals(total)}</span>
          </div>
          {freezer.length === 0 && <p className="text-sm font-bold">{t.freezerEmpty}</p>}
          <ul className="flex flex-col gap-2">
            {freezer.map((f) => (
              <li key={f.id} className="nb-sm flex items-center gap-3 bg-surface p-3 text-ink">
                <div className="min-w-0 flex-1">
                  <b className="block leading-tight">
                    <Flag flag={f.flag} />
                    {f.name}
                  </b>
                  {f.tooLong ? (
                    <span className="tone-peach nb-flat mt-1 inline-block px-2 py-0.5 text-sm font-bold">
                      {t.tooLong(f.weeks)}
                    </span>
                  ) : (
                    <span className="mono text-sm text-muted">{t.frozenOn(f.frozenAt)}</span>
                  )}
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t.less(f.name)}
                      disabled={pending}
                      onClick={() => run(() => adjustFreezer(f.id, -1))}
                      className="iconbtn iconbtn--dark text-xl font-bold"
                    >
                      −
                    </button>
                    <output className="num-l w-8 text-center">{f.portions}</output>
                    <button
                      type="button"
                      aria-label={t.more(f.name)}
                      disabled={pending}
                      onClick={() => run(() => adjustFreezer(f.id, 1))}
                      className="iconbtn iconbtn--banane text-xl font-bold"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="num-l">{f.portions}</span>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (addRecipe)
                  run(
                    () => addToFreezer(addRecipe, 2),
                    () => setAddRecipe(""),
                  );
              }}
            >
              <SelectField
                id="freezer-add"
                label={t.addDish}
                value={addRecipe}
                onChange={(e) => setAddRecipe(e.target.value)}
                className="w-full min-w-0 sm:w-auto sm:flex-1"
              >
                <option value="">{t.chooseDish}</option>
                {freezable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
              <Button type="submit" variant="dark" disabled={!addRecipe || pending}>
                <Icon name="snow" className="size-5" />
                {t.addTwo}
              </Button>
            </form>
          )}
        </Card>
      )}

      <Card padding="cozy" className="flex flex-col gap-3" data-testid="pantry">
        <h2 className="t-2">{t.pantry}</h2>
        {pantry.length === 0 && <p className="text-sm text-muted">{t.pantryEmpty}</p>}
        <ul className="flex flex-col">
          {pantry.map((p) => (
            <li
              key={p.key}
              className="row flex-wrap"
              data-testid={`pantry-${p.key}`}
            >
              <div className="min-w-40 flex-1">
                <b className="mono">
                  {p.label} : {p.display}
                </b>
                {p.usedText && (
                  <p
                    className={`nb-flat mt-1 inline-block px-2 py-0.5 text-sm font-bold ${p.missingText ? "tone-peach" : "tone-green"}`}
                  >
                    {p.missingText ? t.usesMissing(p.usedText, p.missingText) : t.usesOk(p.usedText)}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  {p.qty !== null && (
                    <>
                      <button
                        type="button"
                        aria-label={t.less(p.label)}
                        disabled={pending}
                        onClick={() =>
                          run(() => setPantry(p.key, round(p.unit, Math.max(0, p.qty! - p.step))))
                        }
                        className="iconbtn text-xl font-bold"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        aria-label={t.more(p.label)}
                        disabled={pending}
                        onClick={() => run(() => setPantry(p.key, round(p.unit, p.qty! + p.step)))}
                        className="iconbtn text-xl font-bold"
                      >
                        +
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-pressed={p.qty === null}
                    disabled={pending}
                    onClick={() => run(() => setPantry(p.key, p.qty === null ? p.step : null))}
                    className="chiptg"
                  >
                    {t.enough}
                  </button>
                  <button
                    type="button"
                    aria-label={t.remove(p.label)}
                    disabled={pending}
                    onClick={() => run(() => setPantry(p.key, "remove"))}
                    className="iconbtn iconbtn--ghost"
                  >
                    <Icon name="close" className="ic" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <IngredientPicker
            label={t.addIngredient}
            options={ingredients}
            selected={[]}
            onChange={(keys) => {
              const key = keys[0];
              if (key) run(() => setPantry(key, null));
            }}
          />
        )}
      </Card>
    </>
  );
}
