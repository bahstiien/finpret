import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatShort } from "@/lib/dates";
import {
  addAccountNote,
  cancelSubscription,
  deleteAccount,
  offerMonth,
  refundLastPayment,
  sendAccountLoginLink,
  setAccountSuspended,
} from "@/server/actions/crm";
import { extendTrial } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { accountDetail } from "@/server/crm";
import { ActionForm } from "@/components/ui/ActionForm";
import { AdminForm } from "@/components/admin/AdminForm";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const day = (iso: string | null) => (iso ? formatShort(iso.slice(0, 10)) : "—");

/** Fiche d'un compte : identité, foyers et abonnements, notes de suivi, actions (rôle `owner` seulement). */
export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { role } = await requireAdmin();
  const canWrite = role === "owner";
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const d = await accountDetail(id.data);
  if (!d) notFound();
  const { user } = d;
  const back = `/admin/comptes/${user.id}`;
  return (
    <>
      <PageHeader
        title={user.email ?? "Compte"}
        eyebrow={
          <Link href="/admin/comptes" className="underline">
            ← Comptes
          </Link>
        }
        description={user.display_name ?? user.name ?? undefined}
        actions={
          <span className="flex gap-2">
            {d.adminRole && <Pill tone="violet">Admin · {d.adminRole}</Pill>}
            {user.banned_at && <Pill tone="pink">Suspendu</Pill>}
          </span>
        }
      />
      <Card as="dl" className="t-small grid gap-2 min-[700px]:grid-cols-2">
        <div>
          <dt className="t-label">Inscription</dt>
          <dd>{day(user.created_at)}</dd>
        </div>
        <div>
          <dt className="t-label">E-mail vérifié</dt>
          <dd>{user.email_verified ? "oui" : "non"}</dd>
        </div>
        <div>
          <dt className="t-label">Connexion</dt>
          <dd>{d.providers.length ? d.providers.join(", ") : "lien magique"}</dd>
        </div>
        {user.banned_at && (
          <div>
            <dt className="t-label">Suspendu le {day(user.banned_at)}</dt>
            <dd>{user.ban_reason ?? "sans motif"}</dd>
          </div>
        )}
      </Card>

      <h2 className="t-label">Foyers et abonnements</h2>
      <Card as="ul" className="!shadow-none">
        {d.households.map((h) => (
          <li key={h.id} className="row t-small flex-col items-stretch gap-2">
            <div className="flex flex-wrap justify-between gap-2">
              <span>
                <b>{h.name}</b> · {h.role}
                {h.association_id ? " · association" : ""}
              </span>
              <span className="mono muted">
                {h.plan ?? "sans abonnement"}
                {h.status ? ` · ${h.status}` : ""}
                {h.plan === "trial" && h.trial_ends_at ? ` · essai jusqu'au ${day(h.trial_ends_at)}` : ""}
                {h.current_period_end ? ` · renouvellement ${day(h.current_period_end)}` : ""}
                {h.stripe_customer_id ? ` · ${h.stripe_customer_id}` : ""}
              </span>
            </div>
            {canWrite && h.role === "admin" && (
              <div className="flex flex-wrap items-end gap-3">
                {(h.plan === "trial" || h.plan === "free") && (
                  <ActionForm action={extendTrial} fields={{ householdId: h.id }} label="Prolonger l'essai de 14 jours" />
                )}
                {(h.plan === "monthly" || h.plan === "yearly") && (
                  <>
                    <ActionForm
                      action={offerMonth}
                      fields={{ householdId: h.id, back }}
                      label="Offrir un mois"
                      confirm="Repousser la prochaine facturation de 30 jours ?"
                    />
                    <AdminForm
                      action={refundLastPayment}
                      hidden={{ householdId: h.id, back }}
                      inputs={[{ name: "amount", label: "Montant (€, vide = tout)", type: "number" }]}
                      submit="Rembourser le dernier paiement"
                      confirm="Rembourser le dernier paiement sur Stripe ?"
                    />
                    <AdminForm
                      action={cancelSubscription}
                      hidden={{ householdId: h.id, back }}
                      inputs={[
                        {
                          name: "when",
                          label: "Résiliation",
                          type: "select",
                          options: [
                            ["period_end", "À la fin de la période"],
                            ["now", "Immédiate"],
                          ],
                        },
                      ]}
                      submit="Résilier"
                      confirm="Résilier cet abonnement sur Stripe ?"
                    />
                  </>
                )}
              </div>
            )}
          </li>
        ))}
        {!d.households.length && <li className="muted">Aucun foyer.</li>}
      </Card>

      <h2 className="t-label">Notes de suivi</h2>
      {canWrite && (
        <Card>
          <AdminForm
            action={addAccountNote}
            hidden={{ userId: user.id }}
            inputs={[{ name: "body", label: "Nouvelle note", type: "textarea", required: true }]}
            submit="Ajouter"
            variant="primary"
            resetOnSuccess
          />
        </Card>
      )}
      <Card as="ul" className="t-small !shadow-none">
        {d.notes.map((n) => (
          <li key={n.id} className="row flex-col items-start gap-1">
            <span className="whitespace-pre-wrap">{n.body}</span>
            <span className="mono muted">
              {new Date(n.created_at).toLocaleString("fr-FR")} · {n.author ?? "admin supprimé"}
            </span>
          </li>
        ))}
        {!d.notes.length && <li className="muted">Aucune note.</li>}
      </Card>

      <h2 className="t-label">Dernières sessions</h2>
      <Card as="ul" className="t-small !shadow-none">
        {d.sessions.map((s, i) => (
          <li key={i} className="row mono muted">
            {new Date(s.updated_at).toLocaleString("fr-FR")} · {s.ip_address ?? "?"} · {s.user_agent?.slice(0, 60) ?? "?"}
          </li>
        ))}
        {!d.sessions.length && <li className="muted">Aucune session active.</li>}
      </Card>

      {canWrite && (
        <>
          <h2 className="t-label">Actions sur le compte</h2>
          <Card className="flex flex-col gap-4">
            <ActionForm
              action={sendAccountLoginLink}
              fields={{ userId: user.id }}
              label="Envoyer un lien de connexion"
              confirm="Envoyer un lien de connexion à cette adresse ?"
            />
            <AdminForm
              action={setAccountSuspended}
              hidden={{ userId: user.id, suspend: String(!user.banned_at) }}
              inputs={user.banned_at ? [] : [{ name: "reason", label: "Motif (option)" }]}
              submit={user.banned_at ? "Réactiver le compte" : "Suspendre le compte"}
              confirm={user.banned_at ? undefined : "Suspendre ce compte et fermer ses sessions ?"}
            />
            <AdminForm
              action={deleteAccount}
              hidden={{ userId: user.id }}
              inputs={[{ name: "confirm", label: "Supprimer définitivement : saisis l'e-mail du compte", type: "email", required: true }]}
              submit="Supprimer le compte (RGPD)"
              variant="dark"
              confirm="Suppression définitive du compte, de ses données et de son abonnement. Continuer ?"
            />
          </Card>
        </>
      )}
    </>
  );
}
