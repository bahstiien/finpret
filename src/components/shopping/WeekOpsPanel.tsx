"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { fr } from "@/i18n/fr";
import { markPreparation, transferPurchase } from "@/server/actions/purchases";

const t = fr.purchases.ops;

export type PreparationItem = {
  uid: string;
  name: string;
  /** « locked » : verrouillée parce que la session a démarré. */
  state: "planned" | "started" | "prepared" | "locked";
};

export type TransferChoice = { key: string; label: string; balance: number; unit: string };

/**
 * « Où j'en suis » (§14) et « Réaffecter » (§9.6). Le serveur reste seul juge : verrouillage, solde et
 * révision sont revérifiés dans la même transaction que l'écriture.
 */
export function WeekOpsPanel({
  weekId,
  preparations,
  transfers,
  otherWeeks,
  online,
}: {
  weekId: string;
  preparations: PreparationItem[];
  transfers: TransferChoice[];
  otherWeeks: { id: string; label: string }[];
  online: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState(transfers[0]?.key ?? "");
  const [target, setTarget] = useState(otherWeeks[0]?.id ?? "");
  const [qty, setQty] = useState("");

  if (preparations.length === 0 && transfers.length === 0) return null;
  const chosen = transfers.find((c) => c.key === pick) ?? transfers[0];

  const mark = async (uid: string, state: "started" | "prepared") => {
    if (!online) return toast(fr.purchases.offlineReadOnly, "error");
    setBusy(`${uid}:${state}`);
    const res = await markPreparation({ weekId, uid, state });
    setBusy(null);
    if (!res.ok) return toast(res.error, "error");
    toast(res.data.message);
    router.refresh();
  };

  const move = async () => {
    if (!chosen || !target) return;
    if (!online) return toast(fr.purchases.offlineReadOnly, "error");
    const value = qty.trim() === "" ? chosen.balance : Number(qty.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return toast(fr.purchases.INVALID_QUANTITY, "error");
    setBusy("transfer");
    const res = await transferPurchase({
      fromWeekId: weekId,
      toWeekId: target,
      ingredient: chosen.key,
      qty: value,
      unit: chosen.unit as never,
      opKey: crypto.randomUUID(),
    });
    setBusy(null);
    if (!res.ok) return toast(res.error, "error");
    toast(res.data.message);
    setQty("");
    router.refresh();
  };

  const markButton = (p: PreparationItem, state: "started" | "prepared", label: string) => (
    <Button
      variant="secondary"
      disabled={busy !== null || !online}
      aria-label={t.markAria(label.toLowerCase(), p.name)}
      onClick={() => mark(p.uid, state)}
    >
      {label}
    </Button>
  );

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{t.title}</h2>
        <Button variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t.hide : t.open}
        </Button>
      </div>
      {open && (
        <>
          <p className="text-sm text-muted">{t.intro}</p>
          {preparations.length === 0 ? (
            <p className="text-muted">{t.noPreps}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {preparations.map((p) => (
                <li key={p.uid} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.state === "planned" ? (
                    <span className="flex gap-2">
                      {markButton(p, "started", t.started)}
                      {markButton(p, "prepared", t.prepared)}
                    </span>
                  ) : p.state === "started" ? (
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-muted">{t.stateStarted}</span>
                      {markButton(p, "prepared", t.prepared)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted">
                      {p.state === "prepared" ? t.statePrepared : t.stateLocked}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h3 className="pt-2 font-bold">{t.transferTitle}</h3>
          {transfers.length === 0 || otherWeeks.length === 0 ? (
            <p className="text-muted">{t.noTransfer}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{t.transferIntro}</p>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {t.ingredient}
                <select
                  className="min-h-11 rounded-card border border-line bg-surface px-3"
                  value={chosen?.key}
                  onChange={(e) => setPick(e.target.value)}
                >
                  {transfers.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {t.toWeek}
                <select
                  className="min-h-11 rounded-card border border-line bg-surface px-3"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {otherWeeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {`${t.quantity} (${chosen?.unit ?? ""})`}
                <input
                  inputMode="decimal"
                  className="min-h-11 rounded-card border border-line bg-surface px-3"
                  placeholder={String(chosen?.balance ?? "")}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <Button disabled={busy !== null || !online} onClick={move}>
                {busy === "transfer" ? t.transferring : t.transfer}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
