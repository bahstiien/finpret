"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Bento, Sticker } from "@/components/ui/Extras";
import { Icon } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Layout";
import { useToast } from "@/components/ui/Toast";
import { fr } from "@/i18n/fr";
import {
  commitAdaptation,
  type PreviewData,
  previewAdaptation,
  undoAdaptation,
} from "@/server/actions/adaptation";
import { Card } from "@/components/ui/Card";

const t = fr.purchases.adapt;

export type AdaptationHistoryItem = {
  id: string;
  /** « Poulet curry → Chili sin carne », une ligne par préparation. */
  lines: string[];
  undone: boolean;
  kind: "apply" | "undo";
};

/**
 * « Adapter mon menu » (§8.5) : choisir des manques, voir les propositions et leur impact, puis confirmer.
 * Rien ne change avant « Appliquer ces changements ». Un aperçu est lié à la version affichée : si le foyer a
 * changé, le serveur refuse et demande un aperçu actualisé.
 */
export function AdaptationPanel({
  weekId,
  candidates,
  history,
  online,
}: {
  weekId: string;
  candidates: { key: string; label: string }[];
  history: AdaptationHistoryItem[];
  online: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.map((c) => c.key)));
  const [busy, setBusy] = useState<"search" | "apply" | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [sel, setSel] = useState(0);

  if (candidates.length === 0 && history.length === 0) return null;

  const search = async () => {
    if (picked.size === 0) return toast(t.pickOne, "error");
    setBusy("search");
    setPreview(null);
    const res = await previewAdaptation({ weekId, ingredients: [...picked] });
    setBusy(null);
    if (!res.ok) return toast(res.error, "error");
    setPreview(res.data);
    setSel(0);
  };

  const apply = async (index: number) => {
    if (!preview) return;
    setBusy("apply");
    const res = await commitAdaptation({
      previewId: preview.previewId,
      proposalIndex: index,
      opKey: crypto.randomUUID(),
    });
    setBusy(null);
    if (!res.ok) {
      toast(res.error, "error");
      // Aperçu périmé : on le retire, l'utilisateur relance la recherche sur l'état actuel.
      setPreview(null);
      router.refresh();
      return;
    }
    toast(res.data.message);
    setPreview(null);
    setOpen(false);
    router.refresh();
  };

  const undo = async (id: string) => {
    setBusy("apply");
    const res = await undoAdaptation({ eventId: id, opKey: crypto.randomUUID() });
    setBusy(null);
    toast(res.ok ? res.data.message : res.error, res.ok ? undefined : "error");
    router.refresh();
  };

  const chosen = preview ? preview.proposals[Math.min(sel, preview.proposals.length - 1)] : undefined;
  const chosenIndex = preview && chosen ? preview.proposals.indexOf(chosen) : 0;
  const letter = (i: number) => String.fromCharCode(65 + i);
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

  return (
    <Card id="adaptation" className="flex flex-col gap-5" data-testid="adaptation">
      {candidates.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          aria-expanded={open}
          disabled={!online}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? fr.purchases.close : t.button}
        </Button>
      )}

      {open && (
        <div className="flex flex-col gap-5">
          <div className="ph">
            <div className="flex flex-col gap-2">
              <p className="t-kicker">{t.kicker}</p>
              <h2 className="t-2">{t.title}</h2>
            </div>
            <Sticker tone="violet">{t.max}</Sticker>
          </div>

          {/* 1. Manques */}
          <section aria-labelledby="adapt-missing" className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5">
              <span className="sh-tag">1</span>
              <h3 id="adapt-missing" className="t-3">
                {t.stepMissing}
              </h3>
            </div>
            <p className="t-small muted">{t.intro}</p>
            <div role="group" aria-label={t.missingGroup} className="flex flex-wrap gap-2.5">
              {candidates.map((c) => {
                const on = picked.has(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    className="chiptg"
                    onClick={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(c.key);
                        else next.add(c.key);
                        return next;
                      })
                    }
                  >
                    {on && <Icon name="check" />}
                    {c.label}
                  </button>
                );
              })}
            </div>
            <Button type="button" className="self-start" disabled={busy !== null} onClick={() => void search()}>
              {busy === "search" ? t.searching : t.search}
            </Button>
          </section>

          {preview && (
            <div className="flex flex-col gap-5" role="region" aria-label={t.title}>
              {preview.limited && <Callout tone="warning">{t.limited}</Callout>}
              {preview.proposals.length === 0 ? (
                <div role="status" className="flex flex-col gap-1">
                  <p className="t-ui">{t.none}</p>
                  <p className="t-small muted">{t.noneHint}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      {t.keepMenu}
                    </Button>
                    <Link href="/app/discover" className="btn btn--outline btn--sm">
                      {t.browseRecipes}
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* 2. Propositions */}
                  <section aria-labelledby="adapt-props" className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="sh-tag">2</span>
                      <h3 id="adapt-props" className="t-3">
                        {t.stepProposals}
                      </h3>
                    </div>
                    <div role="radiogroup" aria-label={t.pickProposal} className="grid gap-3.5 min-[900px]:grid-cols-3">
                      {preview.proposals.map((p, i) => {
                        const on = i === chosenIndex;
                        return (
                          <button
                            key={i}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setSel(i)}
                            className={`card flex cursor-pointer flex-col gap-3 text-left ${on ? "tone-sel" : ""}`}
                            style={
                              on
                                ? { transform: "translate(var(--off-sm), var(--off-sm))", boxShadow: "var(--sh-sm)" }
                                : undefined
                            }
                          >
                            <span className="flex items-center justify-between">
                              <span className="t-kicker">{t.proposal(letter(i))}</span>
                              {on && <Icon name="check" />}
                            </span>
                            <span className="t-3">{t.resolves(p.resolved, p.total)}</span>
                            <Bento columns={3} className="w-full">
                              <span className="block p-2">
                                <span className="t-kicker block">{t.statMissing}</span>
                                <span className="mono text-xl font-bold">
                                  {p.resolved}/{p.total}
                                </span>
                              </span>
                              <span className="block p-2">
                                <span className="t-kicker block">{t.statExtra}</span>
                                <span className="mono text-xl font-bold">+{p.extra.length}</span>
                              </span>
                              <span className="block p-2">
                                <span className="t-kicker block">{t.statDuration}</span>
                                <span className="mono text-xl font-bold">{signed(p.durationDelta)}</span>
                              </span>
                            </Bento>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* 3. Avant / après */}
                  {chosen && (
                    <section aria-labelledby="adapt-diff" className="flex flex-col gap-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="sh-tag">3</span>
                        <h3 id="adapt-diff" className="t-3">
                          {t.stepCompare}
                        </h3>
                        <span className="t-kicker ml-auto">{t.proposal(letter(chosenIndex))}</span>
                      </div>
                      <div className="grid gap-[var(--bw)] border-[length:var(--bw)] border-line bg-line shadow-[var(--sh)] sm:grid-cols-2">
                        <div className="flex flex-col bg-surface">
                          <p className="t-kicker tone-chip border-b-[length:var(--bw)] border-line px-3 py-2.5">
                            {t.before}
                          </p>
                          <ul className="flex flex-col">
                            {chosen.lines.map((l, j) => (
                              <li key={j} className="flex flex-col gap-1.5 border-b-[length:var(--bw)] border-line p-3">
                                {l.slots.length > 0 && <p className="t-label mono">{l.slots.join(", ")}</p>}
                                <p className="t-3 line-through decoration-2">{l.from}</p>
                              </li>
                            ))}
                          </ul>
                          {chosen.remaining.length > 0 && (
                            <p className="p-3">
                              <span className="pill tone-alerte">{t.remainingNote(chosen.remaining.join(", "))}</span>
                            </p>
                          )}
                        </div>
                        <div className="tone-menu flex flex-col">
                          <p className="t-kicker tone-dark border-b-[length:var(--bw)] border-line px-3 py-2.5">
                            {t.after}
                          </p>
                          <ul className="flex flex-col">
                            {chosen.lines.map((l, j) => (
                              <li key={j} className="flex flex-col gap-1.5 border-b-[length:var(--bw)] border-line p-3">
                                {l.slots.length > 0 && <p className="t-label mono">{l.slots.join(", ")}</p>}
                                <p className="t-3">{t.replaces(l.from, l.to)}</p>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-auto flex flex-col gap-1 p-3">
                            <p className="text-sm">
                              {chosen.extra.length ? t.extra(chosen.extra.join(", ")) : t.noExtra}
                            </p>
                            {chosen.reused.length > 0 && (
                              <p className="text-sm">{t.reused(chosen.reused.join(", "))}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {chosen.durationDelta !== 0 && (
                        <p className="mono font-bold">
                          {chosen.durationDelta > 0 ? t.longer(chosen.durationDelta) : t.shorter(-chosen.durationDelta)}
                        </p>
                      )}
                      <p className="t-small muted">{t.untouched}</p>
                      <Button
                        type="button"
                        size="lg"
                        className="w-full"
                        disabled={busy !== null}
                        onClick={() => void apply(chosenIndex)}
                      >
                        <Icon name="check" />
                        {busy === "apply" ? t.applying : t.apply}
                      </Button>
                    </section>
                  )}
                </>
              )}
              {preview.excluded.length > 0 && (
                <ul className="t-small muted">
                  {preview.excluded.map((e, i) => (
                    <li key={i}>
                      {e.name} : {e.reason === "locked" ? t.locked : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section aria-labelledby="adapt-history" className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 pb-1.5">
            <h2 id="adapt-history" className="t-2">
              {t.history}
            </h2>
            <span className="t-kicker muted">{t.historyKicker}</span>
          </div>
          <ul className="flex flex-col text-sm">
            {history.map((h) => (
              <li key={h.id} className="row flex-wrap">
                <div className="row-main">
                  <p className={`t-ui ${h.undone || h.kind === "undo" ? "muted" : ""}`}>{h.lines.join(" · ")}</p>
                  {h.kind === "apply" && h.undone && <p className="t-small muted">({t.undone})</p>}
                </div>
                {h.kind === "apply" && !h.undone && online && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void undo(h.id)}
                    className="btn btn--outline btn--sm"
                  >
                    {t.undo}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
