import { expect, test } from "@playwright/test";
import { FEATURES } from "../../src/lib/features";
import { adminClient, signInFromLoginPage, supabaseConfigured, uniqueEmail } from "./helpers/auth";
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
  test.skip(!supabaseConfigured, "Supabase n'est pas configuré (voir .env.example)");
  test.setTimeout(90_000);
  const email = uniqueEmail("notif");
  await page.goto("/login");
  await signInFromLoginPage(page, email);
  await completeOnboarding(page, "Rappels");

  // Consentement et rappel « courses » seul ; courses le samedi (9 h).
  const admin = adminClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email)!;
  await admin
    .from("user_settings")
    .update({
      notifications: {
        push: true,
        email: false,
        dinner: { enabled: false, time: "17:30" },
        thaw: { enabled: false, time: "20:30" },
        shoppingReady: true,
        sessionStart: false,
        consentAt: new Date().toISOString(),
      },
    })
    .eq("user_id", user.id);
  const { data: membership } = await admin
    .from("memberships")
    .select("household_id")
    .eq("user_id", user.id)
    .single();
  const { data: settings } = await admin
    .from("household_settings")
    .select("shopping")
    .eq("household_id", membership!.household_id)
    .single();
  await admin
    .from("household_settings")
    .update({ shopping: { ...(settings!.shopping as object), shoppingDay: 6 } })
    .eq("household_id", membership!.household_id);

  // Samedi 9 h 05 à Paris, deux passages dans la même fenêtre.
  const at = "2026-10-24T07:05:00Z";
  const headers = { authorization: `Bearer ${cronSecret()}` };
  const first = await request.get(`/api/cron/notify?at=${at}`, { headers });
  expect(first.ok()).toBe(true);
  const second = await request.get(`/api/cron/notify?at=${encodeURIComponent("2026-10-24T07:12:00Z")}`, {
    headers,
  });
  expect((await second.json()).duplicates).toBeGreaterThanOrEqual(1);

  const { data: log } = await admin
    .from("notification_log")
    .select("kind, day, payload")
    .eq("user_id", user.id);
  expect(log).toHaveLength(1);
  expect(log![0]).toMatchObject({ kind: "shopping", day: "2026-10-24" });
  expect((log![0]!.payload as { body: string }).body).toMatch(/^Courses : \d+ articles?\.$/);
});
