import Link from "next/link";
import { z } from "zod";
import { NoteForm, TagEditor, TaskFromContactForm } from "@/components/admin/BoardForms";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionHeader } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";
import {
  CONTACT_STATUS_LABEL,
  LEAD_STAGE_LABEL,
  SUGGESTED_TAGS,
  type ContactStatus,
  type LeadStage,
} from "@/lib/admin-board";
import { formatShort } from "@/lib/dates";
import {
  addAccountTag,
  createTaskFromContact,
  removeAccountTag,
  setContactNote,
} from "@/server/actions/admin-board";
import { requireAdmin } from "@/server/admin";
import { allTags, contactSheet } from "@/server/admin-board";

const PLAN_LABEL: Record<string, string> = {
  trial: "Essai",
  monthly: "Mensuel",
  yearly: "Annuel",
  free: "Gratuit",
};
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** CRM : fiche contact unifiée d'une adresse e-mail (compte, foyers, étiquettes, demandes, prospect, notes). */
export default async function AdminContactSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { role } = await requireAdmin();
  const canWrite = role === "owner";
  const raw = (await searchParams).email?.trim().toLowerCase() ?? "";
  const email = z.email().max(254).safeParse(raw);

  const search = (
    <form method="get" className="flex flex-wrap items-end gap-2">
      <label className="field-label flex min-w-64 flex-1 flex-col gap-1">
        E-mail
        <input
          name="email"
          type="email"
          defaultValue={raw}
          required
          className="input"
          placeholder="prenom@exemple.fr"
        />
      </label>
      <button type="submit" className="btn btn--outline">
        Ouvrir la fiche
      </button>
    </form>
  );

  if (!email.success)
    return (
      <>
        <PageHeader
          title="Fiche contact"
          description="Tout ce que l'on sait d'une adresse : compte, foyers, demandes, prospect association, notes."
        />
        {search}
        {raw && <p className="muted">Adresse e-mail invalide.</p>}
      </>
    );

  const [d, tags] = await Promise.all([contactSheet(email.data), allTags()]);
  const known = d.user || d.messages.length || d.leads.length;
  const suggestions = [...new Set([...SUGGESTED_TAGS, ...tags.map((t) => t.tag)])];

  return (
    <>
      <PageHeader
        title={email.data}
        eyebrow="Fiche contact"
        description={
          d.user
            ? `${d.user.name ?? "Sans nom"} · inscrit le ${formatShort(d.user.created_at.slice(0, 10))}${
                d.user.last_seen ? ` · vu le ${formatShort(d.user.last_seen.slice(0, 10))}` : ""
              }`
            : "Pas de compte avec cette adresse."
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <a className="btn btn--primary btn--sm" href={`mailto:${email.data}`}>
              Écrire
            </a>
            {d.user && (
              <Link className="btn btn--outline btn--sm" href={`/admin/comptes/${d.user.id}`}>
                Compte et actions
              </Link>
            )}
          </span>
        }
      />
      {search}
      {!known && <p className="muted">Aucune trace de cette adresse : ni compte, ni demande, ni prospect.</p>}

      <div className="grid gap-4 min-[1100px]:grid-cols-3">
        <div className="flex flex-col gap-4 min-[1100px]:col-span-2">
          {d.user && (
            <Card className="flex flex-col gap-3 !shadow-none">
              <SectionHeader title="Compte" aside={d.user.banned_at ? "suspendu" : undefined} />
              <div className="flex flex-wrap gap-2">
                {!d.user.email_verified && <Pill tone="yellow">E-mail non vérifié</Pill>}
                {d.user.banned_at && <Pill tone="pink">Suspendu</Pill>}
              </div>
              {canWrite ? (
                <TagEditor
                  userId={d.user.id}
                  tags={d.tags}
                  suggestions={suggestions}
                  add={addAccountTag}
                  remove={removeAccountTag}
                />
              ) : (
                <p className="t-small">{d.tags.length ? d.tags.join(" · ") : "Aucune étiquette."}</p>
              )}
              <ul>
                {d.households.map((h) => (
                  <li key={h.id} className="row t-small flex-wrap justify-between gap-2">
                    <span>
                      <b>{h.name}</b> · {h.role === "admin" ? "administrateur" : "membre"}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {h.plan && (
                        <Pill tone={h.plan === "trial" ? "yellow" : "green"}>
                          {PLAN_LABEL[h.plan] ?? h.plan}
                          {h.status && h.status !== "active" ? ` · ${h.status}` : ""}
                        </Pill>
                      )}
                      <span className="mono muted">
                        {h.menus} menu{h.menus > 1 ? "s" : ""}
                        {h.last_menu ? ` · dernier le ${formatShort(h.last_menu.slice(0, 10))}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
                {!d.households.length && <li className="t-small muted">Aucun foyer.</li>}
              </ul>
            </Card>
          )}

          <SectionHeader title="Demandes de contact" aside={String(d.messages.length)} />
          {d.messages.map((m) => (
            <Card key={m.id} className="flex flex-col gap-2 !shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="t-small muted">
                    {dateTime.format(new Date(m.created_at))} ·{" "}
                    {m.audience === "asso" ? "Association" : "Famille"}
                  </p>
                  <h3 className="font-bold">{m.subject}</h3>
                </div>
                <Pill>{CONTACT_STATUS_LABEL[m.status as ContactStatus]}</Pill>
              </div>
              <p className="whitespace-pre-line border-l-[length:var(--bw)] border-line pl-3 [overflow-wrap:anywhere]">
                {m.message}
              </p>
              {canWrite ? (
                <>
                  <TaskFromContactForm id={m.id} action={createTaskFromContact} />
                  <NoteForm id={m.id} note={m.note} action={setContactNote} />
                </>
              ) : (
                m.note && <p className="t-small">Note : {m.note}</p>
              )}
            </Card>
          ))}
          {!d.messages.length && <p className="t-small muted">Aucune demande envoyée avec cette adresse.</p>}

          {d.leads.length > 0 && (
            <>
              <SectionHeader title="Prospect association" />
              {d.leads.map((l) => (
                <Card
                  key={l.id}
                  className="t-small flex flex-wrap items-center justify-between gap-2 !shadow-none"
                >
                  <span>
                    <b>{l.association_name}</b>
                    {[l.school, l.city].filter(Boolean).length
                      ? ` · ${[l.school, l.city].filter(Boolean).join(", ")}`
                      : ""}
                    {l.note && <span className="muted"> · {l.note}</span>}
                  </span>
                  <Link href="/admin/prospects" className="pill tone-blue">
                    {LEAD_STAGE_LABEL[l.stage as LeadStage]}
                  </Link>
                </Card>
              ))}
            </>
          )}
        </div>

        <Card className="flex flex-col gap-3 self-start !shadow-none">
          <SectionHeader title="Historique" />
          <ol className="flex flex-col gap-3 border-l-[length:var(--bw)] border-line pl-4">
            {d.timeline.map((e, i) => (
              <li key={i} className="t-small relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[23px] top-1 size-3 border-[length:var(--bw)] border-line bg-[var(--banane)]"
                />
                <span className="mono muted">{dateTime.format(new Date(e.at))}</span>
                <br />
                <span className="[overflow-wrap:anywhere]">{e.label}</span>
              </li>
            ))}
            {!d.timeline.length && <li className="t-small muted">Rien pour le moment.</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}
