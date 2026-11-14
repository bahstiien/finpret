import { expect, type Page, test } from "@playwright/test";
import { sql } from "kysely";
import { adminDb, dbConfigured, householdIdOf, signInFromLoginPage, uniqueEmail, userIdOf } from "./helpers/auth";
import { cronSecret } from "./helpers/cron";
import { completeOnboarding } from "./helpers/onboarding";

// SPEC_PRISE_EN_MAIN §4.5, §7.5 (J7b) : séquence de messages, jouée avec le planificateur (`?at=`).
// Sans clé Brevo ni VAPID, les envois réels sont sans effet : on vérifie la réservation dans `notification_log`.
test.skip(!dbConfigured, "DATABASE_URL n'est pas configurée (voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

async function signUp(page: Page, name: string) {
  const email = uniqueEmail(name);
  await page.goto("/login");
  await signInFromLoginPage(page, email);
  await completeOnboarding(page, name);
  return { userId: await userIdOf(email), householdId: await householdIdOf(email) };
}

/** Jour de session = demain (Europe/Paris) : pas de manipulation d'horloge, on déplace le calendrier du foyer. */
async function setSessionDayTomorrow(householdId: string) {
  const weekday = new Date(Date.now() + 86_400_000).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Europe/Paris",
  });
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  await adminDb()
    .updateTable("household_settings")
    .set({ session: sql`session || jsonb_build_object('day', ${day}::int)` })
    .where("household_id", "=", householdId)
    .execute();
}

/** 18 h 30 (hiver) ou 19 h 30 (été) à Paris, aujourd'hui : après l'heure d'envoi des messages de veille. */
const eveInstant = () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  return `${today}T17:30:00Z`;
};

/** Un passage du planificateur ; le corps de la réponse accompagne tout échec. */
async function runCron(request: import("@playwright/test").APIRequestContext, at: string) {
  const res = await request.get(`/api/cron/notify?at=${encodeURIComponent(at)}`, {
    headers: { authorization: `Bearer ${cronSecret()}` },
  });
  expect(res.status(), await res.text()).toBe(200);
}

async function clearLog(userId: string) {
  await adminDb().deleteFrom("notification_log").where("user_id", "=", userId).where("kind", "=", "onboarding").execute();
}

async function sentKeys(userId: string): Promise<string[]> {
  const rows = await adminDb()
    .selectFrom("notification_log")
    .select("payload")
    .where("user_id", "=", userId)
    .where("kind", "=", "onboarding")
    .execute();
  return rows.map((r) => (r.payload as { key: string }).key).sort();
}

test("J0 : le message de bienvenue est réservé à la fin de l'onboarding, une seule fois", async ({ page, request }) => {
  test.setTimeout(240_000);
  const { userId } = await signUp(page, "msg-j0");
  await expect.poll(() => sentKeys(userId), { timeout: 30_000 }).toEqual(["welcome"]);
  // Un passage du planificateur ne le renvoie pas.
  await runCron(request, new Date().toISOString());
  expect(await sentKeys(userId)).toEqual(["welcome"]);
});

test("un seul message par jour : la veille de la session attend le lendemain de la bienvenue", async ({ page, request }) => {
  test.setTimeout(240_000);
  const { userId, householdId } = await signUp(page, "msg-un-par-jour");
  await expect.poll(() => sentKeys(userId), { timeout: 30_000 }).toEqual(["welcome"]);
  await setSessionDayTomorrow(householdId);
  // La bienvenue est partie aujourd'hui : « Demain, ta première session » ne part pas le même jour.
  await runCron(request, eveInstant());
  expect(await sentKeys(userId)).toEqual(["welcome"]);
});

test("veille de la session : un message, jamais deux, même avec deux passages", async ({ page, request }) => {
  test.setTimeout(240_000);
  const { userId, householdId } = await signUp(page, "msg-veille");
  await expect.poll(() => sentKeys(userId), { timeout: 30_000 }).toEqual(["welcome"]);
  await setSessionDayTomorrow(householdId);
  // On rejoue une situation « bienvenue partie un autre jour » : la priorité place la préparation avant la bienvenue.
  await clearLog(userId);
  await runCron(request, eveInstant());
  expect(await sentKeys(userId)).toEqual(["session_eve"]);
  await runCron(request, eveInstant());
  expect(await sentKeys(userId)).toEqual(["session_eve"]);
});

test("désinscrit et sans appareil : aucun message", async ({ page, request }) => {
  test.setTimeout(240_000);
  const { userId, householdId } = await signUp(page, "msg-desinscrit");
  await expect.poll(() => sentKeys(userId), { timeout: 30_000 }).toEqual(["welcome"]);
  await clearLog(userId);
  await adminDb()
    .updateTable("user_settings")
    .set({ notifications: sql`notifications || '{"marketingEmails": false}'::jsonb` })
    .where("user_id", "=", userId)
    .execute();
  await setSessionDayTomorrow(householdId);
  await runCron(request, eveInstant());
  expect(await sentKeys(userId)).toEqual([]);
});

test("courses déjà cochées : pas de message « Ta liste est prête »", async ({ page, request }) => {
  test.setTimeout(240_000);
  const { userId, householdId } = await signUp(page, "msg-courses");
  await expect.poll(() => sentKeys(userId), { timeout: 30_000 }).toEqual(["welcome"]);
  await clearLog(userId);
  // Courses demain, déjà cochées : l'étape est faite, le message ne part pas.
  const weekday = new Date(Date.now() + 86_400_000).toLocaleDateString("en-US", { weekday: "short", timeZone: "Europe/Paris" });
  const iso = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
  await adminDb()
    .updateTable("household_settings")
    .set({ shopping: sql`shopping || jsonb_build_object('shoppingDay', ${iso}::int)` })
    .where("household_id", "=", householdId)
    .execute();
  await adminDb()
    .insertInto("events")
    .values({ user_id: userId, household_id: householdId, name: "shopping_checked", props: sql`'{}'::jsonb` })
    .execute();
  await runCron(request, eveInstant());
  expect(await sentKeys(userId)).not.toContain("shopping_eve");
});
