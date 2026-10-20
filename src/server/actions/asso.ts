"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { codeFromName, isValidCode, normalizeCode, withSuffix } from "@/lib/association-code";
import { todayIn } from "@/lib/dates";
import { fr } from "@/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { requireManager, requireAssociation } from "@/server/asso-session";
import { MAX_PDF_BYTES, menusFromText, pdfText } from "@/server/canteen-import";
import { notifyCanteenPublished } from "@/server/canteen-notify";
import { importsThisMonth, MAX_IMPORTS_PER_MONTH } from "@/server/asso-quota";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { sendAssociationReceived } from "@/server/emails";
import { trackEvent } from "@/server/events";
import { requireUser } from "@/server/session";

const t = fr.asso;

// ---------------------------------------------------------------------------
// Inscription d'une association
// ---------------------------------------------------------------------------

export type SignupState = { error?: string };

const rnaOrSiren = z
  .string()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .refine((v) => /^W\d{9}$/.test(v) || /^\d{9}(\d{5})?$/.test(v));

const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  rna: rnaOrSiren,
  email: z.email().max(254),
  manager: z.string().trim().min(2).max(80),
  schools: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        city: z.string().trim().min(2).max(80),
        uai: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^\d{7}[A-Z]$/)
          .optional(),
      }),
    )
    .min(1)
    .max(10),
});

/** Lit les champs `school-0-name`, `school-0-city`, `school-0-uai`, … du formulaire. */
function schoolsFrom(formData: FormData) {
  const out: { name: string; city: string; uai?: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const name = String(formData.get(`school-${i}-name`) ?? "").trim();
    const city = String(formData.get(`school-${i}-city`) ?? "").trim();
    const uai = String(formData.get(`school-${i}-uai`) ?? "").trim();
    if (!name && !city && !uai) continue;
    out.push({ name, city, ...(uai ? { uai } : {}) });
  }
  return out;
}

export async function createAssociationAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const user = await requireUser("/asso/inscription");
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    rna: formData.get("rna"),
    email: String(formData.get("email") ?? "").trim(),
    manager: formData.get("manager"),
    schools: schoolsFrom(formData),
  });
  if (!parsed.success) return { error: t.signup.errors.invalid };
  const supabase = await createClient();
  const base = codeFromName(parsed.data.name);
  for (let n = 1; n <= 10; n++) {
    const code = n === 1 ? base : withSuffix(base, n);
    const { error } = await supabase.rpc("create_association", {
      p_name: parsed.data.name,
      p_rna: parsed.data.rna,
      p_email: parsed.data.email,
      p_manager: parsed.data.manager,
      p_code: code,
      p_schools: parsed.data.schools,
    });
    if (!error) {
      await trackEvent("asso_signup_started", { userId: user.id, props: { stage: "created" } });
      await sendAssociationReceived(parsed.data.email, parsed.data.name).catch(() => null);
      revalidatePath("/asso", "layout");
      redirect("/asso");
    }
    if (error.code !== "23505") {
      if (error.message === "too_many_associations") return { error: t.signup.errors.too_many_associations };
      return { error: t.signup.errors.generic };
    }
  }
  return { error: t.signup.errors.code_taken };
}

// ---------------------------------------------------------------------------
// Code, équipe
// ---------------------------------------------------------------------------

export type SimpleState = { error?: string; ok?: string; link?: string };

/** Le responsable modifie le code une seule fois (la base refuse la seconde modification). */
export async function updateCodeAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const association = await requireManager();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!isValidCode(code)) return { error: t.dashboard.codeErrors.invalid };
  if (association.codeChanged) return { error: t.dashboard.codeErrors.already };
  const supabase = await createClient();
  const { error } = await supabase.from("associations").update({ code }).eq("id", association.id);
  if (error?.code === "23505") return { error: t.dashboard.codeErrors.taken };
  if (error)
    return {
      error: error.message === "code_already_changed" ? t.dashboard.codeErrors.already : toUserMessage(error),
    };
  revalidatePath("/asso", "layout");
  return { ok: t.dashboard.codeChanged };
}

