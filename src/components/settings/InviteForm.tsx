"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { createInvitation, type InviteState } from "@/server/actions/households";

const t = fr.settingsHousehold;

export function InviteForm({ householdId, householdName }: { householdId: string; householdName: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvitation, {});
  const [copied, setCopied] = useState(false);
  const link = state.token ? `${window.location.origin}/join/${state.token}` : null;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="householdId" value={householdId} />
        <SelectField id="invite-role" name="role" label={t.inviteRole} defaultValue="member">
          {(FEATURES.viewerRole
            ? (["member", "viewer", "admin"] as const)
            : (["member", "admin"] as const)
          ).map((r) => (
            <option key={r} value={r}>
              {fr.roles[r]} — {fr.roleHints[r]}
            </option>
          ))}
        </SelectField>
        <TextField id="invite-email" name="email" type="email" label={t.inviteEmail} autoComplete="off" />
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <Button type="submit" disabled={pending}>
          {t.inviteCreate}
        </Button>
      </form>

      {link && (
        <Card as="div" tone="banane" padding="cozy" className="flex flex-col gap-3">
          <label htmlFor="invite-link" className="field-label">
            {t.inviteLink}
          </label>
          <input
            id="invite-link"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="input mono"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="dark"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? t.copied : t.copy}
            </Button>
            {"share" in navigator && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigator.share({ text: t.shareText(householdName), url: link }).catch(() => {})
                }
              >
                {t.share}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
