import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HouseholdDetailsForm, MembersForm } from "@/components/settings/HouseholdForms";
import { InviteForm } from "@/components/settings/InviteForm";
import { RoleSelect } from "@/components/settings/RoleSelect";
import { ActionForm } from "@/components/ui/ActionForm";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { fr } from "@/i18n/fr";
import { mondayOf, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { removeAccount, revokeInvitation } from "@/server/actions/households";
import { loadHouseholdContext } from "@/server/household-context";
import { requireHousehold } from "@/server/session";

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
  const supabase = await createClient();
  const ctx = await loadHouseholdContext(household.id);

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("household_id", household.id)
      .order("created_at"),
    supabase
      .from("invitations")
      .select("id, role, email, expires_at")
      .eq("household_id", household.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at"),
  ]);
  const userIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);
  const nameOf = (id: string) => profiles?.find((p) => p.user_id === id)?.display_name ?? "—";

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