export async function inviteEditorAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const association = await requireManager();
  const email = z
    .email()
    .max(254)
    .safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { error: t.team.errors.invalid };
  const supabase = await createClient();
  const [editors, pending] = await Promise.all([
    supabase
      .from("association_members")
      .select("user_id", { count: "exact", head: true })
      .eq("association_id", association.id)
      .eq("role", "menu_editor"),
    supabase
      .from("association_invitations")
      .select("id", { count: "exact", head: true })
      .eq("association_id", association.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  if ((editors.count ?? 0) + (pending.count ?? 0) >= 3) return { error: t.team.limit };
  const { data, error } = await supabase
    .from("association_invitations")
    .insert({ association_id: association.id, email: email.data })
    .select("token")
    .single();
  if (error) return { error: t.team.errors.generic };
  revalidatePath("/asso/equipe");
  const host = (await headers()).get("host");
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return { link: `${proto}://${host}/asso/invitation/${data.token}` };
}

export async function revokeEditorInvitation(formData: FormData): Promise<ActionResult> {
  await requireManager();
  const id = z.uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("association_invitations").delete().eq("id", id.data);
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/asso/equipe");
  return { ok: true, data: undefined };
}

export async function removeEditor(formData: FormData): Promise<ActionResult> {
  const association = await requireManager();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { ok: false, error: fr.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase
    .from("association_members")
    .delete()
    .eq("association_id", association.id)
    .eq("user_id", userId.data)
    .eq("role", "menu_editor");
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath("/asso/equipe");
  return { ok: true, data: undefined };
}

/** Acceptation d'une invitation d'éditeur (après connexion). */
export async function acceptEditorInvitation(formData: FormData) {
  await requireUser("/asso");
  const token = z.string().min(10).max(100).safeParse(formData.get("token"));
  if (!token.success) redirect("/asso");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_association_invitation", { p_token: token.data });
  if (error) redirect(`/asso/invitation/${token.data}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/asso", "layout");
  redirect("/asso/menus");
}

// ---------------------------------------------------------------------------
// Menus d'école
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dish = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null);

const menuSchema = z.object({
  schoolId: z.uuid(),
  date: isoDate,
  starter: dish,
  main: dish,
  side: dish,
  dairy: dish,
  dessert: dish,
  note: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null),
});

export type MenuState = { error?: string; ok?: string };

/** L'école appartient à l'association du compte (la RLS le garantit aussi). */
async function schoolOf(associationId: string, schoolId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("association_schools")
    .select("school_id")
    .eq("association_id", associationId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return !!data;
}

/** Import d'un PDF : extraction, découpage par date, brouillons à vérifier. 8 imports par association et par mois. */
export async function importSchoolMenusPdf(_prev: MenuState, formData: FormData): Promise<MenuState> {
  const association = await requireAssociation();
  if (association.status !== "approved") return { error: t.menus.inactive };
  const schoolId = z.uuid().safeParse(formData.get("schoolId"));
  const file = formData.get("pdf");
  if (!schoolId.success || !(file instanceof File) || !(await schoolOf(association.id, schoolId.data))) {
    return { error: t.menus.errors.generic };
  }
  if (file.size > MAX_PDF_BYTES) return { error: t.menus.importTooBig };
  if ((await importsThisMonth(association.id)) >= MAX_IMPORTS_PER_MONTH)
    return { error: t.menus.importQuota_exceeded };
  const text = await pdfText(new Uint8Array(await file.arrayBuffer()));
  if (!text) return { error: t.menus.importNotPdf };
  const user = await requireUser("/asso/menus");
  await trackEvent("canteen_pdf_import", {
    userId: user.id,
    props: { association: association.id, school: schoolId.data },
  });
  const found = await menusFromText(text, todayIn("Europe/Paris"));
  if (!found.length) return { error: t.menus.importNone };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("school_menus")
    .select("date, status, association_id")
    .eq("school_id", schoolId.data)
    .in(
      "date",
      found.map((m) => m.date),
    );
  // Un menu déjà publié, ou saisi par une autre association, n'est pas écrasé par un import.
  const locked = new Set(
    (existing ?? [])
      .filter((e) => e.status === "published" || e.association_id !== association.id)
      .map((e) => e.date),
  );
  const rows = found
    .filter((m) => !locked.has(m.date))
    .map((m) => ({
      school_id: schoolId.data,
      association_id: association.id,
      date: m.date,
      main: m.text.slice(0, 200),
      status: "draft" as const,
    }));
  if (!rows.length) return { error: t.menus.importNone };
  const { error } = await supabase.from("school_menus").upsert(rows, { onConflict: "school_id,date" });
  if (error) return { error: t.menus.errors.generic };
  revalidatePath("/asso/menus");
  return { ok: t.menus.importDone(rows.length) };
}

function revalidateMenus() {
  revalidatePath("/asso/menus");
  revalidatePath("/app");
}

/** Enregistre un jour (brouillon) ou le publie ; `intent` = save | publish | delete. */
export async function saveSchoolMenu(_prev: MenuState, formData: FormData): Promise<MenuState> {
  const association = await requireAssociation();
  if (association.status !== "approved") return { error: t.menus.inactive };
  const intent = String(formData.get("intent") ?? "save");
  const parsed = menuSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.menus.errors.date };
  const m = parsed.data;
  if (!(await schoolOf(association.id, m.schoolId))) return { error: t.menus.errors.forbidden };
  const supabase = await createClient();

  if (intent === "delete") {
    const { error } = await supabase
      .from("school_menus")
      .delete()
      .eq("school_id", m.schoolId)
      .eq("date", m.date)
      .eq("association_id", association.id);
    if (error) return { error: t.menus.errors.generic };
    revalidateMenus();
    return { ok: t.menus.remove };
  }
  if (![m.starter, m.main, m.side, m.dairy, m.dessert, m.note].some(Boolean))
    return { error: t.menus.errors.empty };

  const { data: existing } = await supabase
    .from("school_menus")
    .select("id, status, association_id")
    .eq("school_id", m.schoolId)
    .eq("date", m.date)
    .maybeSingle();
  if (existing && existing.association_id !== association.id) return { error: t.menus.errors.forbidden };

  const fields = {
    starter: m.starter,
    main: m.main,
    side: m.side,
    dairy: m.dairy,
    dessert: m.dessert,
    note: m.note,
  };
  const status = intent === "publish" || existing?.status === "published" ? "published" : "draft";
  const { error } = existing
    ? await supabase
        .from("school_menus")
        .update({ ...fields, status })
        .eq("id", existing.id)
    : await supabase
        .from("school_menus")
        .insert({ school_id: m.schoolId, association_id: association.id, date: m.date, ...fields, status });
  if (error) return { error: t.menus.errors.generic };
  if (intent === "publish" && existing?.status !== "published") {
    const host = (await headers()).get("host");
    await notifyCanteenPublished(m.schoolId, [m.date], `https://${host}`);
  }
  revalidateMenus();
  return { ok: intent === "publish" ? t.menus.publishedMsg(1) : t.menus.saved };
}

/** « Tout publier » : publie les brouillons de l'école et notifie une seule fois par semaine. */
export async function publishAllDrafts(_prev: MenuState, formData: FormData): Promise<MenuState> {
  const association = await requireAssociation();
  if (association.status !== "approved") return { error: t.menus.inactive };
  const schoolId = z.uuid().safeParse(formData.get("schoolId"));
  if (!schoolId.success || !(await schoolOf(association.id, schoolId.data)))
    return { error: t.menus.errors.forbidden };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_menus")
    .update({ status: "published" })
    .eq("school_id", schoolId.data)
    .eq("association_id", association.id)
    .eq("status", "draft")
    .select("date");
  if (error) return { error: t.menus.errors.generic };
  const dates = (data ?? []).map((d) => d.date);
  if (dates.length) {
    const host = (await headers()).get("host");
    await notifyCanteenPublished(schoolId.data, dates, `https://${host}`);
  }
  revalidateMenus();
  return { ok: t.menus.publishedMsg(dates.length) };
}
