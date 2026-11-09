import "server-only";
import { sql } from "kysely";
import { withAdmin } from "@/server/db";
import type {
  ContactStatus,
  LeadStage,
  SegmentKey,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "@/lib/admin-board";

const count = sql<number>`count(*)`.as("n");
const num = (row: { n: number | string } | undefined) => Number(row?.n ?? 0);

/** Compteurs du menu latéral : demandes de contact nouvelles, actions ouvertes, suggestions de recettes à traiter. */
export async function navBadges() {
  return withAdmin(async (db) => ({
    inbox: num(
      await db.selectFrom("contact_messages").select(count).where("status", "=", "new").executeTakeFirst(),
    ),
    tasks: num(
      await db.selectFrom("admin_tasks").select(count).where("status", "!=", "done").executeTakeFirst(),
    ),
    recipes: num(
      await db.selectFrom("recipe_suggestions").select(count).where("status", "=", "new").executeTakeFirst(),
    ),
  }));
}

/** Données du tableau de bord : abonnements, entonnoir d'activation, séries et listes « à traiter ». */
export async function dashboardData() {
  return withAdmin(async (db) => {
    const n = async (q: { executeTakeFirst: () => Promise<{ n: number | string } | undefined> }) =>
      num(await q.executeTakeFirst());
    const subs = await db
      .selectFrom("subscriptions")
      .select(["plan", "status", count])
      .groupBy(["plan", "status"])
      .execute();
    const signups = await db
      .selectFrom("auth.users")
      .select([sql<string>`to_char(created_at, 'YYYY-MM-DD')`.as("day"), count])
      .where(sql<boolean>`created_at >= current_date - interval '29 days'`)
      .groupBy(sql`1`)
      .execute();
    const contactsWeekly = await db
      .selectFrom("contact_messages")
      .select([sql<string>`to_char(date_trunc('week', created_at), 'YYYY-MM-DD')`.as("week"), count])
      .where(sql<boolean>`created_at >= date_trunc('week', now()) - interval '7 weeks'`)
      .where("status", "!=", "spam")
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .execute();
    const tasksByCategory = await db
      .selectFrom("admin_tasks")
      .select(["category", "status", count])
      .groupBy(["category", "status"])
      .execute();
    return {
      accounts: await n(db.selectFrom("auth.users").select(count)),
      accountsPrev30: await n(
        db
          .selectFrom("auth.users")
          .select(count)
          .where(
            sql<boolean>`created_at >= current_date - interval '59 days' and created_at < current_date - interval '29 days'`,
          ),
      ),
      households: await n(db.selectFrom("households").select(count)),
      householdsWithMenu: await n(
        db.selectFrom("weeks").select(sql<number>`count(distinct household_id)`.as("n")),
      ),
      activeThisWeek: await n(
        db
          .selectFrom("weeks")
          .select(sql<number>`count(distinct household_id)`.as("n"))
          .where(sql<boolean>`updated_at >= now() - interval '7 days'`),
      ),
      subs: subs.map((s) => ({ plan: s.plan, status: s.status, n: Number(s.n) })),
      signups: signups.map((s) => ({ day: s.day, n: Number(s.n) })),
      contactsWeekly: contactsWeekly.map((w) => ({ week: w.week, n: Number(w.n) })),
      tasksByCategory: tasksByCategory.map((t) => ({
        category: t.category as TaskCategory,
        status: t.status as TaskStatus,
        n: Number(t.n),
      })),
      endingSoon: await n(
        db
          .selectFrom("subscriptions")
          .select(count)
          .where("plan", "=", "trial")
          .where(sql<boolean>`trial_ends_at between now() and now() + interval '7 days'`),
      ),
      pendingAssos: await n(db.selectFrom("associations").select(count).where("status", "=", "pending")),
      leads: await n(db.selectFrom("association_leads").select(count).where("contacted_at", "is", null)),
      payouts: await n(db.selectFrom("payouts").select(count).where("status", "=", "ready")),
      unverified: await n(
        db
          .selectFrom("auth.users")
          .select(count)
          .where("email_verified", "=", false)
          .where(sql<boolean>`created_at < now() - interval '7 days'`),
      ),
      newContactCount: await n(db.selectFrom("contact_messages").select(count).where("status", "=", "new")),
      newContacts: await db
        .selectFrom("contact_messages")
        .select(["id", "name", "email", "subject", "audience", "created_at"])
        .where("status", "=", "new")
        .orderBy("created_at", "desc")
        .limit(5)
        .execute(),
      openTasks: await db
        .selectFrom("admin_tasks")
        .select(["id", "title", "category", "status", "priority", "due_on"])
        .where("status", "!=", "done")
        .orderBy(sql`case priority when 'high' then 0 when 'normal' then 1 else 2 end`)
        .orderBy(sql`due_on nulls last`)
        .orderBy("id")
        .limit(6)
        .execute(),
    };
  });
}

export type ContactRow = {
  id: number;
  audience: "famille" | "asso";
  name: string;
  email: string;
  subject: string;
  message: string;
  association: string | null;
  school: string | null;
  status: ContactStatus;
  note: string | null;
  handled_at: string | null;
  created_at: string;
  user_id: string | null;
  handler: string | null;
};

/** Boîte de réception du CRM : demandes de contact filtrées par état, avec le compte correspondant s'il existe. */
export async function listContactMessages(opts: { status?: ContactStatus; q?: string }) {
  return withAdmin(async (db) => {
    let q = db
      .selectFrom("contact_messages as c")
      .leftJoin("auth.users as u", (j) => j.on(sql`lower(u.email)`, "=", sql`lower(c.email)`))
      .leftJoin("auth.users as h", "h.id", "c.handled_by");
    if (opts.q) {
      const like = `%${opts.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      q = q.where((eb) =>
        eb.or([
          eb("c.email", "ilike", like),
          eb("c.name", "ilike", like),
          eb("c.subject", "ilike", like),
          eb("c.message", "ilike", like),
        ]),
      );
    }
    const counts = await q
      .select(["c.status", sql<number>`count(*)`.as("n")])
      .groupBy("c.status")
      .execute();
    // Sans filtre, les messages indésirables restent cachés.
    q = opts.status ? q.where("c.status", "=", opts.status) : q.where("c.status", "!=", "spam");
    const rows = await q
      .select([
        "c.id",
        "c.audience",
        "c.name",
        "c.email",
        "c.subject",
        "c.message",
        "c.association",
        "c.school",
        "c.status",
        "c.note",
        "c.handled_at",
        "c.created_at",
        "u.id as user_id",
        "h.email as handler",
      ])
      .orderBy("c.created_at", "desc")
      .limit(200)
      .execute();
    return {
      rows: rows as ContactRow[],
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Partial<
        Record<ContactStatus, number>
      >,
    };
  });
}

/** Demandes de contact envoyées avec l'adresse d'un compte (fiche CRM du compte). */
export async function contactMessagesFor(email: string) {
  return withAdmin((db) =>
    db
      .selectFrom("contact_messages")
      .select(["id", "subject", "status", "created_at"])
      .where(sql<boolean>`lower(email) = lower(${email})`)
      .orderBy("created_at", "desc")
      .limit(20)
      .execute(),
  );
}

export type TaskRow = {
  id: number;
  title: string;
  details: string | null;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  due_on: string | null;
  created_at: string;
  done_at: string | null;
  contact_message_id: number | null;
  notion_url: string | null;
  synced_at: string | null;
};

/** Toutes les actions ; celles terminées depuis plus de 30 jours sont masquées. */
export async function listTasks() {
  const rows = await withAdmin((db) =>
    db
      .selectFrom("admin_tasks")
      .select([
        "id",
        "title",
        "details",
        "category",
        "status",
        "priority",
        "due_on",
        "created_at",
        "done_at",
        "contact_message_id",
        "notion_url",
        "synced_at",
      ])
      .where((eb) =>
        eb.or([eb("status", "!=", "done"), eb(sql`done_at`, ">=", sql`now() - interval '30 days'`)]),
      )
      .orderBy("id")
      .execute(),
  );
  return rows as TaskRow[];
}

// ---------------------------------------------------------------------------
// Prospects associations
// ---------------------------------------------------------------------------

export type LeadRow = {
  id: string;
  name: string;
  email: string;
  association_name: string;
  school: string | null;
  city: string | null;
  families_estimate: number | null;
  created_at: string;
  contacted_at: string | null;
  stage: LeadStage;
  stage_changed_at: string | null;
  note: string | null;
};

export async function listLeads() {
  const rows = await withAdmin((db) =>
    db
      .selectFrom("association_leads")
      .select([
        "id",
        "name",
        "email",
        "association_name",
        "school",
        "city",
        "families_estimate",
        "created_at",
        "contacted_at",
        "stage",
        "stage_changed_at",
        "note",
      ])
      .orderBy("created_at", "desc")
      .limit(500)
      .execute(),
  );
  return rows as LeadRow[];
}

// ---------------------------------------------------------------------------
// Étiquettes
// ---------------------------------------------------------------------------

/** Étiquettes de plusieurs comptes, regroupées par compte. */
export async function tagsFor(userIds: string[]) {
  const map = new Map<string, string[]>();
  if (!userIds.length) return map;
  const rows = await withAdmin((db) =>
    db
      .selectFrom("account_tags")
      .select(["user_id", "tag"])
      .where("user_id", "in", userIds)
      .orderBy("tag")
      .execute(),
  );
  for (const r of rows) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.tag]);
  return map;
}

/** Toutes les étiquettes utilisées, avec le nombre de comptes. */
export async function allTags() {
  const rows = await withAdmin((db) =>
    db.selectFrom("account_tags").select(["tag", count]).groupBy("tag").orderBy("tag").execute(),
  );
  return rows.map((r) => ({ tag: r.tag, n: Number(r.n) }));
}

// ---------------------------------------------------------------------------
// Fiche contact unifiée
// ---------------------------------------------------------------------------

/** Tout ce que l'on sait d'une adresse e-mail : compte, foyers, étiquettes, notes, demandes, prospect association. */
export async function contactSheet(email: string) {
  return withAdmin(async (db) => {
    const user = await db
      .selectFrom("auth.users as u")
      .leftJoin("profiles as p", "p.user_id", "u.id")
      .select([
        "u.id",
        "u.email",
        "u.created_at",
        "u.email_verified",
        "u.banned_at",
        sql<string | null>`coalesce(p.display_name, u.name)`.as("name"),
        sql<string | null>`(select max(se.updated_at) from auth.sessions se where se.user_id = u.id)`.as(
          "last_seen",
        ),
      ])
      .where(sql<boolean>`lower(u.email) = lower(${email})`)
      .executeTakeFirst();
    const [households, tags, notes, messages, leads] = await Promise.all([
      user
        ? db
            .selectFrom("memberships as m")
            .innerJoin("households as h", "h.id", "m.household_id")
            .leftJoin("subscriptions as s", "s.household_id", "h.id")
            .select([
              "h.id",
              "h.name",
              "m.role",
              "s.plan",
              "s.status",
              "s.trial_ends_at",
              sql<string | null>`(select max(w.updated_at) from weeks w where w.household_id = h.id)`.as(
                "last_menu",
              ),
              sql<number>`(select count(*) from weeks w where w.household_id = h.id)`.as("menus"),
            ])
            .where("m.user_id", "=", user.id)
            .execute()
        : [],
      user
        ? db.selectFrom("account_tags").select("tag").where("user_id", "=", user.id).orderBy("tag").execute()
        : [],
      user
        ? db
            .selectFrom("admin_notes as n")
            .leftJoin("auth.users as a", "a.id", "n.admin_id")
            .select(["n.id", "n.body", "n.created_at", "a.email as author"])
            .where("n.user_id", "=", user.id)
            .orderBy("n.created_at", "desc")
            .limit(20)
            .execute()
        : [],
      db
        .selectFrom("contact_messages")
        .select(["id", "subject", "message", "status", "audience", "created_at", "note"])
        .where(sql<boolean>`lower(email) = lower(${email})`)
        .orderBy("created_at", "desc")
        .limit(50)
        .execute(),
      db
        .selectFrom("association_leads")
        .select(["id", "association_name", "school", "city", "stage", "created_at", "note"])
        .where(sql<boolean>`lower(email) = lower(${email})`)
        .orderBy("created_at", "desc")
        .execute(),
    ]);
    // Fil chronologique de tous les échanges connus, du plus récent au plus ancien.
    const timeline = [
      ...(user ? [{ at: user.created_at, label: "Inscription" }] : []),
      ...messages.map((m) => ({ at: m.created_at, label: `Demande de contact : ${m.subject}` })),
      ...leads.map((l) => ({ at: l.created_at, label: `Demande de présentation : ${l.association_name}` })),
      ...notes.map((n) => ({ at: n.created_at, label: `Note : ${n.body.slice(0, 80)}` })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return {
      user: user ?? null,
      households: households.map((h) => ({ ...h, menus: Number(h.menus) })),
      tags: tags.map((t) => t.tag),
      notes,
      messages,
      leads,
      timeline,
    };
  });
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export type SegmentRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  plan: string | null;
};

/** Comptes d'un segment prêt à l'emploi (relances ciblées, export pour Brevo). Les comptes suspendus sont exclus. */
export async function segmentMembers(segment: SegmentKey): Promise<SegmentRow[]> {
  return withAdmin(async (db) => {
    const base = db
      .selectFrom("auth.users as u")
      .leftJoin("profiles as p", "p.user_id", "u.id")
      .leftJoin("subscriptions as s", "s.household_id", "p.active_household")
      .select([
        "u.id",
        "u.email",
        "u.created_at",
        "s.plan",
        sql<string | null>`coalesce(p.display_name, u.name)`.as("name"),
      ])
      .where("u.banned_at", "is", null);
    const hasMenu = sql<boolean>`exists (select 1 from weeks w where w.household_id = p.active_household)`;
    const recentMenu = sql<boolean>`exists (select 1 from weeks w where w.household_id = p.active_household and w.updated_at >= now() - interval '14 days')`;
    const recentSession = sql<boolean>`exists (select 1 from auth.sessions se where se.user_id = u.id and se.updated_at >= now() - interval '14 days')`;
    const q = {
      trial_no_menu: () =>
        base
          .where("s.plan", "=", "trial")
          .where(sql<boolean>`s.trial_ends_at between now() and now() + interval '7 days'`)
          .where(sql<boolean>`not ${hasMenu}`),
      paid_inactive: () =>
        base
          .where("s.plan", "in", ["monthly", "yearly"])
          .where("s.status", "=", "active")
          .where(sql<boolean>`not ${recentMenu}`)
          .where(sql<boolean>`not ${recentSession}`),
      no_household: () =>
        base
          .where(sql<boolean>`not exists (select 1 from memberships m where m.user_id = u.id)`)
          .where(sql<boolean>`u.created_at < now() - interval '2 days'`),
      trial_active: () =>
        base
          .where("s.plan", "=", "trial")
          .where(sql<boolean>`s.trial_ends_at > now()`)
          .where(hasMenu),
    }[segment]();
    const rows = await q.orderBy("u.created_at", "desc").limit(2000).execute();
    return rows.filter((r) => r.email) as SegmentRow[];
  });
}
