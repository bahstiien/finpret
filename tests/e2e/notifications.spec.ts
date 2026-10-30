import { expect, test } from "@playwright/test";
import { sql } from "kysely";
import { FEATURES } from "../../src/lib/features";
import {
  adminDb,
  dbConfigured,
  householdIdOf,
  signInFromLoginPage,
  uniqueEmail,
  userIdOf,
} from "./helpers/auth";
import { cronSecret } from "./helpers/cron";
import { completeOnboarding } from "./helpers/onboarding";

// §12 Notifications et critères de M9.
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

test("le planificateur refuse un appel sans secret", async ({ request }) => {
  expect((await request.get("/api/cron/notify")).status()).toBe(401);
  const wrong = await request.get("/api/cron/notify", { headers: { authorization: "Bearer mauvais" } });
  expect(wrong.status()).toBe(401);
});

test("deux passages du planificateur n'envoient pas deux fois le même rappel", async ({ page, request }) => {
  // Le rappel « courses » est REPORTÉ (SPEC_JANVIER §2) ; l'idempotence reste couverte par les tests unitaires et pgTAP.
  test.skip(!FEATURES.shoppingSessionNotifications, "Rappels courses et session REPORTÉS");
  test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
  test.setTimeout(90_000);
  const email = uniqueEmail("notif");
  await page.goto("/login");
  await signInFromLoginPage(page, email);
  await completeOnboarding(page, "Rappels");

  // Consentement et rappel « courses » seul ; courses le samedi (9 h).
  const db = adminDb();
  const userId = await userIdOf(email);
  const notifications = {
    push: true,
    email: false,
    dinner: { enabled: false, time: "17:30" },
    thaw: { enabled: false, time: "20:30" },
    shoppingReady: true,
    sessionStart: false,
    consentAt: new Date().toISOString(),
  };
  await db
    .updateTable("user_settings")
    .set({ notifications: sql`${JSON.stringify(notifications)}::jsonb` })
    .where("user_id", "=", userId)
    .execute();
  const householdId = await householdIdOf(email);
  const settings = await db
    .selectFrom("household_settings")
    .select("shopping")
    .where("household_id", "=", householdId)
    .executeTakeFirstOrThrow();
  await db
    .updateTable("household_settings")
    .set({ shopping: sql`${JSON.stringify({ ...(settings.shopping as object), shoppingDay: 6 })}::jsonb` })
    .where("household_id", "=", householdId)
    .execute();

  // Samedi 9 h 05 à Paris, deux passages dans la même fenêtre.
  const at = "2026-10-24T07:05:00Z";
  const headers = { authorization: `Bearer ${cronSecret()}` };
  const first = await request.get(`/api/cron/notify?at=${at}`, { headers });
  expect(first.ok()).toBe(true);
  const second = await request.get(`/api/cron/notify?at=${encodeURIComponent("2026-10-24T07:12:00Z")}`, {
    headers,
  });
  expect((await second.json()).duplicates).toBeGreaterThanOrEqual(1);

  const log = await db
    .selectFrom("notification_log")
    .select(["kind", "day", "payload"])
    .where("user_id", "=", userId)
    .execute();
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ kind: "shopping", day: "2026-10-24" });
  expect((log[0]!.payload as { body: string }).body).toMatch(/^Courses : \d+ articles?\.$/);
});
