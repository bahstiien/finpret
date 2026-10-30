"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import type { HouseholdRole } from "@/server/db.types";
import { changeRole } from "@/server/actions/households";

export function RoleSelect({
  householdId,
  userId,
  role,
  label,
}: {
  householdId: string;
  userId: string;
  role: HouseholdRole;
  label: string;
}) {
  const [value, setValue] = useState(role);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <select
        aria-label={label}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as HouseholdRole;
          const previous = value;
          setValue(next);
          const formData = new FormData();
          formData.set("householdId", householdId);
          formData.set("userId", userId);
          formData.set("role", next);
          startTransition(async () => {
            const result = await changeRole(formData);
            if (!result.ok) {
              setValue(previous);
              setError(result.error);
            } else setError(undefined);
          });
        }}
        className="min-h-11 rounded-pill border-2 border-line bg-surface px-4 font-semibold"
      >
        {(FEATURES.viewerRole || role === "viewer"
          ? (["admin", "member", "viewer"] as const)
          : (["admin", "member"] as const)
        ).map((r) => (
          <option key={r} value={r}>
            {fr.roles[r]}
          </option>
        ))}
      </select>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  );
}
