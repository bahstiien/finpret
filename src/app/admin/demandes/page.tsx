import Link from "next/link";
import { NoteForm, QuickAction, TaskFromContactForm } from "@/components/admin/BoardForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { CONTACT_STATUS_LABEL, CONTACT_STATUSES, type ContactStatus } from "@/lib/admin-board";
import { formatShort } from "@/lib/dates";
import { createTaskFromContact, setContactNote, setContactStatus } from "@/server/actions/admin-board";
import { requireAdmin } from "@/server/admin";
import { listContactMessages } from "@/server/admin-board";

const STATUS_TONE: Record<ContactStatus, PillTone> = {
  new: "pink",
  in_progress: "yellow",
  done: "green",
  spam: "chip",
};

const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** CRM : boîte de réception des messages du formulaire de contact, à traiter par état. */
export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { role } = await requireAdmin();
  const sp = await searchParams;
  const status = CONTACT_STATUSES.find((s) => s === sp.status);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const { rows, counts } = await listContactMessages({ status, q: q || undefined });
  const all = CONTACT_STATUSES.filter((s) => s !== "spam").reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const href = (s?: ContactStatus) => {
    const u = new URLSearchParams();
    if (s) u.set("status", s);
    if (q) u.set("q", q);
    const str = u.toString();
    return `/admin/demandes${str ? `?${str}` : ""}`;
  };
  const canWrite = role === "owner";

  return (
    <>
      <PageHeader
        title="Demandes de contact"
        description="Messages envoyés depuis la page Contact. Réponds par e-mail, puis classe la demande."
      />
      <nav aria-label="Filtrer par état" className="flex flex-wrap gap-2">
        <Link
          href={href()}
          className={`btn btn--sm ${status ? "btn--outline" : "btn--dark"}`}
          aria-current={!status ? "page" : undefined}
        >
          Toutes <span className="mono">{all}</span>
        </Link>
        {CONTACT_STATUSES.map((s) => (
          <Link
            key={s}
            href={href(s)}
            className={`btn btn--sm ${status === s ? "btn--dark" : "btn--outline"}`}
            aria-current={status === s ? "page" : undefined}
          >
            {CONTACT_STATUS_LABEL[s]} <span className="mono">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>
      <form method="get" className="flex flex-wrap items-end gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="field-label flex flex-1 flex-col gap-1">
          Recherche
          <input
            name="q"
            defaultValue={q}
            placeholder="nom, e-mail, sujet ou texte"
            maxLength={100}
            className="input"
          />
        </label>
        <button type="submit" className="btn btn--outline">
          Chercher
        </button>
      </form>

      <ul className="flex flex-col gap-3">
        {rows.map((c) => (
          <Card
            as="li"
            key={c.id}
            id={`demande-${c.id}`}
            className="flex flex-col gap-3 !shadow-none"
            data-testid="contact-message"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="t-small muted">
                  {formatShort(c.created_at.slice(0, 10))} à {time.format(new Date(c.created_at))} ·{" "}
                  {c.audience === "asso" ? "Association" : "Famille"}
                </p>
                <h2 className="t-3 [overflow-wrap:anywhere]">{c.subject}</h2>
                <p className="t-small">
                  <b>{c.name}</b> ·{" "}
                  <a
                    className="lnk"
                    href={`mailto:${c.email}?subject=${encodeURIComponent(`Re: ${c.subject}`)}`}
                  >
                    {c.email}
                  </a>{" "}
                  ·{" "}
                  <Link href={`/admin/fiche?email=${encodeURIComponent(c.email)}`} className="underline">
                    fiche contact
                  </Link>
                  {!c.user_id && <span className="muted"> · pas de compte</span>}
                </p>
                {(c.association || c.school) && (
                  <p className="t-small muted">{[c.association, c.school].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <Pill tone={STATUS_TONE[c.status]}>{CONTACT_STATUS_LABEL[c.status]}</Pill>
            </div>
            <p className="whitespace-pre-line border-l-[length:var(--bw)] border-line pl-3 [overflow-wrap:anywhere]">
              {c.message}
            </p>
            {c.handled_at && c.status !== "new" && (
              <p className="t-small muted">
                {CONTACT_STATUS_LABEL[c.status]} le {formatShort(c.handled_at.slice(0, 10))}
                {c.handler ? ` par ${c.handler}` : ""}
              </p>
            )}
            {canWrite ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="btn btn--primary btn--sm"
                    href={`mailto:${c.email}?subject=${encodeURIComponent(`Re: ${c.subject}`)}`}
                  >
                    Répondre
                  </a>
                  {CONTACT_STATUSES.filter((s) => s !== c.status).map((s) => (
                    <QuickAction
                      key={s}
                      action={setContactStatus}
                      fields={{ id: c.id, status: s }}
                      label={
                        s === "new"
                          ? "Remettre en nouvelle"
                          : `Marquer « ${CONTACT_STATUS_LABEL[s].toLowerCase()} »`
                      }
                      variant={s === "done" ? "dark" : "outline"}
                    />
                  ))}
                </div>
                <TaskFromContactForm id={c.id} action={createTaskFromContact} />
                <NoteForm id={c.id} note={c.note} action={setContactNote} />
              </>
            ) : (
              c.note && <p className="t-small">Note : {c.note}</p>
            )}
          </Card>
        ))}
        {!rows.length && (
          <Card as="li" className="muted !shadow-none">
            {q || status ? "Aucune demande ne correspond." : "Aucune demande pour le moment."}
          </Card>
        )}
      </ul>
    </>
  );
}
