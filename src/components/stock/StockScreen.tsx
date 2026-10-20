"use client";

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
  const roundBtn =
    "grid size-11 shrink-0 place-items-center rounded-full text-xl font-bold disabled:opacity-40";

  return (
    <>
      <h1 className="text-4xl font-black">{fr.nav.stock}</h1>

      {FEATURES.freezerAndLeftovers && week && canEdit && (!week.pantryDone || week.doublesToBank) && (
        <section className="flex flex-col gap-3 rounded-card bg-yellow-soft p-5">
          <h2 className="text-lg font-extrabold">{t.afterSession(week.start)}</h2>
          <p className="text-sm text-muted">{t.afterSessionHint}</p>
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
        </section>
      )}

      {FEATURES.freezerAndLeftovers && (
        <section
          className="flex flex-col gap-3 rounded-card bg-green-soft p-5 text-ink"
          data-testid="freezer"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-extrabold text-green-ink">{t.freezer}</h2>
            <span className="font-display text-xl font-black text-green-ink">{t.meals(total)}</span>
          </div>
          {freezer.length === 0 && <p className="text-sm text-muted">{t.freezerEmpty}</p>}
          <ul className="flex flex-col gap-2">
            {freezer.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-surface/60 p-3">
                <div className="min-w-0 flex-1">
                  <b className="block leading-tight">
                    <Flag flag={f.flag} />
                    {f.name}
                  </b>
                  <span className={`text-sm ${f.tooLong ? "font-semibold text-peach-ink" : "text-muted"}`}>
                    {f.tooLong ? t.tooLong(f.weeks) : t.frozenOn(f.frozenAt)}
                  </span>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t.less(f.name)}
                      disabled={pending}
                      onClick={() => run(() => adjustFreezer(f.id, -1))}
                      className={`${roundBtn} bg-nav text-on-nav`}
                    >
                      −
                    </button>
                    <output className="w-6 text-center font-display text-lg font-black">{f.portions}</output>
                    <button
                      type="button"
                      aria-label={t.more(f.name)}
                      disabled={pending}
                      onClick={() => run(() => adjustFreezer(f.id, 1))}
                      className={`${roundBtn} bg-green-strong text-white`}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="font-display text-lg font-black">{f.portions}</span>
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
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-card bg-surface p-5" data-testid="pantry">
        <h2 className="text-xl font-extrabold">{t.pantry}</h2>
        {pantry.length === 0 && <p className="text-sm text-muted">{t.pantryEmpty}</p>}
        <ul className="flex flex-col divide-y divide-line">
          {pantry.map((p) => (
            <li
              key={p.key}
              className="flex flex-wrap items-center gap-3 py-3"
              data-testid={`pantry-${p.key}`}
            >
              <div className="min-w-40 flex-1">
                <b>
                  {p.label} : {p.display}
                </b>
                {p.usedText && (
                  <p
                    className={`text-sm font-semibold ${p.missingText ? "text-peach-ink" : "text-green-ink"}`}
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
                        className={`${roundBtn} bg-chip`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        aria-label={t.more(p.label)}
                        disabled={pending}
                        onClick={() => run(() => setPantry(p.key, round(p.unit, p.qty! + p.step)))}
                        className={`${roundBtn} bg-chip`}
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
                    className={`min-h-11 rounded-pill px-3 text-sm font-bold ${p.qty === null ? "bg-green-soft text-green-ink" : "bg-chip"}`}
                  >
                    {t.enough}
                  </button>
                  <button
                    type="button"
                    aria-label={t.remove(p.label)}
                    disabled={pending}
                    onClick={() => run(() => setPantry(p.key, "remove"))}
                    className={`${roundBtn} hover:bg-chip`}
                  >
                    <Icon name="close" className="size-5" />
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
      </section>
    </>
  );
}
