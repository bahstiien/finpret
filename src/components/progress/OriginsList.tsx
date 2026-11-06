"use client";

import Link from "next/link";
import { useState } from "react";
import { Flag } from "@/components/menu/Flag";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";
import { formatAbbr } from "@/lib/dates";
import type { Flag as FlagData } from "@/server/menu-view";

const t = fr.progress.passport;
const VISIBLE = 5;

export type OriginItem = {
  code: string;
  label: string;
  flag: FlagData;
  since: string;
  recipes: number;
  isNew: boolean;
};

/** Origines cuisinées, de la plus récente à la plus ancienne (maquette Nos progrès), et l'action qui fait varier. */
export function OriginsList({ origins }: { origins: OriginItem[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? origins : origins.slice(0, VISIBLE);
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="origins-list">
      {origins.length > 0 ? (
        <>
          <ul id="origins-rows" aria-label={t.originsList} className="m-0 list-none p-0">
            {shown.map((o) => (
              <li key={o.code} className="row">
                <span className="flex size-8 flex-none items-center justify-center text-2xl">
                  <Flag flag={o.flag} />
                </span>
                <div className="row-main">
                  <p className="t-ui">{o.label}</p>
                  <p className="mono t-small">{t.originSince(formatAbbr(o.since), o.recipes)}</p>
                </div>
                {o.isNew && <span className="pill tone-banane">{t.newBadge}</span>}
              </li>
            ))}
          </ul>
          {origins.length > VISIBLE && (
            <button
              type="button"
              className="btn btn--ghost btn--sm self-start !pl-0"
              aria-expanded={open}
              aria-controls="origins-rows"
              onClick={() => setOpen((v) => !v)}
            >
              <span>{open ? t.seeLess : t.originsMore(origins.length - VISIBLE)}</span>
              {!open && <Icon name="chevronDown" className="size-4" />}
            </button>
          )}
        </>
      ) : (
        <div className="empty">
          <p className="t-ui">{t.originsEmptyTitle}</p>
          <p className="t-small">{t.originsEmpty}</p>
        </div>
      )}
      <Link href="/app/discover" className="btn btn--primary btn--block">
        <Icon name="search" />
        <span>{t.discoverOrigin}</span>
      </Link>
    </div>
  );
}
