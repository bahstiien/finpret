"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { fr } from "@/i18n/fr";

/**
 * Partage de la carte de palier (SPEC_PROGRES §3.6) : `navigator.share` avec le fichier, repli sur le téléchargement.
 * La carte est générée par le serveur ; seul le palier passe dans l'URL.
 */
export function ShareButton({ milestone }: { milestone: number }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function share() {
    setBusy(true);
    try {
      const res = await fetch(`/api/share/streak?milestone=${milestone}`);
      if (!res.ok) throw new Error(String(res.status));
      const file = new File([await res.blob()], `fin-pret-${milestone}-semaines.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fr.progress.streak.shareTitle });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      // Annuler la feuille de partage n'est pas une erreur.
      if (!(error instanceof DOMException && error.name === "AbortError")) toast(fr.errors.generic, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" onClick={share} disabled={busy} data-testid="share-milestone">
      <Icon name="share" />
      {fr.progress.streak.share}
    </Button>
  );
}
