import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "kysely";
import { z } from "zod";
import { AdminForm } from "@/components/admin/AdminForm";
import { ActionForm } from "@/components/ui/ActionForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";
import { MONTHLY_CENTS, YEARLY_CENTS } from "@/engine/payouts";
import { formatShort } from "@/lib/dates";
import {
  addAssociationMember,
  addAssociationSchool,
  attachMemberHousehold,
  changeAssociationCode,
  detachHousehold,
  removeAssociationMember,
  removeAssociationSchool,
  updateAssociationAsAdmin,
} from "@/server/actions/asso-admin";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";

const eur = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const euroValue = (cents: number | null) => (cents === null ? "" : String(cents / 100));
const day = (iso: string | null) => (iso ? formatShort(iso.slice(0, 10)) : "—");

/** Fiche d'une association : profil et rétribution, code, écoles, équipe, adhérents (foyers au code), reversements. */
export default async function AdminAssociationPage({ params }: { params: Promise<{ id: string }> }) {
  const { role } = await requireAdmin();
  const canWrite = role === "owner";
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const data = await withAdmin(async (db) => {
    const a = await db.selectFrom("associations").selectAll().where("id", "=", id.data).executeTakeFirst();
    if (!a) return null;
    const [schools, members, households, lines, payouts] = await Promise.all([
      db
        .selectFrom("association_schools as s")
        .innerJoin("schools", "schools.id", "s.school_id")
        .select(["schools.id", "schools.name", "schools.city", "schools.uai"])
        .where("s.association_id", "=", id.data)
        .execute(),
      db
        .selectFrom("association_members as m")
        .innerJoin("auth.users as u", "u.id", "m.user_id")
        .select(["m.user_id", "m.role", "u.email", "u.email_verified"])
        .where("m.association_id", "=", id.data)
        .execute(),
      db
        .selectFrom("households as h")
        .leftJoin("subscriptions as s", "s.household_id", "h.id")
        .select([
          "h.id",
          "h.name",
          "h.association_joined_at",
          "s.plan",
          "s.status",
          sql<string | null>`(select u.email from memberships m join auth.users u on u.id = m.user_id
            where m.household_id = h.id and m.role = 'admin' order by m.created_at limit 1)`.as("owner_email"),
          sql<string | null>`(select m.user_id from memberships m
            where m.household_id = h.id and m.role = 'admin' order by m.created_at limit 1)`.as("owner_id"),
        ])
        .where("h.association_id", "=", id.data)
        .orderBy("h.association_joined_at", "desc")
        .limit(500)
        .execute(),
      db
        .selectFrom("payout_lines")
        .select([
          "kind",
          sql<number>`count(*)`.as("n"),
          sql<number>`coalesce(sum(amount_cents), 0)`.as("total"),
          sql<number>`coalesce(sum(amount_cents) filter (where payout_id is null), 0)`.as("pending"),
        ])
        .where("association_id", "=", id.data)
        .groupBy("kind")
        .execute(),
      db
        .selectFrom("payouts")
        .select(["quarter", "amount_cents", "status", "paid_at"])
        .where("association_id", "=", id.data)
        .orderBy("quarter", "desc")
        .limit(12)
        .execute(),
    ]);
    return { a, schools, members, households, lines, payouts };
  });
  if (!data) notFound();
  const { a, schools, members, households, lines, payouts } = data;
  const total = lines.reduce((s, l) => s + Number(l.total), 0);
  const pending = lines.reduce((s, l) => s + Number(l.pending), 0);
  const paying = households.filter((h) => h.plan === "monthly" || h.plan === "yearly").length;
  return (
    <>
      <PageHeader
        title={a.name}
        eyebrow={
          <Link href="/admin/associations" className="underline">
            ← Associations
          </Link>
        }
        description={`Code ${a.code} · ${a.status}`}
      />

      <dl className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
        <Card as="div">
          <dt className="t-label">Adhérents (foyers)</dt>
          <dd className="num-l">{households.length}</dd>
        </Card>
        <Card as="div">
          <dt className="t-label">Abonnés payants</dt>
          <dd className="num-l">{paying}</dd>
        </Card>
        <Card as="div">
          <dt className="t-label">Rétribution cumulée</dt>
          <dd className="num-l">{eur(total)}</dd>
        </Card>
        <Card as="div">
          <dt className="t-label">À verser (non clôturé)</dt>
          <dd className="num-l">{eur(pending)}</dd>
        </Card>
      </dl>

      <h2 className="t-label">Profil et rétribution</h2>
      <Card>
        {canWrite ? (
          <AdminForm
            action={updateAssociationAsAdmin}
            hidden={{ id: a.id }}
            inputs={[
              { name: "name", label: "Nom", required: true, defaultValue: a.name },
              { name: "rna", label: "RNA / SIREN", required: true, defaultValue: a.rna_or_siren },
              { name: "managerName", label: "Responsable", required: true, defaultValue: a.manager_name },
              { name: "email", label: "E-mail de l'association", type: "email", required: true, defaultValue: a.email },
              {
                name: "yearly",
                label: `Par abonnement annuel (€, vide = ${eur(YEARLY_CENTS)})`,
                type: "number",
                defaultValue: euroValue(a.retribution_yearly_cents),
              },
              {
                name: "monthly",
                label: `Par mois payé (€, vide = ${eur(MONTHLY_CENTS)})`,
                type: "number",
                defaultValue: euroValue(a.retribution_monthly_cents),
              },
            ]}
            submit="Enregistrer"
            variant="primary"
          />
        ) : (
          <p className="t-small">
            {a.manager_name} · {a.email} · {a.rna_or_siren}
          </p>
        )}
        <p className="t-small muted mt-2">
          La rétribution s&apos;applique aux factures payées après la modification. Les lignes déjà comptées ne changent pas.
        </p>
      </Card>

      <h2 className="t-label">Code association</h2>
      <Card className="flex flex-wrap items-end gap-4">
        <p className="t-small">
          Code actuel : <b className="mono">{a.code}</b> · lien{" "}
          <span className="mono">/ecole/{a.code}</span>
        </p>
        {canWrite && (
          <AdminForm
            action={changeAssociationCode}
            hidden={{ id: a.id }}
            inputs={[{ name: "code", label: "Nouveau code", required: true, placeholder: "APE-JULESFERRY" }]}
            submit="Changer le code"
            confirm="L'ancien code cessera de fonctionner pour les nouveaux inscrits. Continuer ?"
          />
        )}
      </Card>

      <h2 className="t-label">Écoles</h2>
      <Card as="ul" className="!shadow-none">
        {schools.map((s) => (
          <li key={s.id} className="row t-small flex-wrap items-center justify-between gap-2">
            <span>
              <b>{s.name}</b> · {s.city}
              {s.uai ? ` · ${s.uai}` : ""}
            </span>
            {canWrite && schools.length > 1 && (
              <ActionForm
                action={removeAssociationSchool}
                fields={{ id: a.id, schoolId: s.id }}
                label="Retirer"
                confirm="Retirer cette école de l'association ?"
              />
            )}
          </li>
        ))}
      </Card>
      {canWrite && (
        <Card>
          <AdminForm
            action={addAssociationSchool}
            hidden={{ id: a.id }}
            inputs={[
              { name: "name", label: "École", required: true },
              { name: "city", label: "Ville", required: true },
              { name: "uai", label: "UAI (option)" },
            ]}
            submit="Ajouter l'école"
            resetOnSuccess
          />
        </Card>
      )}

      <h2 className="t-label">Équipe (administrateurs de l&apos;école)</h2>
      <Card as="ul" className="!shadow-none">
        {members.map((m) => (
          <li key={m.user_id} className="row t-small flex-wrap items-center justify-between gap-2">
            <span>
              <Link href={`/admin/comptes/${m.user_id}`} className="underline">
                <b>{m.email}</b>
              </Link>{" "}
              <Pill tone={m.role === "manager" ? "violet" : "chip"}>
                {m.role === "manager" ? "responsable" : "éditeur de menus"}
              </Pill>
              {!m.email_verified && <span className="muted"> · jamais connecté</span>}
            </span>
            {canWrite && (
              <ActionForm
                action={removeAssociationMember}
                fields={{ id: a.id, userId: m.user_id }}
                label="Retirer"
                confirm="Retirer ce membre de l'association ?"
              />
            )}
          </li>
        ))}
      </Card>
      {canWrite && (
        <Card>
          <AdminForm
            action={addAssociationMember}
            hidden={{ id: a.id }}
            inputs={[
              { name: "email", label: "E-mail (compte créé si besoin)", type: "email", required: true },
              {
                name: "role",
                label: "Rôle",
                type: "select",
                options: [
                  ["manager", "Responsable"],
                  ["menu_editor", "Éditeur de menus"],
                ],
              },
            ]}
            submit="Ajouter et envoyer un lien de connexion"
            resetOnSuccess
          />
        </Card>
      )}

      <h2 className="t-label">Adhérents (comptes ayant utilisé le code)</h2>
      {canWrite && (
        <Card>
          <AdminForm
            action={attachMemberHousehold}
            hidden={{ id: a.id }}
            inputs={[{ name: "email", label: "Rattacher le foyer du compte (e-mail)", type: "email", required: true }]}
            submit="Rattacher"
            resetOnSuccess
          />
        </Card>
      )}
      <Card as="ul" className="!shadow-none">
        {households.map((h) => (
          <li key={h.id} className="row t-small flex-wrap items-center justify-between gap-2">
            <span>
              <b>{h.name}</b>
              {h.owner_id && h.owner_email && (
                <>
                  {" · "}
                  <Link href={`/admin/comptes/${h.owner_id}`} className="underline">
                    {h.owner_email}
                  </Link>
                </>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone={h.plan === "monthly" || h.plan === "yearly" ? "green" : "yellow"}>
                {h.plan ?? "sans offre"}
                {h.status ? ` · ${h.status}` : ""}
              </Pill>
              <span className="mono muted">depuis le {day(h.association_joined_at)}</span>
              {canWrite && (
                <ActionForm
                  action={detachHousehold}
                  fields={{ id: a.id, householdId: h.id }}
                  label="Détacher"
                  confirm="Détacher ce foyer de l'association ?"
                />
              )}
            </span>
          </li>
        ))}
        {!households.length && <li className="muted">Aucun foyer n&apos;a encore utilisé ce code.</li>}
      </Card>

      <h2 className="t-label">Reversements</h2>
      <Card as="ul" className="t-small !shadow-none">
        {lines.map((l) => (
          <li key={l.kind} className="row flex-wrap justify-between gap-2">
            <span>
              {{ yearly: "Abonnements annuels", monthly: "Mois payés", refund: "Remboursements" }[l.kind]} · {l.n}
            </span>
            <span className="mono">{eur(Number(l.total))}</span>
          </li>
        ))}
        {payouts.map((p) => (
          <li key={p.quarter} className="row flex-wrap justify-between gap-2">
            <span>
              {p.quarter} · <Pill tone={p.status === "paid" ? "green" : "yellow"}>{p.status}</Pill>
            </span>
            <span className="mono">
              {eur(p.amount_cents)}
              {p.paid_at ? ` · versé le ${day(p.paid_at)}` : ""}
            </span>
          </li>
        ))}
        {!lines.length && !payouts.length && <li className="muted">Aucune rétribution pour l&apos;instant.</li>}
      </Card>
    </>
  );
}
