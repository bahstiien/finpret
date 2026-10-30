import "server-only";
import { formatLong } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { type TutoInput, tutoSourceHash } from "@/lib/tuto";
import { renderTutoPdf } from "@/server/pdf/tuto-pdf";

const BUCKET = "asso-kits";

/** Données de la fiche tuto d'une association (clé de service : l'appelant a déjà vérifié l'appartenance). */
export async function tutoInputFor(associationId: string, baseUrl: string): Promise<TutoInput | null> {
  const db = createAdminClient();
  const { data: a } = await db
    .from("associations")
    .select("name, code, status, approved_at, created_at, association_schools(schools(name, city))")
    .eq("id", associationId)
    .maybeSingle();
  if (!a || a.status !== "approved") return null;
  const links = a.association_schools as unknown as { schools: { name: string; city: string } | null }[];
  const day = (iso: string) => formatLong(iso.slice(0, 10));
  return {
    associationName: a.name,
    code: a.code,
    schools: links.flatMap((l) => (l.schools ? [l.schools] : [])),
    startDate: day(a.approved_at ?? a.created_at),
    generatedAt: day(new Date().toISOString()),
    baseUrl,
  };
}

/**
 * PDF de la fiche tuto : relu dans Storage tant que (nom, code, écoles) n'ont pas changé, sinon régénéré, stocké
 * (`asso-kits/[association_id]/fiche-tuto.pdf`) et mémorisé avec son hash dans `association_kits`.
 */
export async function tutoPdfFor(associationId: string, baseUrl: string): Promise<Buffer | null> {
  const input = await tutoInputFor(associationId, baseUrl);
  if (!input) return null;
  const db = createAdminClient();
  const hash = tutoSourceHash(input);
  const path = `${associationId}/fiche-tuto.pdf`;

  const { data: kit } = await db
    .from("association_kits")
    .select("source_hash")
    .eq("association_id", associationId)
    .maybeSingle();
  if (kit?.source_hash === hash) {
    const { data: file } = await db.storage.from(BUCKET).download(path);
    if (file) return Buffer.from(await file.arrayBuffer());
  }

  const pdf = await renderTutoPdf(input);
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (!error) {
    await db.from("association_kits").upsert({
      association_id: associationId,
      tuto_pdf_path: path,
      generated_at: new Date().toISOString(),
      source_hash: hash,
    });
  }
  return pdf;
}
