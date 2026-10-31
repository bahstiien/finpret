import "server-only";
import { sql } from "kysely";
import { withAdmin } from "@/server/db";

export const PAGE_SIZE = 50;

export type AccountRow = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  email_verified: boolean;
  last_seen: string | null;
  households: number;
  plan: string | null;
  status: string | null;
};

/** Échappe `%`, `_` et `\` d'une saisie utilisée dans un ILIKE. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Tous les comptes (auth.users) avec foyers, dernière activité et offre du foyer actif : recherche + pagination. */
export async function listAccounts(opts: { q?: string; plan?: string; page: number }) {
  return withAdmin(async (db) => {
    const base = db
      .selectFrom("auth.users as u")
      .leftJoin("profiles as p", "p.user_id", "u.id")
      .leftJoin("subscriptions as s", "s.household_id", "p.active_household");
    const filtered = (() => {
      let q = base;
      if (opts.q) {
        const like = likePattern(opts.q);
        q = q.where((eb) =>
          eb.or([eb("u.email", "ilike", like), eb("u.name", "ilike", like), eb("p.display_name", "ilike", like)]),
        );
      }
      if (opts.plan === "none") q = q.where("s.plan", "is", null);
      else if (opts.plan) q = q.where("s.plan", "=", opts.plan as "trial" | "monthly" | "yearly" | "free");
      return q;
    })();
    const total = Number(
      (await filtered.select(sql<number>`count(*)`.as("n")).executeTakeFirst())?.n ?? 0,
    );
    const rows = await filtered
      .select([
        "u.id",
        "u.email",
        "u.created_at",
        "u.email_verified",
        sql<string | null>`coalesce(p.display_name, u.name)`.as("name"),
        sql<string | null>`(select max(se.updated_at) from auth.sessions se where se.user_id = u.id)`.as("last_seen"),
        sql<number>`(select count(*) from memberships m where m.user_id = u.id)`.as("households"),
        "s.plan",
        "s.status",
      ])
      .orderBy("u.created_at", "desc")
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE)
      .execute();
    return { rows: rows as AccountRow[], total };
  });
}

/** Fiche d'un compte : identité, connexions, foyers (rôle, offre) et dernières sessions. */
export async function accountDetail(id: string) {
  return withAdmin(async (db) => {
    const user = await db
      .selectFrom("auth.users as u")
      .leftJoin("profiles as p", "p.user_id", "u.id")
      .select([
        "u.id",
        "u.email",
        "u.name",
        "u.created_at",
        "u.email_verified",
        "u.banned_at",
        "u.ban_reason",
        "p.display_name",
      ])
      .where("u.id", "=", id)
      .executeTakeFirst();
    if (!user) return null;
    const [households, providers, sessions, isAdmin, notes] = await Promise.all([
      db
        .selectFrom("memberships as m")
        .innerJoin("households as h", "h.id", "m.household_id")
        .leftJoin("subscriptions as s", "s.household_id", "h.id")
        .select([
          "h.id",
          "h.name",
          "h.created_at",
          "h.association_id",
          "m.role",
          "s.plan",
          "s.status",
          "s.trial_ends_at",
          "s.current_period_end",
          "s.stripe_customer_id",
        ])
        .where("m.user_id", "=", id)
        .orderBy("h.created_at", "asc")
        .execute(),
      db.selectFrom("auth.accounts").select("provider_id").where("user_id", "=", id).execute(),
      db
        .selectFrom("auth.sessions")
        .select(["created_at", "updated_at", "ip_address", "user_agent"])
        .where("user_id", "=", id)
        .orderBy("updated_at", "desc")
        .limit(10)
        .execute(),
      db.selectFrom("admins").select("role").where("user_id", "=", id).executeTakeFirst(),
      db
        .selectFrom("admin_notes as n")
        .leftJoin("auth.users as a", "a.id", "n.admin_id")
        .select(["n.id", "n.body", "n.created_at", "a.email as author"])
        .where("n.user_id", "=", id)
        .orderBy("n.created_at", "desc")
        .limit(50)
        .execute(),
    ]);
    return {
      user,
      households,
      providers: providers.map((p) => p.provider_id),
      sessions,
      adminRole: isAdmin?.role ?? null,
      notes,
    };
  });
}
