import "server-only";
import { formatLong } from "@/lib/dates";
import { type TutoInput, tutoSourceHash } from "@/lib/tuto";
import { withAdmin } from "@/server/db";
import { type Bucket, readStoredFile, storeFile } from "@/server/files";
import { renderTutoPdf } from "@/server/pdf/tuto-pdf";

const BUCKET: Bucket = "asso-kits";

/** Données de la fiche tuto d'une association (clé de service : l'appelant a déjà vérifié l'appartenance). */
export async function tutoInputFor(associationId: string, baseUrl: string): Promise<TutoInput | null> {
  const { a, schools } = await withAdmin(async (db) => {
    const a = await db
      .selectFrom("associations")
      .select(["name", "code", "status", "approved_at", "created_at"])
      .where("id", "=", associationId)
      .executeTakeFirst();
    const schools = a
      ? await db
          .selectFrom("association_schools")
          .innerJoin("schools", "schools.id", "association_schools.school_id")
          .select(["schools.name", "schools.city"])
          .where("association_schools.association_id", "=", associationId)
          .execute()
      : [];
    return { a, schools };
  });
  if (!a || a.status !== "approved") return null;
  const day = (iso: string) => formatLong(iso.slice(0, 10));
  return {
    associationName: a.name,
    code: a.code,
    schools,
    startDate: day(a.approved_at ?? a.created_at),
    generatedAt: day(new Date().toISOString()),
    baseUrl,
  };
}

/**
 * PDF de la fiche tuto : relu sur le disque tant que (nom, code, écoles) n'ont pas changé, sinon régénéré, stocké
 * (`asso-kits/[association_id]/fiche-tuto.pdf`) et mémorisé avec son hash dans `association_kits`.
 */
export async function tutoPdfFor(associationId: string, baseUrl: string): Promise<Buffer | null> {
  const input = await tutoInputFor(associationId, baseUrl);
  if (!input) return null;
  const hash = tutoSourceHash(input);
  const path = `${associationId}/fiche-tuto.pdf`;

  const kit = await withAdmin((db) =>
    db
      .selectFrom("association_kits")
      .select("source_hash")
      .where("association_id", "=", associationId)
      .executeTakeFirst(),
  );
  if (kit?.source_hash === hash) {
    const file = await readStoredFile(BUCKET, path);
    if (file) return file;
  }

  const pdf = await renderTutoPdf(input);
  const stored = await storeFile(BUCKET, path, pdf).then(
    () => true,
    () => false,
  );
  if (stored) {
    const row = {
      association_id: associationId,
      tuto_pdf_path: path,
      generated_at: new Date().toISOString(),
      source_hash: hash,
    };
    await withAdmin((db) =>
      db
        .insertInto("association_kits")
        .values(row)
        .onConflict((oc) =>
          oc.column("association_id").doUpdateSet({
            tuto_pdf_path: row.tuto_pdf_path,
            generated_at: row.generated_at,
            source_hash: row.source_hash,
          }),
        )
        .execute(),
    ).catch(() => null);
  }
  return pdf;
}
