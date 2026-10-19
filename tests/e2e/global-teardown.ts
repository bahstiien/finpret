import { adminClient, TEST_EMAIL_DOMAIN, TEST_EMAIL_PREFIX } from "./helpers/auth";

/** Supprime les comptes de test (e2e-…@example.com) et les foyers qu'ils ont créés. */
export default async function globalTeardown() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = adminClient();

  const testUsers = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    testUsers.push(
      ...data.users.filter(
        (u) => u.email?.startsWith(TEST_EMAIL_PREFIX) && u.email.endsWith(TEST_EMAIL_DOMAIN),
      ),
    );
    if (data.users.length < 1000) break;
  }
  if (testUsers.length === 0) return;
  const ids = testUsers.map((u) => u.id);

  // Les foyers d'abord : la base refuse de retirer le dernier administrateur d'un foyer existant.
  const { error } = await admin.from("households").delete().in("created_by", ids);
  if (error) throw error;
  for (const id of ids) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) console.warn(`Compte de test ${id} non supprimé : ${deleteError.message}`);
  }
}
