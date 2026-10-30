import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChildSchoolForm } from "@/components/settings/ChildSchoolForm";
import { HouseholdDetailsForm, MembersForm } from "@/components/settings/HouseholdForms";
import { InviteForm } from "@/components/settings/InviteForm";
import { RoleSelect } from "@/components/settings/RoleSelect";
import { ActionForm } from "@/components/ui/ActionForm";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { fr } from "@/i18n/fr";
import { mondayOf, todayIn } from "@/lib/dates";
import { removeAccount, revokeInvitation } from "@/server/actions/households";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold, withSession } from "@/server/session";

export const metadata: Metadata = { title: fr.settingsHousehold.title };

const t = fr.settingsHousehold;
const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const TIMEZONES = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Luxembourg",
  "America/Montreal",
  "Indian/Reunion",
  "America/Martinique",
  "America/Guadeloupe",
  "Pacific/Noumea",
  "Africa/Casablanca",
  "UTC",
];

/** Section Foyer (§6) : le foyer, ses membres et leur présence, les comptes liés et les invitations. */
export default async function HouseholdSettingsPage() {
  const { user, household } = await requireHousehold("/settings/household");
  if (household.role !== "admin") redirect("/settings/profile");
  const ctx = await loadHouseholdContext(household.id);
  // École et jours de cantine des enfants, si le foyer est rattaché à une association (RLS : ses écoles seulement).
  const kids = ctx.members.filter((m) => m.kind === "child" && !m.archived);

  const { memberships, invitations, schools, links, profiles } = await withSession(async (db) => {
    const memberships = await db
      .selectFrom("memberships")
      .select(["user_id", "role", "created_at"])
      .where("household_id", "=", household.id)
      .orderBy("created_at")
      .execute();
    const invitations = await db
      .selectFrom("invitations")
      .select(["id", "role", "email", "expires_at"])
      .where("household_id", "=", household.id)
      .where("accepted_at", "is", null)
      .where("expires_at", ">", new Date().toISOString())
      .orderBy("created_at")
      .execute();
    const hh = await db
      .selectFrom("households")
      .select("association_id")
      .where("id", "=", household.id)
      .executeTakeFirst();
    const assoSchools = hh?.association_id
      ? await db
          .selectFrom("association_schools")
          .select("school_id")
          .where("association_id", "=", hh.association_id)
          .execute()
      : [];
    const schoolIds = assoSchools.map((s) => s.school_id);
    const schools = schoolIds.length
      ? await db
          .selectFrom("schools")
          .select(["id", "name", "city"])
          .where("id", "in", schoolIds)
          .orderBy("name")
          .execute()
      : [];
    const links = kids.length
      ? await db
          .selectFrom("member_schools")
          .select(["member_id", "school_id", "canteen_days"])
          .where(
            "member_id",
            "in",
            kids.map((k) => k.id),
          )
          .execute()
      : [];
    const userIds = memberships.map((m) => m.user_id);
    const profiles = userIds.length
      ? await db
          .selectFrom("profiles")
          .select(["user_id", "display_name"])
          .where("user_id", "in", userIds)
          .execute()
      : [];
    return { memberships, invitations, schools, links, profiles };
  });
  const nameOf = (id: string) => profiles.find((p) => p.user_id === id)?.display_name ?? "—";

  return (
    <>
      <HouseholdDetailsForm
        initial={{ name: ctx.name, timezone: ctx.timezone, alternatingFrom: ctx.alternatingFrom }}
        timezones={TIMEZONES.includes(ctx.timezone) ? TIMEZONES : [ctx.timezone, ...TIMEZONES]}
      />
      <MembersForm
        members={ctx.members}
        presence={ctx.presence}
        weekStart={mondayOf(todayIn(ctx.timezone))}
        alternating={ctx.alternatingFrom !== null}
      />

      {schools?.length && kids.length ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-extrabold">{fr.ecole.school}</h2>
          <p className="text-sm text-muted">{fr.ecole.schoolHint}</p>
          <ChildSchoolForm
            schools={schools}
            kids={kids.map((k) => {
              const link = links?.find((l) => l.member_id === k.id);
              return {
                memberId: k.id,
                name: k.name,
                schoolId: link?.school_id ?? null,
                days: link?.canteen_days ?? [1, 2, 4, 5],
              };
            })}
          />
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-extrabold">{t.accounts}</h2>
        <ul className="flex flex-col divide-y divide-line">
          {(memberships ?? []).map((m) => {
            const isMe = m.user_id === user.id;
            const name = nameOf(m.user_id);
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-semibold">
                  {name} {isMe && <Pill className="ml-1">{t.you}</Pill>}
                </span>
                <div className="flex flex-wrap items-start gap-2">
                  <RoleSelect
                    householdId={household.id}
                    userId={m.user_id}
                    role={m.role}
                    label={`${t.role} — ${name}`}
                  />
                  {!isMe && (
                    <ActionForm
                      action={removeAccount}
                      fields={{ householdId: household.id, userId: m.user_id }}
                      label={t.remove}
                      ariaLabel={`${t.remove} ${name}`}
                      confirm={t.removeConfirm(name)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-extrabold">{t.invitations}</h2>
        <p className="text-muted">{t.inviteLead}</p>
        <InviteForm householdId={household.id} householdName={household.name} />
        <h3 className="text-lg font-extrabold">{t.pending}</h3>
        {invitations?.length ? (
          <ul className="flex flex-col divide-y divide-line" data-testid="pending-invitations">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="font-semibold">{inv.email ?? fr.roles[inv.role]}</span>{" "}
                  <span className="text-sm text-muted">
                    · {fr.roles[inv.role]} · {t.expiresOn(dateFr.format(new Date(inv.expires_at)))}
                  </span>
                </span>
                <ActionForm action={revokeInvitation} fields={{ invitationId: inv.id }} label={t.revoke} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t.noPending}</p>
        )}
      </Card>
    </>
  );
}
