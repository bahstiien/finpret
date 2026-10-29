"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { fr } from "@/i18n/fr";

const t = fr.print;

type Cell = { tag: string | null; name: string; macros: string | null; guests: string; how: string } | null;

export type PrintData = {
  title: string;
  chips: string[];
  sunday: { label: string; text: string; thaw: string[] };
  days: { label: string; cake: string | null; meals: Cell[]; thaw: string[]; total: string | null }[];
  average: string;
  canteen: { name: string; days: number[]; menus: { day: string; text: string }[] }[];
  breakfasts: { sweet: Bread | null; savory: Bread | null };
  cake: { name: string; meta: string; ingredients: string[]; steps: string[] } | null;
};
type Bread = { id: string; name: string; description: string };

/** Hauteur utile d'une page A4 avec 10 mm de marges : 277 mm. */
const A4_HEIGHT_PX = 277 * 3.7795;

/** Feuille A4 (§8.6) : réduite automatiquement pour tenir sur une page, comme `fitSheet` du prototype. */
export function PrintSheet({ data }: { data: PrintData }) {
  const sheet = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const fit = () => {
      const el = sheet.current;
      if (!el) return;
      el.style.zoom = "1";
      const h = el.scrollHeight;
      el.style.zoom = h > A4_HEIGHT_PX ? Math.max(0.55, A4_HEIGHT_PX / h).toFixed(3) : "1";
    };
    fit();
    window.addEventListener("beforeprint", fit);
    return () => window.removeEventListener("beforeprint", fit);
  }, [data]);

  const thaw = (list: string[]) => (list.length ? list.map((x) => `☐ ${x}`).join("\n") : t.none);

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" onClick={() => window.print()}>
          {t.print}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.refresh()}>
          {t.otherBreakfasts}
        </Button>
        <Link href="/app" className="inline-flex min-h-11 items-center px-4 font-bold underline">
          {t.back}
        </Link>
      </div>

      <div ref={sheet} className="print-sheet" data-testid="print-sheet">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{data.title}</h1>
            <p className="text-xs">{t.lead}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {data.chips.map((c) => (
              <span
                key={c}
                className="rounded-r2 border border-current px-3 py-1 text-xs font-bold whitespace-nowrap"
              >
                {c}
              </span>
            ))}
          </div>
        </header>

        <table className="print-table">
          <colgroup>
            <col className="w-[11%]" />
            <col className="w-[29%]" />
            <col className="w-[29%]" />
            <col className="w-[16%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr>
              <th />
              <th scope="col">{t.lunch}</th>
              <th scope="col">{t.dinner}</th>
              <th scope="col">{t.thaw}</th>
              <th scope="col">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{data.sunday.label}</th>
              <td colSpan={2}>
                <b>{t.batch}</b> {data.sunday.text}
              </td>
              <td className="whitespace-pre-line">{thaw(data.sunday.thaw)}</td>
              <td />
            </tr>
            {data.days.map((d) => (
              <tr key={d.label}>
                <th scope="row">
                  {d.label}
                  {d.cake && <span className="block text-xs font-normal">{d.cake}</span>}
                </th>
                {d.meals.map((m, i) =>
                  m ? (
                    <td key={i}>
                      {m.tag && <span className="block text-xs">{m.tag}</span>}
                      <b className="block">{m.name}</b>
                      {m.macros && <span className="block text-xs">{m.macros}</span>}
                      <span className="block text-xs">{m.guests}</span>
                      <span className="block text-xs">{m.how}</span>
                    </td>
                  ) : (
                    <td key={i} className="text-muted">
                      {t.nothing}
                    </td>
                  ),
                )}
                <td className="whitespace-pre-line">{thaw(d.thaw)}</td>
                <td className="text-xs">{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-notes">
          <b>{t.notes}</b>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <b className="block">{t.average}</b>
            {data.average}
          </div>
          {data.canteen.map((c) => (
            <div key={c.name}>
              <b className="block">{t.canteen(c.name)}</b>
              {c.menus.length ? (
                c.menus.map((m) => (
                  <span key={m.day} className="block">
                    <b className="capitalize">{m.day}</b> : {m.text}
                  </span>
                ))
              ) : (
                <span>{t.noCanteen}</span>
              )}
            </div>
          ))}
          <div>
            <b className="block">{t.breakfasts}</b>
            {data.breakfasts.sweet && (
              <span className="block">
                <b>{t.sweet}</b> : {data.breakfasts.sweet.name}. {data.breakfasts.sweet.description}
              </span>
            )}
            {data.breakfasts.savory && (
              <span className="block">
                <b>{t.savory}</b> : {data.breakfasts.savory.name}. {data.breakfasts.savory.description}
              </span>
            )}
          </div>
          {data.cake && (
            <div className="col-span-2">
              <b className="block">
                {t.cake(data.cake.name)} ({data.cake.meta})
              </b>
              <span className="block">{data.cake.ingredients.join(" · ")}</span>
              <ol className="list-decimal pl-4">
                {data.cake.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
