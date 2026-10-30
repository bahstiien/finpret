import { expect, test } from "@playwright/test";
import { textPdf } from "../../scripts/lib/text-pdf.mjs";
import { adminDb, dbConfigured, householdIdOf, signInFromLoginPage, uniqueEmail } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";

// §13 Cantine et critères de M10 : un PDF donne des menus datés à valider ; l'alerte doublon s'affiche.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Toutes les bases de FOOD_GROUPS : le dîner de la semaine en partage forcément une.
const EVERYTHING =
  "Coquillettes, riz, colin, poulet, steak hache, jambon, omelette, frites, pizza, lentilles";

test("menus de la cantine importés d'un PDF, validés, puis alerte doublon dans le programme du jour", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("cantine");
  await page.goto("/login");
  await signInFromLoginPage(page, email);
  await completeOnboarding(page, "Cantine");

  // Léo mange à la cantine tous les midis de la semaine.
  const db = adminDb();
  const householdId = await householdIdOf(email);
  const leo = await db
    .insertInto("members")
    .values({ household_id: householdId, name: "Léo", kind: "child", birthdate: "2018-03-01" })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("presence_rules")
    .values(
      [1, 2, 3, 4, 5].map((weekday) => ({
        member_id: leo.id,
        weekday,
        meal: "lunch" as const,
        present: false,
        week_parity: "all" as const,
      })),
    )
    .execute();

  // Semaine affichée par le Menu : la semaine en cours, sinon la suivante.
  const weeks = await db
    .selectFrom("weeks")
    .select("start_date")
    .where("household_id", "=", householdId)
    .orderBy("start_date")
    .execute();
  const today = new Date().toISOString().slice(0, 10);
  const start =
    weeks.map((w) => w.start_date).find((s) => s <= today && today <= addDays(s, 6)) ?? weeks[0]!.start_date;
  const lines = ["Restaurant scolaire - menus (exemple fictif)"];
  for (let i = 0; i < 5; i++) {
    const date = addDays(start, i);
    lines.push(
      `${DAYS[i]} ${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`,
      EVERYTHING,
    );
  }

  await page.goto("/settings/canteen");
  const card = page.getByTestId("canteen-Léo");
  await expect(card).toContainText("Cantine : lundi, mardi, mercredi, jeudi, vendredi");
  await card.getByTestId("canteen-pdf-Léo").setInputFiles({
    name: "menus.pdf",
    mimeType: "application/pdf",
    buffer: textPdf(lines),
  });
  await expect(card.getByText("5 menus lus : vérifie-les puis valide.")).toBeVisible({ timeout: 20_000 });
  const pending = card.getByTestId("canteen-pending");
  await expect(pending).toContainText("5 menus à valider");
  await pending.getByRole("button", { name: "Valider ces menus" }).click();
  await expect(card.getByText("5 menus validés.")).toBeVisible();
  await expect(card.getByTestId("canteen-pending")).toHaveCount(0);

  // Programme du jour : la cantine de Léo, et l'alerte quand le dîner a la même base.
  await page.goto("/app");
  let alerted = false;
  for (let i = 0; i < 5 && !alerted; i++) {
    // Bouton du jour dans la frise (« lundi 26 », « mardi 27, aujourd'hui »).
    await page
      .getByRole("button", { name: new RegExp(`^${DAYS[i]!.toLowerCase()} \\d+(, aujourd.hui)?$`) })
      .click();
    await expect(page.getByTestId("canteen-today")).toContainText("Cantine de Léo");
    alerted = (await page.getByTestId("canteen-duplicate").count()) > 0;
  }
  expect(alerted).toBe(true);
  await expect(page.getByTestId("canteen-duplicate").first()).toContainText(
    "Même base qu'à la cantine ce midi",
  );
});
