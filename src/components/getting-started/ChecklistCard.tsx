"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checklist, type ChecklistItem } from "@/components/ui/Checklist";
import { useToast } from "@/components/ui/Toast";
import { STEPS, type StepKey } from "@/engine/getting-started";
import { fr } from "@/i18n/fr";
import { chooseSoloAction, dismissChecklistAction, restartChecklistAction } from "@/server/actions/getting-started";
import { prepareWeekAction } from "@/server/actions/menu";

const t = fr.gettingStarted.checklist;
const STORAGE_KEY = "fp_checklist_collapsed";

export type ChecklistCardData = {
  mode: "card" | "success";
  done: Record<StepKey, boolean>;
  doneCount: number;
  total: number;
  next: StepKey | null;
  autoCollapsed: boolean;
  /** Seul l'administrateur envoie des invitations (SPEC §3). */
  isAdmin: boolean;
  sessionStarted: boolean;
  /** Début de la semaine suivante si elle peut être préparée maintenant. */
  prepareNextStart: string | null;
  /** Une autre carte d'aide est affichée (Tile de la veille) : la checklist se réduit à son en-tête. */
  forceCollapsed: boolean;
};

const HREF: Partial<Record<StepKey, string>> = {
  adjust_meal: "/app#plats",
  invite: "/settings/household",
  shop: "/app/shopping",
  start_session: "/app/session",
  finish_session: "/app/session",
};

/** Carte « Ta première semaine » : état calculé côté serveur, aucune logique métier ici (CLAUDE.md, règle 4). */
export function ChecklistCard({ data }: { data: ChecklistCardData }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [stored, setStored] = useState<boolean | null>(null);
  useEffect(() => {
    // Réduction : commodité par appareil ; sans stockage, la carte reste développée.
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v !== null) setStored(v === "1");
    } catch {
      /* stockage indisponible */
    }
  }, []);
  const collapsed = data.forceCollapsed || (stored ?? data.autoCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setStored(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
  };

  const dismiss = () =>
    start(async () => {
      await dismissChecklistAction();
      toast(t.dismissed, "info", { label: t.undo, onClick: () => void restartChecklistAction() });
    });

  if (data.mode === "success") {
    return (
      <Card tone="green" className="page-enter flex flex-col gap-3" data-testid="checklist-success">
        <h2 className="t-2">{t.success.title}</h2>
        <p>{t.success.text}</p>
        <div className="flex flex-wrap gap-2">
          {data.prepareNextStart && (
            <Button
              type="button"
              disabled={pending}
              onClick={() => start(async () => void (await prepareWeekAction(data.prepareNextStart!)))}
            >
              {t.success.next}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={pending} onClick={dismiss}>
            {t.success.close}
          </Button>
        </div>
      </Card>
    );
  }

  const items: ChecklistItem[] = STEPS.map((key) => {
    const s = t.steps[key];
    const done = data.done[key];
    const hint = "hint" in s ? s.hint : undefined;
    const cta = key === "finish_session" && data.sessionStarted ? t.steps.finish_session.ctaResume : "cta" in s ? s.cta : null;
    const variant = data.next === key ? "primary" : "outline";
    return {
      key,
      label: s.label,
      hint,
      done,
      doneLabel: t.done,
      optionalLabel: key === "invite" ? t.optional : undefined,
      actions:
        key === "invite" ? (
          <>
            {data.isAdmin && (
              <LinkButton href={HREF.invite!} variant="outline" size="sm">
                {t.steps.invite.cta}
              </LinkButton>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await chooseSoloAction();
                  toast(t.soloDone);
                })
              }
            >
              {t.steps.invite.solo}
            </Button>
          </>
        ) : cta && HREF[key] ? (
          <LinkButton href={HREF[key]!} variant={variant} size="sm">
            {cta}
          </LinkButton>
        ) : undefined,
    };
  });

  return (
    <Checklist
      title={t.title}
      subtitle={t.subtitle}
      progressText={t.progress(data.doneCount, data.total)}
      progressLabel={t.progressLabel(data.doneCount, data.total)}
      value={(data.doneCount / data.total) * 100}
      items={items}
      collapsed={collapsed}
      onToggle={toggle}
      toggleLabel={collapsed ? t.expand : t.collapse}
      footer={
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={dismiss} className="self-start">
          {t.dismiss}
        </Button>
      }
    />
  );
}
