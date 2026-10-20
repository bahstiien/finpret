"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fr } from "@/i18n/fr";
import {
  commitAdaptation,
  type PreviewData,
  previewAdaptation,
  undoAdaptation,
} from "@/server/actions/adaptation";

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

  if (candidates.length === 0 && history.length === 0) return null;

  const search = async () => {
    if (picked.size === 0) return toast(t.pickOne, "error");
    setBusy("search");
    setPreview(null);
    const res = await previewAdaptation({ weekId, ingredients: [...picked] });
    setBusy(null);
    if (!res.ok) return toast(res.error, "error");
    setPreview(res.data);
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

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4" data-testid="adaptation">
      {candidates.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={!online}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? fr.purchases.close : t.button}
        </Button>
      )}

      {open && (
        <div className="flex flex-col gap-3">
          <h2 className="font-extrabold">{t.title}</h2>
          <p className="text-sm text-muted">{t.intro}</p>
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">{t.title}</legend>
            {candidates.map((c) => (
              <label key={c.key} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-6 accent-green"
                  checked={picked.has(c.key)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(c.key);
                      else next.delete(c.key);
                      return next;
                    })
                  }
                />
                <span className="font-semibold">{c.label}</span>
              </label>
            ))}
          </fieldset>
          <Button type="button" className="self-start" disabled={busy !== null} onClick={() => void search()}>
            {busy === "search" ? t.searching : t.search}
          </Button>

          {preview && (
            <div className="flex flex-col gap-3" role="region" aria-label={t.title}>
              {preview.limited && <p className="text-sm font-semibold">{t.limited}</p>}
              {preview.proposals.length === 0 ? (
                <div role="status" className="flex flex-col gap-1">
                  <p className="font-semibold">{t.none}</p>
                  <p className="text-sm text-muted">{t.noneHint}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      {t.keepMenu}
                    </Button>
                    <Link
                      href="/app/discover"
                      className="inline-flex min-h-11 items-center rounded-pill bg-chip px-4 font-semibold"
                    >
                      {t.browseRecipes}
                    </Link>
                  </div>
                </div>
              ) : (
                preview.proposals.map((p, i) => (
                  <article key={i} className="flex flex-col gap-1 rounded-2xl bg-chip p-3">
                    <h3 className="font-extrabold">{t.resolves(p.resolved, p.total)}</h3>
                    <ul className="list-disc pl-5 text-sm">
                      {p.lines.map((l, j) => (
                        <li key={j}>
                          {t.replaces(l.from, l.to)}
                          {l.slots.length > 0 && <span className="text-muted"> ({l.slots.join(", ")})</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm">{p.extra.length ? t.extra(p.extra.join(", ")) : t.noExtra}</p>
                    {p.reused.length > 0 && <p className="text-sm">{t.reused(p.reused.join(", "))}</p>}
                    {p.remaining.length > 0 && (
                      <p className="text-sm">{t.remainingNote(p.remaining.join(", "))}</p>
                    )}
                    {p.durationDelta !== 0 && (
                      <p className="text-sm">
                        {p.durationDelta > 0 ? t.longer(p.durationDelta) : t.shorter(-p.durationDelta)}
                      </p>
                    )}
                    <Button
                      type="button"
                      className="mt-1 self-start"
                      disabled={busy !== null}
                      onClick={() => void apply(i)}
                    >
                      {busy === "apply" ? t.applying : t.apply}
                    </Button>
                  </article>
                ))
              )}
              {preview.excluded.length > 0 && (
                <ul className="text-sm text-muted">
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
        <div className="flex flex-col gap-1">
          <h2 className="font-extrabold">{t.history}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <span className={h.undone || h.kind === "undo" ? "text-muted" : ""}>
                  {h.lines.join(" · ")}
                </span>
                {h.kind === "apply" && h.undone && <span className="text-muted">({t.undone})</span>}
                {h.kind === "apply" && !h.undone && online && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void undo(h.id)}
                    className="min-h-11 rounded-pill bg-chip px-4 font-semibold"
                  >
                    {t.undo}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
