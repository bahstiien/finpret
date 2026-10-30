"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { baseAisle, guessAisle, shoppingText } from "@/engine/shopping";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { enqueue, loadQueue, type NewItem, type QueuedOp, saveQueue } from "@/lib/offline-queue";
import { useHouseholdEvents } from "@/lib/use-household-events";
import { applyShoppingOp, listShoppingItems } from "@/server/actions/shopping-sync";
import { useRouter } from "next/navigation";
import { recordWeekEvent } from "@/server/actions/events";
import {
  clearShoppingIssue,
  trackReviewCompleted,
  confirmCoverage,
  recordPurchase,
  reportShoppingIssue,
  setPurchasedTotal,
} from "@/server/actions/purchases";
import { reviewSummary } from "@/engine/purchases";
import type { PurchaseLine } from "@/server/purchases-view";
import { AdaptationPanel, type AdaptationHistoryItem } from "./AdaptationPanel";
import { type PreparationItem, type TransferChoice, WeekOpsPanel } from "./WeekOpsPanel";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.shopping;
const tp = fr.purchases;

type Item = {
  id: string;
  source: "menu" | "pantry_check" | "manual";
  ingredient_key: string | null;
  label: string | null;
  qty_text: string | null;
  aisle: string;
  checked: boolean;
  added_by: string | null;
  updated_at: string;
};

/**
 * Liste de courses (§8.3) : temps réel (flux SSE de /api/realtime, moins de 2 s), coches article par article,
 * hors ligne avec file rejouée au retour du réseau.
 */
