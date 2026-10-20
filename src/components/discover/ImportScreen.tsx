"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ChipToggle, Toggle } from "@/components/ui/Controls";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { CAKE_TYPES, PROTEINS, UNITS } from "@/engine/catalog/schema";
import { quality } from "@/engine/import/classify";
import { draftToForm, EMPTY_DRAFT, type ImportForm } from "@/engine/import/to-recipe";
import { fr } from "@/i18n/fr";
import { analyzeImport, saveImport } from "@/server/actions/imports";

const t = fr.recipeImport;

type CatalogIngredient = { key: string; label: string; unit: (typeof UNITS)[number]; aisle: string };
type Line = ImportForm["lines"][number] & { uncertain: boolean; suggestions: string[] };

export function ImportScreen({
  initialUrl,
  edit,
  ingredients,
  aisles,
  origins,
}: {
  initialUrl: string;
  edit: { id: string; form: ImportForm } | null;
  ingredients: CatalogIngredient[];
  aisles: [string, string][];
  origins: [string, string][];
}) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [review, setReview] = useState<{
    importId: string | null;
    form: ImportForm;
    lines: Line[];
    servings: number | null;
    rewritten: boolean;
  } | null>(
    edit
      ? {
          importId: null,
          form: edit.form,
          lines: edit.form.lines.map((l) => ({ ...l, uncertain: false, suggestions: [] })),
          servings: 4,
          rewritten: false,
        }
      : null,
  );
  const autoStarted = useRef(false);

  const analyze = (target: string) => {
    setError(null);
    start(async () => {
      const res = await analyzeImport(target);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { draft, importId, rewritten } = res.data;
      const form = draftToForm(draft);
      setReview({
        importId,
        form,
        servings: draft.servings,
        rewritten,
        lines: draft.lines.map((l, i) => ({
          ...form.lines[i]!,
          uncertain: l.uncertain,
          suggestions: l.candidates.map((c) => c.key),
        })),
      });
    });
  };

  // Partage depuis le téléphone : le lien arrive pré-rempli, la lecture démarre seule.
  useEffect(() => {
    if (initialUrl && !autoStarted.current) {
      autoStarted.current = true;
      analyze(initialUrl);
    }
  }, [initialUrl]);

  if (review) {
    return (
      <ReviewForm
        key={review.importId ?? edit?.id ?? "manual"}
        initial={review}
        editId={edit?.id ?? null}
        ingredients={ingredients}
        aisles={aisles}
        origins={origins}
      />
    );
  }

  const manual = () => {
    const form = draftToForm(EMPTY_DRAFT);
    setReview({ importId: null, form, lines: [], servings: 4, rewritten: false });
  };

  return (
    <section className="flex max-w-2xl flex-col gap-5" aria-labelledby="import-title">
      <h1 id="import-title" className="font-display text-3xl font-bold">
        {t.title}
      </h1>
      <p className="text-muted">{t.lead}</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          analyze(url);
        }}
      >
        <TextField
          id="import-url"
          label={t.url}
          type="url"
          inputMode="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !url.trim()}>
            {pending ? t.analyzing : t.analyze}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                setUrl((await navigator.clipboard.readText()).trim());
              } catch {
                // Presse-papiers refusé : l'utilisateur colle à la main.
              }
            }}
          >
            {t.paste}
          </Button>
          <Button type="button" variant="outline" onClick={manual}>
            {t.manual}
          </Button>
        </div>
        <p aria-live="polite" role="status" className="sr-only">
          {pending ? t.analyzing : ""}
        </p>
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </form>
    </section>
  );
}

