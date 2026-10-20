"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { baseAisle, guessAisle, shoppingText } from "@/engine/shopping";
import { fr } from "@/i18n/fr";
import { enqueue, loadQueue, type NewItem, type QueuedOp, saveQueue } from "@/lib/offline-queue";
import { createClient } from "@/lib/supabase/client";

const t = fr.shopping;

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
}: {
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
  const queue = useRef<QueuedOp[]>([]);
  const flushing = useRef(false);

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
      apply(op);
      queue.current = enqueue(queue.current, op);
      saveQueue(weekId, queue.current);
      setPending(queue.current.length);
      void flush();
    },
    [apply, flush, weekId],
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
  }, [supabase, weekId, householdId, userId, apply, flush]);

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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-black">{fr.nav.shopping}</h1>
          <button
            type="button"
            onClick={share}
            aria-label={t.share}
            className="grid size-12 place-items-center rounded-full bg-banana text-[#17151F]"
          >
            <Icon name="basket" />
          </button>
        </div>
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
            {online ? t.syncing(pending) : t.offline(pending)}
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
        <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
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
        </section>
      )}

      {groups.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="flex flex-col rounded-card bg-surface p-4">
            <h2 className="flex items-center justify-between pb-2 font-extrabold">
              {g.label}
              <small className="font-semibold text-muted">
                {g.items.filter((i) => i.checked).length}/{g.items.length}
              </small>
            </h2>
            <ul className="flex flex-col divide-y divide-line">
              {g.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-1" data-testid="shopping-item">
                  <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={i.checked}
                      onChange={(e) => run({ op: "check", id: i.id, checked: e.target.checked })}
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
          </section>
        ))
      )}
      <Button type="button" variant="outline" onClick={share} className="self-start">
        {t.share}
      </Button>
    </>
  );
}