export function ShoppingScreen({
  householdId,
  weekId,
  title,
  userId,
  initialItems,
  ingredientLabels,
  aisles,
  names,
  baseUsed,
  frequent,
  exportFormat,
  purchases,
  canWrite,
  adaptationHistory,
  preparations,
  transfers,
  otherWeeks,
}: {
  preparations: PreparationItem[];
  transfers: TransferChoice[];
  otherWeeks: { id: string; label: string }[];
  adaptationHistory: AdaptationHistoryItem[];
  purchases: { lines: Record<string, PurchaseLine>; revision: number } | null;
  canWrite: boolean;
  householdId: string;
  weekId: string;
  title: string;
  userId: string;
  initialItems: Item[];
  ingredientLabels: Record<string, string>;
  aisles: { key: string; label: string }[];
  names: Record<string, string>;
  baseUsed: { key: string; label: string; qty: string }[];
  frequent: string[];
  exportFormat: "text" | "checklist";
}) {
  const toast = useToast();
  const [items, setItems] = useState<Map<string, Item>>(() => new Map(initialItems.map((i) => [i.id, i])));
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState("");
  const router = useRouter();
  const hasPurchases = purchases !== null;
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState<"total" | "add">("total");
  const [pQty, setPQty] = useState("");
  const [pUnit, setPUnit] = useState("g");
  const [busy, setBusy] = useState(false);
  const [issueFor, setIssueFor] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const queue = useRef<QueuedOp[]>([]);
  const flushing = useRef(false);
  const checkedSent = useRef(false);

  const apply = useCallback(
    (op: QueuedOp) => {
      setItems((prev) => {
        const next = new Map(prev);
        if (op.op === "check") {
          const it = next.get(op.id);
          if (it) next.set(op.id, { ...it, checked: op.checked });
        } else if (op.op === "delete") next.delete(op.id);
        else
          next.set(op.item.id, {
            ...op.item,
            checked: false,
            added_by: userId,
            updated_at: new Date().toISOString(),
          });
        return next;
      });
    },
    [userId],
  );

  const send = useCallback(async (op: QueuedOp) => {
    // Une erreur de droits ou de données n'est pas rejouée ; seule une coupure réseau (l'appel échoue) garde l'opération.
    return applyShoppingOp(op).catch(() => "failed" as const);
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      while (queue.current.length) {
        const op = queue.current[0]!;
        const res = await send(op);
        if (res === "failed") break;
        queue.current = queue.current.slice(1);
        saveQueue(weekId, queue.current);
        setPending(queue.current.length);
      }
    } finally {
      flushing.current = false;
    }
  }, [send, weekId]);

  const run = useCallback(
    (op: QueuedOp) => {
      // Écriture hors ligne REPORTÉE (SPEC_JANVIER) : la liste reste consultable, les modifications attendent le réseau.
      if (!FEATURES.offlineWrites && !navigator.onLine) return toast(t.offlineReadOnly, "error");
      if (op.op === "check" && op.checked && !checkedSent.current) {
        checkedSent.current = true;
        void recordWeekEvent("shopping_checked", weekId);
      }
      apply(op);
      queue.current = enqueue(queue.current, op);
      saveQueue(weekId, queue.current);
      setPending(queue.current.length);
      void flush();
    },
    [apply, flush, weekId, toast],
  );

  // Relit la liste (changement signalé, coupure, reconnexion du flux) ; les coches locales encore en attente
  // restent prioritaires. Les relectures demandées en rafale sont regroupées.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(async () => {
    const data = await listShoppingItems(weekId).catch(() => null);
    if (!data) return;
    setItems(() => {
      const next = new Map(data.map((row) => [row.id, row as Item]));
      for (const op of queue.current) {
        if (op.op === "check" && next.has(op.id))
          next.set(op.id, { ...next.get(op.id)!, checked: op.checked });
        if (op.op === "delete") next.delete(op.id);
        if (op.op === "add" && !next.has(op.item.id)) {
          next.set(op.item.id, { ...op.item, checked: false, added_by: userId, updated_at: "" });
        }
      }
      return next;
    });
  }, [weekId, userId]);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refresh(), 150);
  }, [refresh]);

  // Temps réel : articles de la semaine, et achats ou signalements du foyer (relus par le serveur).
  useHouseholdEvents(
    householdId,
    (change) => {
      if (change.table === "shopping_items" && change.weekId === weekId) scheduleRefresh();
      else if (hasPurchases && (change.table === "purchase_events" || change.table === "shopping_issues"))
        router.refresh();
    },
    scheduleRefresh,
  );

  // File laissée par une visite précédente hors ligne, état réseau.
  useEffect(() => {
    queue.current = loadQueue(weekId);
    queue.current.forEach(apply);
    setPending(queue.current.length);
    setOnline(navigator.onLine);
    const up = async () => {
      setOnline(true);
      await flush();
      await refresh();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    void flush();
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [weekId, apply, flush, refresh]);

  const list = [...items.values()];
  const visible = list;
  const done = visible.filter((i) => i.checked).length;
  const nameOf = (i: Item) =>
    i.ingredient_key ? (ingredientLabels[i.ingredient_key] ?? i.label ?? i.ingredient_key) : (i.label ?? "");
  const groups = [...aisles, { key: "divers", label: t.other }]
    .filter((a, idx, arr) => arr.findIndex((x) => x.key === a.key) === idx)
    .map((a) => ({
      ...a,
      items: visible
        .filter((i) => i.aisle === a.key || (a.key === "divers" && !aisles.some((x) => x.key === i.aisle)))
        .sort((x, y) => Number(x.checked) - Number(y.checked) || nameOf(x).localeCompare(nameOf(y), "fr")),
    }))
    .filter((g) => g.items.length);

  const savePurchase = async (key: string, line: PurchaseLine) => {
    const qty = Number(pQty.replace(",", "."));
    if (!online) return toast(tp.offlineReadOnly, "error");
    if (!Number.isFinite(qty) || pQty.trim() === "") return toast(tp.INVALID_QUANTITY, "error");
    setBusy(true);
    const act = mode === "total" ? setPurchasedTotal : recordPurchase;
    const res = await act({
      weekId,
      ingredient: key,
      qty,
      unit: pUnit as never,
      expectedRevision: purchases?.revision,
      opKey: crypto.randomUUID(),
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error, "error");
      // Révision périmée : on recharge l'état avant de laisser réessayer.
      router.refresh();
      return;
    }
    toast(res.data.message);
    setEditing(null);
    setPQty("");
    void line;
    router.refresh();
  };

  /**
   * Coche d'une ligne gérée (§8.1) : une coche vaut « acheté ». Sans achat enregistré, elle enregistre la
   * quantité suggérée quand elle est fiable ; sinon elle ouvre la saisie et ne crée aucune quantité supposée.
   */
  const onCheck = async (i: Item, checked: boolean) => {
    const key = i.ingredient_key;
    const line = key ? purchases?.lines[key] : undefined;
    if (!purchases || !key || !line || !checked || !canWrite) return run({ op: "check", id: i.id, checked });
    if (line.bought !== null || line.status === "covered" || line.status === "surplus")
      return run({ op: "check", id: i.id, checked });
    if (line.suggestedQty === null) {
      setEditing(key);
      setMode("total");
      setPQty("");
      setPUnit(line.units[0]!);
      return;
    }
    if (!online) return toast(tp.offlineReadOnly, "error");
    const res = await recordPurchase({
      weekId,
      ingredient: key,
      qty: line.suggestedQty,
      unit: line.catalogUnit as never,
      expectedRevision: purchases.revision,
      opKey: crypto.randomUUID(),
    });
    if (!res.ok) {
      toast(res.error, "error");
      router.refresh();
      return;
    }
    run({ op: "check", id: i.id, checked: true });
    router.refresh();
  };

  const setIssue = async (key: string, decision: "open" | "search_elsewhere" | "no_more") => {
    if (!online) return toast(tp.offlineReadOnly, "error");
    const res = await reportShoppingIssue({ weekId, ingredient: key, decision });
    toast(res.ok ? res.data.message : res.error, res.ok ? undefined : "error");
    if (res.ok && decision === "open") setIssueFor(key);
    else setIssueFor(null);
    router.refresh();
  };

  const confirmAssez = async (key: string) => {
    if (!online) return toast(tp.offlineReadOnly, "error");
    const res = await confirmCoverage({ weekId, ingredient: key });
    toast(res.ok ? res.data.message : res.error, res.ok ? undefined : "error");
    router.refresh();
  };

  const clearIssue = async (key: string) => {
    const res = await clearShoppingIssue(weekId, key);
    toast(res.ok ? res.data.message : res.error, res.ok ? undefined : "error");
    setIssueFor(null);
    router.refresh();
  };

  const add = (name: string, quantity = "") => {
    const clean = name.trim();
    if (!clean) return;
    const existing = list.find(
      (i) => i.source === "manual" && (i.label ?? "").toLowerCase() === clean.toLowerCase(),
    );
    if (existing) {
      if (existing.checked) run({ op: "check", id: existing.id, checked: false });
      return;
    }
    const item: NewItem = {
      id: crypto.randomUUID(),
      household_id: householdId,
      week_id: weekId,
      source: "manual",
      ingredient_key: null,
      label: clean.charAt(0).toUpperCase() + clean.slice(1),
      qty_text: quantity.trim() || null,
      aisle: guessAisle(clean),
    };
    run({ op: "add", item });
  };

  const toggleBase = (b: { key: string; qty: string }) => {
    const row = list.find((i) => i.source === "pantry_check" && i.ingredient_key === b.key);
    if (row) run({ op: "delete", id: row.id });
    else
      run({
        op: "add",
        item: {
          id: crypto.randomUUID(),
          household_id: householdId,
          week_id: weekId,
          source: "pantry_check",
          ingredient_key: b.key,
          label: null,
          qty_text: b.qty || null,
          aisle: baseAisle(b.key),
        },
      });
  };

  const share = async () => {
    const { text, count } = shoppingText(
      title,
      visible.map((i) => ({
        aisle: i.aisle,
        text: [nameOf(i), i.qty_text].filter(Boolean).join(" "),
        checked: i.checked,
      })),
      aisles.map((a) => a.key),
      exportFormat === "checklist",
    );
    if (!count) return toast(t.nothingToShare);
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return toast(t.shared(count));
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast(t.copied(count));
    } catch {
      toast(t.copyFailed, "error");
    }
  };

  return (
    <>
      <header className="flex flex-col gap-3">
        <PageHeader
          title={fr.nav.shopping}
          actions={
            <button
              type="button"
              onClick={share}
              aria-label={t.share}
              className="grid size-12 place-items-center rounded-full bg-banana text-[#17151F]"
            >
              <Icon name="basket" />
            </button>
          }
        />
        <p className="font-semibold" data-testid="shopping-progress">
          {t.progress(done, visible.length)}
        </p>
        <div
          role="progressbar"
          aria-label={t.progress(done, visible.length)}
          aria-valuemin={0}
          aria-valuemax={visible.length}
          aria-valuenow={done}
          className="h-2 overflow-hidden rounded-pill bg-line"
        >
          <div
            className="h-full rounded-pill bg-[#FF6B8B] transition-all"
            style={{ width: `${visible.length ? (done / visible.length) * 100 : 0}%` }}
          />
        </div>
        {(!online || pending > 0) && (
          <p
            role="status"
            className="rounded-2xl bg-yellow-soft px-4 py-2 text-sm font-semibold"
            data-testid="offline"
          >
            {online ? t.syncing(pending) : FEATURES.offlineWrites ? t.offline(pending) : t.offlineReadOnly}
          </p>
        )}
      </header>

      <form
        className="flex flex-wrap gap-2 rounded-card bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          add(label, qty);
          setLabel("");
          setQty("");
        }}
      >
        <label htmlFor="item-label" className="sr-only">
          {t.addLabel}
        </label>
        <input
          id="item-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.addPlaceholder}
          maxLength={80}
          className="min-h-11 w-full min-w-0 rounded-2xl sm:w-auto sm:flex-[3] border-2 border-line bg-surface px-4 focus:border-violet focus:outline-none"
        />
        <label htmlFor="item-qty" className="sr-only">
          {t.qtyLabel}
        </label>
        <input
          id="item-qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={t.qtyPlaceholder}
          maxLength={30}
          className="min-h-11 w-24 min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-4 focus:border-violet focus:outline-none"
        />
        <Button type="submit">{t.add}</Button>
        {frequent.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 pt-1">
            {frequent.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => add(f)}
                className="min-h-9 rounded-pill bg-chip px-3 text-sm font-semibold"
              >
                + {f}
              </button>
            ))}
          </div>
        )}
      </form>

      {baseUsed.length > 0 && (
        <Card padding="sm" className="flex flex-col gap-2">
          <h2 className="font-extrabold">{t.base}</h2>
          <p className="text-sm text-muted">{t.baseHint}</p>
          <div className="flex flex-wrap gap-2">
            {baseUsed.map((b) => (
              <ChipToggle
                key={b.key}
                pressed={list.some((i) => i.source === "pantry_check" && i.ingredient_key === b.key)}
                onToggle={() => toggleBase(b)}
              >
                {b.label}
              </ChipToggle>
            ))}
          </div>
        </Card>
      )}

      {purchases && (
        <Card padding="sm" className="flex flex-col gap-2" data-testid="review">
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => {
              if (!reviewOpen) {
                const r = reviewSummary(
                  Object.entries(purchases.lines).map(([key, l]) => ({
                    key,
                    status: l.status,
                    issue: l.issue,
                  })),
                );
                void trackReviewCompleted(r.unresolved);
              }
              setReviewOpen((o) => !o);
            }}
          >
            {reviewOpen ? tp.close : tp.review}
          </Button>
          {reviewOpen && <ReviewPanel lines={purchases.lines} />}
        </Card>
      )}

      {purchases && canWrite && (
        <WeekOpsPanel
          weekId={weekId}
          online={online}
          preparations={preparations}
          transfers={transfers}
          otherWeeks={otherWeeks}
        />
      )}

      {purchases && canWrite && (
        <AdaptationPanel
          weekId={weekId}
          online={online}
          history={adaptationHistory}
          candidates={Object.entries(purchases.lines)
            .filter(([, l]) => l.status === "partial" || l.status === "uncovered")
            .map(([key]) => ({ key, label: ingredientLabels[key] ?? names[key] ?? key }))}
        />
      )}

      {groups.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        groups.map((g) => (
          <Card padding="sm" key={g.key} className="flex flex-col">
            <h2 className="flex items-center justify-between pb-2 font-extrabold">
              {g.label}
              <small className="font-semibold text-muted">
                {g.items.filter((i) => i.checked).length}/{g.items.length}
              </small>
            </h2>
            <ul className="flex flex-col divide-y divide-line">
              {g.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-1" data-testid="shopping-item">
                  <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={i.checked}
                      onChange={(e) => void onCheck(i, e.target.checked)}
                      className="size-6 shrink-0 accent-green"
                    />
                    <span className={`flex flex-col ${i.checked ? "text-muted line-through" : ""}`}>
                      <span className="font-semibold">{nameOf(i)}</span>
                      <span className="text-sm text-muted">
                        {[
                          i.qty_text,
                          i.source === "manual"
                            ? i.added_by === userId
                              ? t.addedByYou
                              : i.added_by && names[i.added_by]
                                ? t.addedBy(names[i.added_by]!)
                                : null
                            : i.source === "pantry_check"
                              ? t.fromPantry
                              : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                  {purchases && i.ingredient_key && purchases.lines[i.ingredient_key] && (
                    <PurchaseBlock
                      line={purchases.lines[i.ingredient_key]!}
                      name={nameOf(i)}
                      open={editing === i.ingredient_key}
                      canWrite={canWrite}
                      choosing={issueFor === i.ingredient_key}
                      onIssue={(d) => void setIssue(i.ingredient_key!, d)}
                      onReport={() => void setIssue(i.ingredient_key!, "open")}
                      onClear={() => void clearIssue(i.ingredient_key!)}
                      onConfirm={() => void confirmAssez(i.ingredient_key!)}
                      onOpen={() => {
                        const l = purchases.lines[i.ingredient_key!]!;
                        setEditing(i.ingredient_key);
                        setMode("total");
                        setPQty("");
                        setPUnit(l.units[0]!);
                      }}
                    />
                  )}
                  {purchases && i.ingredient_key && editing === i.ingredient_key && (
                    <form
                      className="flex w-full flex-col gap-2 rounded-2xl bg-chip p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void savePurchase(i.ingredient_key!, purchases.lines[i.ingredient_key!]!);
                      }}
                    >
                      <fieldset className="flex flex-wrap gap-2">
                        <legend className="sr-only">{tp.modifyAria(nameOf(i))}</legend>
                        <ChipToggle pressed={mode === "total"} onToggle={() => setMode("total")}>
                          {tp.formTotal}
                        </ChipToggle>
                        <ChipToggle pressed={mode === "add"} onToggle={() => setMode("add")}>
                          {tp.formAdd}
                        </ChipToggle>
                      </fieldset>
                      <div className="flex gap-2">
                        <label className="sr-only" htmlFor={`pq-${i.id}`}>
                          {tp.qty}
                        </label>
                        <input
                          id={`pq-${i.id}`}
                          inputMode="decimal"
                          value={pQty}
                          onChange={(e) => setPQty(e.target.value)}
                          aria-describedby={`pu-${i.id}`}
                          className="min-h-11 w-28 rounded-2xl border-2 border-line bg-surface px-4 focus:border-violet focus:outline-none"
                        />
                        <label className="sr-only" htmlFor={`pu-${i.id}`}>
                          {tp.unit}
                        </label>
                        <select
                          id={`pu-${i.id}`}
                          value={pUnit}
                          onChange={(e) => setPUnit(e.target.value)}
                          className="min-h-11 rounded-2xl border-2 border-line bg-surface px-3"
                        >
                          {purchases.lines[i.ingredient_key]!.units.map((u) => (
                            <option key={u} value={u}>
                              {tp.units[u as keyof typeof tp.units] ?? u}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" disabled={busy}>
                          {busy ? tp.saving : tp.save}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                          {tp.cancel}
                        </Button>
                      </div>
                    </form>
                  )}
                  {i.source === "manual" && (
                    <button
                      type="button"
                      aria-label={t.remove(nameOf(i))}
                      onClick={() => run({ op: "delete", id: i.id })}
                      className="grid size-11 place-items-center rounded-full hover:bg-chip"
                    >
                      <Icon name="close" className="size-5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      <Button type="button" variant="outline" onClick={share} className="self-start">
        {t.share}
      </Button>
    </>
  );
}

/** Besoin, achat réel et reste d'une ligne : l'achat enregistré reste affiché même quand le menu change. */
function PurchaseBlock({
  line,
  name,
  open,
  canWrite,
  choosing,
  onOpen,
  onIssue,
  onReport,
  onClear,
  onConfirm,
}: {
  line: PurchaseLine;
  name: string;
  open: boolean;
  canWrite: boolean;
  choosing: boolean;
  onOpen: () => void;
  onIssue: (d: "open" | "search_elsewhere" | "no_more") => void;
  onReport: () => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const state =
    line.status === "to_verify"
      ? tp.toConfirm
      : line.status === "partial"
        ? tp.partial
        : line.status === "covered" || line.status === "surplus"
          ? tp.covered
          : null;
  return (
    <div className="flex w-full flex-col gap-1 pb-2 pl-9 text-sm" data-testid="purchase-line">
      <p className="font-semibold">
        {state && <span className="mr-2 rounded-pill bg-chip px-2 py-0.5">{state}</span>}
        {line.deficit ? tp.remaining(line.deficit) : line.status === "to_verify" ? null : tp.covered}
      </p>
      <p className="text-muted">
        {[
          tp.need(line.need),
          line.bought && tp.bought(line.bought),
          line.surplus && tp.surplus(line.surplus),
          line.suggestion && tp.toBuy(line.suggestion),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {canWrite && line.canConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 self-start rounded-pill bg-chip px-4 font-semibold"
        >
          {tp.confirmCoverage}
        </button>
      )}
      {line.issue && (
        <p className="font-semibold" data-testid="issue-note">
          <span className="mr-2 rounded-pill bg-yellow-soft px-2 py-0.5">{tp.toResolve}</span>
          {tp.issueNote[line.issue]}
        </p>
      )}
      {canWrite && !open && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpen}
            aria-label={tp.modifyAria(name)}
            className="min-h-11 rounded-pill bg-chip px-4 font-semibold"
          >
            {tp.modify}
          </button>
          {line.issue ? (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 rounded-pill bg-chip px-4 font-semibold"
            >
              {tp.foundIt}
            </button>
          ) : (
            <button
              type="button"
              onClick={onReport}
              aria-label={tp.notFoundAria(name)}
              className="min-h-11 rounded-pill bg-chip px-4 font-semibold"
            >
              {tp.notFound}
            </button>
          )}
        </div>
      )}
      {canWrite && (choosing || line.issue === "open") && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onIssue("search_elsewhere")}
            className="min-h-11 rounded-pill bg-chip px-4 font-semibold"
          >
            {tp.searchElsewhere}
          </button>
          <button
            type="button"
            onClick={() => onIssue("no_more")}
            className="min-h-11 rounded-pill bg-chip px-4 font-semibold"
          >
            {tp.noMore}
          </button>
        </div>
      )}
    </div>
  );
}

/** « Vérifier mes courses » (§8.4) : bilan sans promesse que le menu est réalisable. */
function ReviewPanel({ lines }: { lines: Record<string, PurchaseLine> }) {
  const r = reviewSummary(
    Object.entries(lines).map(([key, l]) => ({ key, status: l.status, issue: l.issue })),
  );
  return (
    <div className="flex flex-col gap-1" role="status">
      <h2 className="font-extrabold">{tp.reviewTitle}</h2>
      <p className="font-semibold">{r.ready ? tp.reviewClean : tp.reviewDone(r.unresolved)}</p>
      <ul className="list-disc pl-5 text-sm">
        <li>{tp.reviewKnown(r.known.length)}</li>
        {r.toConfirm.length > 0 && <li>{tp.reviewToConfirm(r.toConfirm.length)}</li>}
        {r.missing.length > 0 && <li>{tp.reviewMissing(r.missing.length)}</li>}
        {r.surplus.length > 0 && <li>{tp.reviewSurplus(r.surplus.length)}</li>}
      </ul>
      <p className="text-sm text-muted">{tp.reviewNote}</p>
    </div>
  );
}