function ReviewForm({
  initial,
  editId,
  ingredients,
  aisles,
  origins,
}: {
  initial: { importId: string | null; form: ImportForm; lines: Line[]; servings: number | null; rewritten: boolean };
  editId: string | null;
  ingredients: CatalogIngredient[];
  aisles: [string, string][];
  origins: [string, string][];
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<ImportForm>(initial.form);
  const [lines, setLines] = useState<Line[]>(initial.lines);
  const [servings, setServings] = useState<number | null>(initial.servings);
  const [askServings, setAskServings] = useState(initial.servings === null);
  const [askValue, setAskValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byKey = new Map(ingredients.map((i) => [i.key, i]));

  const set = <K extends keyof ImportForm>(k: K, v: ImportForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const q = quality(lines.map((l) => ({ key: l.key, toTaste: l.toTaste, uncertain: l.uncertain })));

  const submit = (plan: boolean) => {
    setError(null);
    start(async () => {
      const res = await saveImport({
        importId: initial.importId,
        editId,
        plan,
        form: {
          ...form,
          lines: lines.map((l) => ({
            original: l.original,
            key: l.key,
            label: l.label,
            qty: l.qty,
            unit: l.unit,
            aisle: l.aisle,
            toTaste: l.toTaste,
          })),
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast(res.data.message);
      router.push(`/app/discover?open=${res.data.id}${plan ? "&plan=1" : ""}`);
    });
  };

  const scaleTo4 = () => {
    const n = Number(askValue.replace(",", "."));
    if (!(n > 0 && n <= 50)) return;
    setLines((ls) => ls.map((l) => (l.qty === null ? l : { ...l, qty: Math.round(((l.qty * 4) / n) * 10) / 10 })));
    setServings(n);
    setAskServings(false);
  };

  const months = form.months ?? [];
  const isBatch = form.kind === "main" || form.kind === "soup";

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      aria-labelledby="review-title"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <header className="flex flex-col gap-2">
        <h1 id="review-title" className="font-display text-3xl font-bold">
          {t.review}
        </h1>
        {form.sourceUrl && (
          <p className="text-muted">
            {fr.discover.source(form.sourceName ?? "")} ·{" "}
            <a href={form.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
              {t.sourceLink}
            </a>
          </p>
        )}
        {lines.length > 0 && (
          <p className="font-semibold" data-testid="import-quality">
            {t.quality(q.matched, q.total)}
          </p>
        )}
        {servings !== null && servings !== 4 && form.kind !== "cake" && !editId && (
          <p className="text-sm text-muted">{t.servingsFrom(servings)}</p>
        )}
      </header>

      {askServings && lines.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-card bg-banana/30 p-4">
          <TextField
            id="servings"
            label={t.servingsAsk}
            inputMode="decimal"
            value={askValue}
            onChange={(e) => setAskValue(e.target.value)}
          />
          <Button type="button" variant="dark" onClick={scaleTo4}>
            {t.servingsApply}
          </Button>
        </div>
      )}

      <TextField id="name" label={t.name} required value={form.name} onChange={(e) => set("name", e.target.value)} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xl font-bold">{t.ingredients}</legend>
        <ul className="flex flex-col gap-3">
          {lines.map((l, i) => {
            const isNew = !l.key;
            return (
              <li
                key={i}
                data-uncertain={l.uncertain || undefined}
                className={`flex flex-col gap-2 rounded-card p-4 ${l.uncertain ? "border-2 border-banana bg-banana/20" : "bg-surface"}`}
              >
                {l.original && <p className="text-sm text-muted">{t.original(l.original)}</p>}
                {l.uncertain && <p className="text-xs font-bold text-ink uppercase">{t.uncertain}</p>}
                <div className="grid gap-2 min-[700px]:grid-cols-[2fr_1fr_1fr_auto]">
                  <SelectField
                    id={`ing-${i}`}
                    label={t.ingredient}
                    value={l.key ?? ""}
                    onChange={(e) => {
                      const g = byKey.get(e.target.value);
                      setLine(i, g ? { key: g.key, label: g.label, unit: g.unit, aisle: g.aisle, uncertain: false } : { key: null, uncertain: false });
                    }}
                  >
                    <option value="">{t.newIngredient}</option>
                    {l.suggestions.length > 0 && (
                      <optgroup label={t.suggestions}>
                        {l.suggestions.map((k) => (
                          <option key={k} value={k}>
                            {byKey.get(k)?.label ?? k}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={t.ingredients}>
                      {ingredients.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
                        </option>
                      ))}
                    </optgroup>
                  </SelectField>
                  <TextField
                    id={`qty-${i}`}
                    label={t.qty}
                    inputMode="decimal"
                    disabled={l.toTaste}
                    value={l.qty ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(",", ".");
                      setLine(i, { qty: v === "" ? null : Number(v), uncertain: false });
                    }}
                  />
                  <SelectField
                    id={`unit-${i}`}
                    label={t.unit}
                    value={l.unit}
                    disabled={!isNew}
                    onChange={(e) => setLine(i, { unit: e.target.value as Line["unit"] })}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </SelectField>
                  <button
                    type="button"
                    className="grid size-11 place-items-center self-end rounded-full hover:bg-chip"
                    aria-label={t.removeLine(l.label)}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                {isNew && (
                  <div className="grid gap-2 min-[700px]:grid-cols-2">
                    <TextField
                      id={`label-${i}`}
                      label={t.newIngredient}
                      value={l.label}
                      onChange={(e) => setLine(i, { label: e.target.value })}
                    />
                    <SelectField id={`aisle-${i}`} label={t.aisle} value={l.aisle} onChange={(e) => setLine(i, { aisle: e.target.value })}>
                      {aisles.map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}
                <Toggle label={t.toTaste} checked={l.toTaste} onChange={(v) => setLine(i, { toTaste: v, uncertain: false })} />
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() =>
            setLines((ls) => [
              ...ls,
              { original: "", key: null, label: "", qty: null, unit: "g", aisle: "divers", toTaste: false, uncertain: false, suggestions: [] },
            ])
          }
        >
          <Icon name="plus" /> {t.addLine}
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xl font-bold">{t.classify}</legend>
        <div className="grid gap-3 min-[700px]:grid-cols-3">
          <SelectField id="kind" label={t.kind} value={form.kind} onChange={(e) => set("kind", e.target.value as ImportForm["kind"])}>
            {(["main", "soup", "simple", "cake"] as const).map((k) => (
              <option key={k} value={k}>
                {t.kinds[k]}
              </option>
            ))}
          </SelectField>
          {form.kind !== "cake" && (
            <SelectField
              id="protein"
              label={t.protein}
              value={form.protein}
              onChange={(e) => set("protein", e.target.value as ImportForm["protein"])}
            >
              {PROTEINS.map((p) => (
                <option key={p} value={p}>
                  {t.proteins[p]}
                </option>
              ))}
            </SelectField>
          )}
          {form.kind !== "cake" && (
            <SelectField id="origin" label={t.origin} value={form.origin} onChange={(e) => set("origin", e.target.value)}>
              {origins.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </SelectField>
          )}
          {form.kind === "cake" && (
            <>
              <SelectField
                id="cake-type"
                label={t.cakeType}
                value={form.cakeType}
                onChange={(e) => set("cakeType", e.target.value as ImportForm["cakeType"])}
              >
                {CAKE_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t.cakeTypes[c]}
                  </option>
                ))}
              </SelectField>
              <NumberField id="parts" label={t.parts} value={form.parts} onChange={(v) => set("parts", v ?? 1)} />
            </>
          )}
          <NumberField id="prep" label={t.prepMin} value={form.prepMin} onChange={(v) => set("prepMin", v ?? 0)} />
          <NumberField id="cook" label={t.cookMin} value={form.cookMin} onChange={(v) => set("cookMin", v ?? 0)} />
          {isBatch && <NumberField id="fridge" label={t.fridge} value={form.fridge} onChange={(v) => set("fridge", v ?? 3)} />}
        </div>
        {form.kind !== "cake" && (
          <div className="grid gap-1 min-[700px]:grid-cols-2 min-[700px]:gap-x-8">
            <Toggle label={t.pasta} checked={form.pasta} onChange={(v) => set("pasta", v)} />
            <Toggle label={t.comfort} checked={form.comfort} onChange={(v) => set("comfort", v)} />
            {isBatch && <Toggle label={t.oven} checked={form.oven} onChange={(v) => set("oven", v)} />}
            {isBatch && <Toggle label={t.freeze} checked={form.freeze} onChange={(v) => set("freeze", v)} />}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t.months}</span>
          <div className="flex flex-wrap gap-2">
            <ChipToggle pressed={!form.months} onToggle={() => set("months", form.months ? null : [new Date().getMonth() + 1])}>
              {t.allYear}
            </ChipToggle>
            {form.months &&
              t.monthsShort.map((m, i) => (
                <ChipToggle
                  key={m}
                  pressed={months.includes(i + 1)}
                  onToggle={() => {
                    const next = months.includes(i + 1) ? months.filter((x) => x !== i + 1) : [...months, i + 1];
                    set("months", next.length ? next.sort((a, b) => a - b) : null);
                  }}
                >
                  {m}
                </ChipToggle>
              ))}
          </div>
        </div>
        <div className="grid gap-3 min-[700px]:grid-cols-2">
          <p className="text-sm font-semibold min-[700px]:col-span-2">{t.macros}</p>
          <NumberField id="kcal" label={t.kcal} value={form.kcal} onChange={(v) => set("kcal", v)} />
          <NumberField id="protein-g" label={t.proteinG} value={form.proteinG} onChange={(v) => set("proteinG", v)} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-xl font-bold">{t.steps}</legend>
        <p className="text-sm text-muted">{initial.rewritten ? t.stepsRewritten : t.stepsLead}</p>
        <ol className="flex flex-col gap-3">
          {form.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <label htmlFor={`step-${i}`} className="sr-only">
                {t.stepLabel(i + 1)}
              </label>
              <span aria-hidden="true" className="mt-3 w-6 shrink-0 font-bold">
                {i + 1}.
              </span>
              <textarea
                id={`step-${i}`}
                rows={2}
                value={s}
                onChange={(e) => set("steps", form.steps.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-4 py-2 focus:border-violet focus:outline-none"
              />
              <div className="flex flex-col">
                <StepButton label={t.moveUp(i + 1)} icon="▲" disabled={i === 0} onClick={() => set("steps", swap(form.steps, i, i - 1))} />
                <StepButton
                  label={t.moveDown(i + 1)}
                  icon="▼"
                  disabled={i === form.steps.length - 1}
                  onClick={() => set("steps", swap(form.steps, i, i + 1))}
                />
                <StepButton label={t.removeStep(i + 1)} icon="✕" onClick={() => set("steps", form.steps.filter((_, j) => j !== i))} />
              </div>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" className="self-start" onClick={() => set("steps", [...form.steps, ""])}>
          <Icon name="plus" /> {t.addStep}
        </Button>
      </fieldset>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {editId ? t.update : t.save}
        </Button>
        {!editId && (
          <Button type="button" variant="dark" disabled={pending} onClick={() => submit(true)}>
            {t.saveAndPlan}
          </Button>
        )}
        <Link href="/app/discover" className="inline-flex min-h-11 items-center px-4 font-bold underline">
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}

const swap = <T,>(list: T[], a: number, b: number) => {
  const next = [...list];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
};

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <TextField
      id={id}
      label={label}
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value.trim();
        onChange(v === "" || Number.isNaN(Number(v)) ? null : Math.round(Number(v)));
      }}
    />
  );
}

function StepButton({ label, icon, disabled, onClick }: { label: string; icon: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-sm hover:bg-chip disabled:opacity-30"
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
