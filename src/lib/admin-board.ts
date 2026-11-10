import { z } from "zod";
import { addDays } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Demandes de contact (CRM)
// ---------------------------------------------------------------------------

export const CONTACT_STATUSES = ["new", "in_progress", "done", "spam"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  new: "Nouvelle",
  in_progress: "En cours",
  done: "Traitée",
  spam: "Indésirable",
};

// ---------------------------------------------------------------------------
// Actions à mener (todolist interne)
// ---------------------------------------------------------------------------

export const TASK_CATEGORIES = ["dev", "marketing", "social"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export const TASK_CATEGORY_LABEL: Record<TaskCategory, string> = {
  dev: "Dev",
  marketing: "Marketing",
  social: "Réseaux sociaux",
};

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Fait",
};

export const TASK_PRIORITIES = ["high", "normal", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "Haute",
  normal: "Normale",
  low: "Basse",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

/** Saisie d'une action depuis le formulaire du back-office. */
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  details: optionalText(2000).optional().default(""),
  category: z.enum(TASK_CATEGORIES),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  due_on: z
    .union([z.literal(""), z.iso.date()])
    .optional()
    .transform((v) => v || null),
});

/** Une action ouverte est en retard si son échéance est passée. */
export const isOverdue = (t: { status: string; due_on: string | null }, today: string) =>
  t.status !== "done" && t.due_on !== null && t.due_on < today;

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

/** Ordre d'affichage : priorité haute d'abord, puis échéance la plus proche (sans échéance en dernier), puis ancienneté. */
export function sortTasks<T extends { priority: TaskPriority; due_on: string | null; id: number }>(
  tasks: T[],
): T[] {
  return [...tasks].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31") ||
      a.id - b.id,
  );
}

// ---------------------------------------------------------------------------
// Séries des graphiques
// ---------------------------------------------------------------------------

/** Série quotidienne continue de `days` jours finissant à `today` : les jours sans ligne valent 0. */
export function dailySeries(rows: { day: string; n: number | string }[], days: number, today: string) {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return { day, n: byDay.get(day) ?? 0 };
  });
}

/** Évolution en pourcentage d'une période à la précédente (null si la précédente est vide). */
export const deltaPct = (current: number, previous: number) =>
  previous ? Math.round(((current - previous) / previous) * 100) : null;

// ---------------------------------------------------------------------------
// Pipeline des prospects associations
// ---------------------------------------------------------------------------

export const LEAD_STAGES = ["to_contact", "contacted", "presented", "kit_sent", "partner", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  to_contact: "À contacter",
  contacted: "Contactée",
  presented: "Présentation faite",
  kit_sent: "Kit envoyé",
  partner: "Partenaire",
  lost: "Perdue",
};
/** Étapes du parcours, dans l'ordre (« perdue » est à part : on peut y aller depuis n'importe quelle étape). */
export const LEAD_FLOW = LEAD_STAGES.filter((s) => s !== "lost");

// ---------------------------------------------------------------------------
// Étiquettes des comptes
// ---------------------------------------------------------------------------

export const SUGGESTED_TAGS = ["ambassadeur", "bêta-testeur", "VIP", "à risque"] as const;

/** Étiquette saisie : espaces superflus retirés, 30 caractères au plus. */
export const tagSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(30));

// ---------------------------------------------------------------------------
// Roadmap Notion → actions
// ---------------------------------------------------------------------------

/** Ligne de la roadmap Notion, réduite aux propriétés utiles. */
export type RoadmapItem = {
  pageId: string;
  url: string;
  title: string;
  status: string | null;
  priority: string | null;
  phase: string | null;
  who: string | null;
  type: string | null;
  due: string | null;
  notes: string | null;
};

/** Statut Notion → colonne de la todolist (null : ligne abandonnée, à retirer). */
export function taskStatusFromNotion(status: string | null): TaskStatus | null {
  switch (status) {
    case "Fait":
      return "done";
    case "En cours":
    case "Bloqué":
    case "À vérifier":
      return "doing";
    case "Abandonné":
      return null;
    default:
      return "todo";
  }
}

/** Colonne de la todolist → statut Notion renvoyé quand on déplace une action importée. */
export const NOTION_STATUS: Record<TaskStatus, string> = { todo: "À faire", doing: "En cours", done: "Fait" };

export function taskPriorityFromNotion(priority: string | null): TaskPriority {
  if (priority?.startsWith("P0") || priority?.startsWith("P1")) return "high";
  if (priority?.startsWith("P3")) return "low";
  return "normal";
}

/**
 * Catégorie devinée à l'import (la roadmap n'en a pas) : réseaux sociaux et marketing reconnus par mots-clés,
 * le reste en dev. Elle n'est fixée qu'à la création : une catégorie corrigée dans le back-office est conservée.
 */
export function guessCategory(title: string): TaskCategory {
  const t = title.toLowerCase();
  if (/instagram|tiktok|facebook|linkedin|pinterest|r[ée]seaux? sociaux|\bpost\b|carrousel|reel/.test(t))
    return "social";
  if (
    /seo|search console|bing|charte|brand|marque|b[êe]ta|lancement|newsletter|campagne|landing|presse|partenaire|marketing/.test(
      t,
    )
  )
    return "marketing";
  return "dev";
}

/** Champs d'une action calculés depuis une ligne de la roadmap (null si la ligne est abandonnée). */
export function taskFromRoadmap(item: RoadmapItem) {
  const status = taskStatusFromNotion(item.status);
  if (!status) return null;
  const context = [
    item.phase,
    item.who && `Qui : ${item.who}`,
    item.type,
    item.status !== NOTION_STATUS[status] && item.status,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: item.title.trim().slice(0, 160) || "Sans titre",
    details: [context, item.notes?.trim()].filter(Boolean).join("\n\n").slice(0, 2000) || null,
    status,
    priority: taskPriorityFromNotion(item.priority),
    due_on: item.due ? item.due.slice(0, 10) : null,
    notion_page_id: item.pageId,
    notion_url: item.url,
  };
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export const SEGMENTS = {
  trial_no_menu: {
    label: "Essais qui finissent sans menu",
    description: "Essai qui se termine dans les 7 jours, aucun menu généré : à relancer en priorité.",
  },
  paid_inactive: {
    label: "Payants inactifs depuis 14 jours",
    description: "Abonnés actifs sans connexion ni menu modifié depuis 14 jours : risque de résiliation.",
  },
  no_household: {
    label: "Comptes sans foyer",
    description: "Inscrits depuis plus de 2 jours qui n'ont jamais créé de foyer.",
  },
  trial_active: {
    label: "Essais engagés",
    description: "Essai en cours avec au moins un menu : bons candidats pour l'offre annuelle.",
  },
} as const;
export type SegmentKey = keyof typeof SEGMENTS;
export const SEGMENT_KEYS = Object.keys(SEGMENTS) as SegmentKey[];
