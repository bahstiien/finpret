"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { baseAisle, guessAisle, shoppingText } from "@/engine/shopping";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { enqueue, loadQueue, type NewItem, type QueuedOp, saveQueue } from "@/lib/offline-queue";
import { createClient } from "@/lib/supabase/client";
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
 * Liste de courses (§8.3) : temps réel (Supabase Realtime, moins de 2 s), coches article par article,
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
  const supabase = useMemo(() => createClient(), []);
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

  const send = useCallback(
    async (op: QueuedOp) => {
      const res =
        op.op === "check"
          ? await supabase.from("shopping_items").update({ checked: op.checked }).eq("id", op.id)
          : op.op === "delete"
            ? await supabase.from("shopping_items").delete().eq("id", op.id)
            : await supabase
                .from("shopping_items")
                .upsert(op.item, { onConflict: "id", ignoreDuplicates: true });
      // Une erreur de droits ou de données n'est pas rejouée ; seule une coupure réseau garde l'opération.
      if (res.error && !/fetch|network|Failed/i.test(res.error.message)) return "dropped" as const;
      return res.error ? ("failed" as const) : ("sent" as const);
    },
    [supabase],
  );

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

  // File laissée par une visite précédente hors ligne, état réseau, temps réel.
  useEffect(() => {
    queue.current = loadQueue(weekId);
    queue.current.forEach(apply);
    setPending(queue.current.length);
    setOnline(navigator.onLine);
    // Relit la liste (changements des autres pendant une coupure, ou avant l'abonnement) ;
    // les coches locales encore en attente restent prioritaires.
    const refresh = async () => {
      const { data } = await supabase
        .from("shopping_items")
        .select("id, source, ingredient_key, label, qty_text, aisle, checked, added_by, updated_at")
        .eq("week_id", weekId);
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
    };
    const up = async () => {
      setOnline(true);
      await flush();
      await refresh();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    void flush();
    let cancelled = false;
    const channel = supabase.channel(`shopping:${weekId}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${householdId}` },
      (payload) => {
        setItems((prev) => {
          const next = new Map(prev);
          if (payload.eventType === "DELETE") next.delete((payload.old as Item).id);
          else {
            const row = payload.new as Item & { week_id: string };
            if (row.week_id !== weekId) return prev;
            // Un événement livré en retard ne remplace pas un état plus récent.
            const known = next.get(row.id);
            if (known?.updated_at && row.updated_at && row.updated_at < known.updated_at) return prev;
            // Une coche locale en attente reste prioritaire sur l'état reçu.
            const local = queue.current.find((q) => q.op === "check" && q.id === row.id);
            next.set(row.id, local && local.op === "check" ? { ...row, checked: local.checked } : row);
          }
          return next;
        });
      },
    );
    if (hasPurchases) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "purchase_events",
          filter: `household_id=eq.${householdId}`,
        },
        () => router.refresh(),
      );
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_issues", filter: `household_id=eq.${householdId}` },
        () => router.refresh(),
      );
    }
    // La session est lue dans les cookies de façon asynchrone : sans jeton, la RLS bloquerait les événements.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) void supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    });
    return () => {
      cancelled = true;
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      void supabase.removeChannel(channel);
    };
  }, [supabase, weekId, householdId, userId, apply, flush, hasPurchases, router]);

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
      <header className="flex flex-col gap-4">
        <PageHeader
          title={fr.nav.shopping}
          actions={
            <button type="button" onClick={share} aria-label={t.share} className="iconbtn tone-banane">
              <Icon name="basket" />
            </button>
          }
        />
        <Card as="div" tone="green" className="flex flex-col gap-3">
          <p className="t-ui mono" data-testid="shopping-progress">
            {t.progress(done, visible.length)}
          </p>
          <div
            role="progressbar"
            aria-label={t.progress(done, visible.length)}
            aria-valuemin={0}
            aria-valuemax={visible.length}
            aria-valuenow={done}
            className="bar"
          >
            <div
              className="bar-fill"
              style={{ width: `${visible.length ? (done / visible.length) * 100 : 0}%`, background: "var(--nav)" }}
            />
          </div>
        </Card>
        {(!online || pending > 0) && (
          <p
            role="status"
            className="callout tone-warning text-sm font-bold"
            data-testid="offline"
          >
            {online ? t.syncing(pending) : FEATURES.offlineWrites ? t.offline(pending) : t.offlineReadOnly}
          </p>
        )}
      </header>

      <form
        className="card flex flex-wrap items-end gap-2"
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
          className="input w-full min-w-0 sm:w-auto sm:flex-[3]"
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
          className="input mono w-24 min-w-0 flex-1"
        />
        <Button type="submit">{t.add}</Button>
        {frequent.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 pt-1">
            {frequent.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => add(f)}
                className="chiptg"
              >
                + {f}
              </button>
            ))}
          </div>
        )}
      </form>

      {baseUsed.length > 0 && (
        <Card padding="sm" className="flex flex-col gap-2">
          <h2 className="t-3">{t.base}</h2>
          <p className="t-small muted">{t.baseHint}</p>
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
        <p className="muted">{t.empty}</p>
      ) : (
        groups.map((g) => (
          <Card padding="none" key={g.key} className="flex flex-col overflow-hidden">
            <h2 className="t-kicker tone-chip flex items-center justify-between border-b-[length:var(--bw)] border-line px-3.5 py-2.5">
              {g.label}
              <span className="mono">
                {g.items.filter((i) => i.checked).length}/{g.items.length}
              </span>
            </h2>
            <ul className="flex flex-col divide-y-[length:var(--bw)] divide-line px-3.5">
              {g.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-1" data-testid="shopping-item">
                  <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={i.checked}
                      onChange={(e) => void onCheck(i, e.target.checked)}
                      className="cb"
                    />
                    <span className={`flex flex-col ${i.checked ? "muted line-through" : ""}`}>
                      <span className="t-ui">{nameOf(i)}</span>
                      <span className="t-small muted mono">
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
                      className="nb-dash tone-chip flex w-full flex-col gap-2 p-3"
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
                      <div className="flex flex-wrap gap-2">
                        <label className="sr-only" htmlFor={`pq-${i.id}`}>
                          {tp.qty}
                        </label>
                        <input
                          id={`pq-${i.id}`}
                          inputMode="decimal"
                          value={pQty}
                          onChange={(e) => setPQty(e.target.value)}
                          aria-describedby={`pu-${i.id}`}
                          className="input mono w-28"
                        />
                        <label className="sr-only" htmlFor={`pu-${i.id}`}>
                          {tp.unit}
                        </label>
                        <select
                          id={`pu-${i.id}`}
                          value={pUnit}
                          onChange={(e) => setPUnit(e.target.value)}
                          className="input w-auto"
                        >
                          {purchases.lines[i.ingredient_key]!.units.map((u) => (
                            <option key={u} value={u}>
                              {tp.units[u as keyof typeof tp.units] ?? u}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="secondary" disabled={busy}>
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
                      className="iconbtn"
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
      <Button type="button" variant="outline" size="sm" onClick={share} className="self-start">
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
    <div className="flex w-full flex-col gap-2 pb-3 pl-9 text-sm" data-testid="purchase-line">
      <p className="t-ui">
        {state && <span className="pill tone-warning mr-2">{state}</span>}
        {line.deficit ? tp.remaining(line.deficit) : line.status === "to_verify" ? null : tp.covered}
      </p>
      <p className="muted mono">
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
          className="btn btn--outline btn--sm self-start"
        >
          {tp.confirmCoverage}
        </button>
      )}
      {line.issue && (
        <p className="t-ui" data-testid="issue-note">
          <span className="pill tone-alerte mr-2">{tp.toResolve}</span>
          {tp.issueNote[line.issue]}
        </p>
      )}
      {canWrite && !open && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpen}
            aria-label={tp.modifyAria(name)}
            className="btn btn--outline btn--sm"
          >
            {tp.modify}
          </button>
          {line.issue ? (
            <button
              type="button"
              onClick={onClear}
              className="btn btn--outline btn--sm"
            >
              {tp.foundIt}
            </button>
          ) : (
            <button
              type="button"
              onClick={onReport}
              aria-label={tp.notFoundAria(name)}
              className="btn btn--outline btn--sm"
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
            className="btn btn--outline btn--sm"
          >
            {tp.searchElsewhere}
          </button>
          <button
            type="button"
            onClick={() => onIssue("no_more")}
            className="btn btn--outline btn--sm"
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
      <h2 className="t-3">{tp.reviewTitle}</h2>
      <p className="t-ui">{r.ready ? tp.reviewClean : tp.reviewDone(r.unresolved)}</p>
      <ul className="list-disc pl-4 text-sm mono">
        <li>{tp.reviewKnown(r.known.length)}</li>
        {r.toConfirm.length > 0 && <li>{tp.reviewToConfirm(r.toConfirm.length)}</li>}
        {r.missing.length > 0 && <li>{tp.reviewMissing(r.missing.length)}</li>}
        {r.surplus.length > 0 && <li>{tp.reviewSurplus(r.surplus.length)}</li>}
      </ul>
      <p className="t-small muted">{tp.reviewNote}</p>
    </div>
  );
}
