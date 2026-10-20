"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qr: string; secret: string };

/** Second facteur TOTP (Supabase MFA) : activation au premier passage, puis saisie du code à chaque session. */
export function MfaPanel() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === "verified");
      if (verified) return setFactorId(verified.id);
      // Facteurs commencés mais jamais validés : on les retire avant d'en créer un nouveau.
      for (const f of data?.all ?? [])
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const res = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Fin Prêt admin" });
      if (res.error || !res.data)
        return setError(
          "Impossible d'activer le second facteur. Vérifiez que le TOTP est activé dans Supabase.",
        );
      setEnrollment({ factorId: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret });
      setFactorId(res.data.id);
    })();
  }, [supabase]);

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    setError(undefined);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setBusy(false);
      return setError("Le code n'a pas pu être vérifié.");
    }
    const res = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (res.error) return setError("Code incorrect.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-card bg-surface p-6">
      {enrollment && (
        <>
          <p>
            Scannez ce QR code avec votre application d&apos;authentification, puis saisissez le code à 6
            chiffres.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code SVG fourni par Supabase (data URL) */}
          <img src={enrollment.qr} alt="QR code du second facteur" width={180} height={180} />
          <p className="text-sm text-muted">
            Ou saisissez la clé : <code>{enrollment.secret}</code>
          </p>
        </>
      )}
      {!enrollment && factorId && (
        <p>Saisissez le code à 6 chiffres de votre application d&apos;authentification.</p>
      )}
      <TextField
        id="totp"
        label="Code à 6 chiffres"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="button" disabled={busy || code.length !== 6 || !factorId} onClick={verify}>
        Valider
      </Button>
    </div>
  );
}
