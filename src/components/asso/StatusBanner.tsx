import { fr } from "@/i18n/fr";
import type { MyAssociation } from "@/server/asso-session";

const t = fr.asso.status;

/** Rappelle l'état de validation de l'association tant qu'elle n'est pas approuvée. */
export function StatusBanner({
  association,
}: {
  association: Pick<MyAssociation, "status" | "rejectReason">;
}) {
  if (association.status === "approved") return null;
  const text =
    association.status === "pending"
      ? t.pending
      : association.status === "rejected"
        ? t.rejected(association.rejectReason)
        : t.suspended;
  return (
    <p role="status" className="rounded-card bg-yellow-soft p-5 font-semibold" data-testid="asso-status">
      {text}
    </p>
  );
}
