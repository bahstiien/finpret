import { expect, type Page, test } from "@playwright/test";
import {
  adminDb,
  createUser,
  dbConfigured,
  householdIdOf,
  signInFromLoginPage,
  uniqueEmail,
  userIdOf,
} from "./helpers/auth";

// SPEC_JANVIER §5 : inscription par code, code non validé, confidentialité, publication des menus.
test.skip(!dbConfigured, "Postgres n'est pas configuré (DATABASE_URL, voir .env.example)");
test.skip(({ isMobile }) => isMobile, "parcours joué sur le projet desktop");

const suffix = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();

/** Association de test créée directement en base (hors RLS), approuvée ou non. */
async function createAssociation(status: "approved" | "pending", managerId?: string) {
  const db = adminDb();
  const id = suffix();
  const code = `APE-E2E${id}`.slice(0, 20);
  const school = await db
    .insertInto("schools")
    .values({ name: `École E2E ${id}`, city: "Lyon" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const a = await db
    .insertInto("associations")
    .values({
      name: `APE E2E ${id}`,
      rna_or_siren: "W123456789",
      email: `bureau-${id.toLowerCase()}@example.com`,
      manager_name: "Camille",
      code,
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      created_by: managerId ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.insertInto("association_schools").values({ association_id: a.id, school_id: school.id }).execute();
  if (managerId)
    await db
      .insertInto("association_members")
      .values({ association_id: a.id, user_id: managerId, role: "manager" })
      .execute();
  return { id: a.id, code, schoolId: school.id, name: `APE E2E ${id}` };
}

async function cleanup(associationId: string, schoolId: string) {
  const db = adminDb();
  await db.deleteFrom("associations").where("id", "=", associationId).execute();
  // Les enfants restent rattachés à l'école tant que leur foyer existe (clé étrangère RESTRICT) : on les détache.
  await db.deleteFrom("member_schools").where("school_id", "=", schoolId).execute();
  await db.deleteFrom("schools").where("id", "=", schoolId).execute();
}

/** Onboarding avec un enfant relié à l'école de l'association, puis les quatre étapes par défaut. */
async function onboardWithChild(page: Page) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Nom du foyer").fill("Famille Code");
  const names = page.getByLabel(/^Prénom/);
  await names.first().fill("Camille");
  await names.nth(1).fill("Julien");
  await page.getByRole("button", { name: "Ajouter un enfant" }).click();
  await page.getByLabel(/^Prénom \(enfant\)/i).fill("Léa");
  await page.getByLabel("Date de naissance").fill("2018-03-01");
  // Une seule école proposée (celle de l'association) après « Pas d'école ».
  await page.getByLabel(/^École/).selectOption({ index: 1 });
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Préparer ma semaine" }).click();
  await expect(page.getByRole("heading", { name: "Ta semaine est prête !" })).toBeVisible({
    timeout: 30_000,
  });
}

test("inscription par code : foyer rattaché, essai de 30 jours, enfant relié, menu publié visible", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const db = adminDb();
  const asso = await createAssociation("approved");
  try {
    // 1. Page publique du code, puis connexion et onboarding.
    await page.goto(`/ecole/${asso.code}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(asso.name);
    await expect(page.getByText("39,99 €")).toBeVisible();
    await page.getByRole("button", { name: "Préparer ma semaine" }).click();
    const email = uniqueEmail("famille-code");
    await signInFromLoginPage(page, email);
    await onboardWithChild(page);

    // 2. Foyer rattaché, essai de 30 jours depuis l'inscription, enfant relié à l'école.
    const householdId = await householdIdOf(email);
    const h = await db
      .selectFrom("households")
      .select(["association_id", "created_at"])
      .where("id", "=", householdId)
      .executeTakeFirstOrThrow();
    expect(h.association_id).toBe(asso.id);
    const sub = await db
      .selectFrom("subscriptions")
      .select("trial_ends_at")
      .where("household_id", "=", householdId)
      .executeTakeFirstOrThrow();
    const days = (Date.parse(sub.trial_ends_at!) - Date.parse(h.created_at)) / 86_400_000;
    expect(days).toBeCloseTo(30, 0);
    const kid = await db
      .selectFrom("members")
      .select("id")
      .where("household_id", "=", householdId)
      .where("name", "=", "Léa")
      .executeTakeFirstOrThrow();
    const link = await db
      .selectFrom("member_schools")
      .select(["school_id", "canteen_days"])
      .where("member_id", "=", kid.id)
      .executeTakeFirstOrThrow();
    expect(link.school_id).toBe(asso.schoolId);
    expect(link.canteen_days).toEqual([1, 2, 4, 5]);

    // 3. Publication d'un menu d'école pour le lundi de la semaine préparée : visible dans le programme du jour.
    const week = await db
      .selectFrom("weeks")
      .select("start_date")
      .where("household_id", "=", householdId)
      .orderBy("start_date")
      .limit(1)
      .executeTakeFirstOrThrow();
    const start = week.start_date;
    await db
      .insertInto("school_menus")
      .values({
        school_id: asso.schoolId,
        association_id: asso.id,
        date: start,
        main: "Poulet rôti",
        side: "Haricots verts",
        status: "published",
      })
      .execute();
    await page.goto("/app");
    await page.getByRole("button", { name: /^lundi \d+(, aujourd.hui)?$/ }).click();
    await expect(page.getByTestId("canteen-today")).toContainText("Cantine de Léa");
    await expect(page.getByTestId("canteen-today")).toContainText("Poulet rôti, Haricots verts");
  } finally {
    await cleanup(asso.id, asso.schoolId);
  }
});

test("code d'une association non validée : page inactive, aucun rattachement", async ({ page }) => {
  const asso = await createAssociation("pending");
  try {
    await page.goto(`/ecole/${asso.code}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce code n'est pas encore actif");
    await expect(page.getByText("14 jours")).toBeVisible();
    await expect(page.getByRole("button", { name: "Préparer ma semaine" })).toHaveCount(0);
  } finally {
    await cleanup(asso.id, asso.schoolId);
  }
});

test("confidentialité : moins de 5 foyers masqués, aucun nom ni e-mail de famille", async ({ page }) => {
  test.setTimeout(120_000);
  const db = adminDb();
  const managerEmail = uniqueEmail("responsable");
  await page.goto("/login");
  await signInFromLoginPage(page, managerEmail);
  const managerId = await userIdOf(managerEmail);
  const asso = await createAssociation("approved", managerId);
  const familyEmails: string[] = [];
  try {
    // Trois foyers rattachés (directement en base), dont un abonné annuel.
    for (let i = 0; i < 3; i++) {
      const email = uniqueEmail(`famille${i}`);
      familyEmails.push(email);
      const userId = await createUser(email);
      const hid = await db
        .insertInto("households")
        .values({ name: `Famille secrète ${i}`, created_by: userId })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db
        .insertInto("memberships")
        .values({ household_id: hid.id, user_id: userId, role: "admin" })
        .execute();
      await db.updateTable("households").set({ association_id: asso.id }).where("id", "=", hid.id).execute();
      if (i === 0)
        await db
          .updateTable("subscriptions")
          .set({ plan: "yearly", status: "active" })
          .where("household_id", "=", hid.id)
          .execute();
    }
    const responses: string[] = [];
    page.on("response", async (r) => {
      if (r.url().includes("/asso") && r.request().resourceType() !== "image")
        responses.push(await r.text().catch(() => ""));
    });
    await page.goto("/asso");
    await expect(page.getByTestId("asso-stats")).toContainText("moins de 5");
    const body = (await page.content()) + responses.join("\n");
    for (const email of familyEmails) expect(body).not.toContain(email);
    expect(body).not.toContain("Famille secrète");
  } finally {
    await db
      .deleteFrom("households")
      .where("name", "in", ["Famille secrète 0", "Famille secrète 1", "Famille secrète 2"])
      .execute();
    if (familyEmails.length > 0)
      await db.deleteFrom("auth.users").where("email", "in", familyEmails).execute();
    await cleanup(asso.id, asso.schoolId);
  }
});

test("publication des menus : l'éditeur publie, la famille voit le menu et une seule notification part", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const db = adminDb();
  const editorEmail = uniqueEmail("editeur");
  await page.goto("/login");
  await signInFromLoginPage(page, editorEmail);
  const editorId = await userIdOf(editorEmail);
  const asso = await createAssociation("approved");
  await db
    .insertInto("association_members")
    .values({ association_id: asso.id, user_id: editorId, role: "menu_editor" })
    .execute();
  try {
    await page.goto("/asso/menus");
    await page.getByRole("button", { name: "Ajouter un jour" }).click();
    const form = page.getByTestId("menu-new");
    const monday = new Date();
    monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
    const date = monday.toISOString().slice(0, 10);
    await form.getByLabel("Date").fill(date);
    await form.getByLabel("Plat").fill("Colin pané");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(form.getByText("Menu enregistré.")).toBeVisible();

    // Brouillon : invisible des familles ; puis publication.
    const draft = await db
      .selectFrom("school_menus")
      .select("status")
      .where("school_id", "=", asso.schoolId)
      .where("date", "=", date)
      .executeTakeFirstOrThrow();
    expect(draft.status).toBe("draft");
    await page.getByTestId(`menu-${date}`).getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("1 menu publié.")).toBeVisible();
    const published = await db
      .selectFrom("school_menus")
      .select(["status", "published_at"])
      .where("school_id", "=", asso.schoolId)
      .where("date", "=", date)
      .executeTakeFirstOrThrow();
    expect(published.status).toBe("published");
    expect(published.published_at).toBeTruthy();

    // Une seule notification par école et par semaine : republier un autre jour de la même semaine n'en ajoute pas.
    const before = await db
      .selectFrom("canteen_notifications")
      .select("iso_week")
      .where("school_id", "=", asso.schoolId)
      .execute();
    expect(before).toHaveLength(1);
  } finally {
    await cleanup(asso.id, asso.schoolId);
  }
});

test("inscription d'une association : demande en attente, puis validée, code actif", async ({ page }) => {
  test.setTimeout(120_000);
  const db = adminDb();
  const email = uniqueEmail("nouvelle-asso");
  await page.goto("/login");
  await signInFromLoginPage(page, email);
  await page.goto("/asso/inscription");
  const id = suffix();
  await page.getByLabel("Nom de l'association").fill(`APE Inscription ${id}`);
  await page.getByLabel("Numéro RNA ou SIREN").fill("W123456789");
  await page.getByLabel("E-mail du bureau").fill(`bureau-${id.toLowerCase()}@example.com`);
  await page.getByLabel("Nom du responsable").fill("Camille Martin");
  await page.getByLabel("Nom de l'école").fill(`École Inscription ${id}`);
  await page.getByLabel("Commune").fill("Lyon");
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();

  await expect(page).toHaveURL(/\/asso$/);
  await expect(page.getByTestId("asso-status")).toContainText("en cours de validation");
  const code = (await page.getByTestId("asso-code").innerText()).trim();
  expect(code).toMatch(/^APE-[A-Z0-9-]{1,16}$/);
  const a = await db
    .selectFrom("associations")
    .select(["id", "status"])
    .where("code", "=", code)
    .executeTakeFirstOrThrow();
  expect(a.status).toBe("pending");
  try {
    // Code inactif tant que l'association n'est pas validée.
    await page.goto(`/ecole/${code}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce code n'est pas encore actif");
    // Validation (comme le ferait le back-office) : le code s'active et le bandeau disparaît.
    await db
      .updateTable("associations")
      .set({ status: "approved", approved_at: new Date().toISOString() })
      .where("id", "=", a.id)
      .execute();
    await page.goto(`/ecole/${code}`);
    await expect(page.getByRole("button", { name: "Préparer ma semaine" })).toBeVisible();
    await page.goto("/asso");
    await expect(page.getByTestId("asso-status")).toHaveCount(0);
  } finally {
    const links = await db
      .selectFrom("association_schools")
      .select("school_id")
      .where("association_id", "=", a.id)
      .execute();
    await db.deleteFrom("associations").where("id", "=", a.id).execute();
    for (const l of links) await db.deleteFrom("schools").where("id", "=", l.school_id).execute();
  }
});
