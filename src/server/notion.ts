import "server-only";
import type { Kysely } from "kysely";
import {
  guessCategory,
  NOTION_STATUS,
  taskFromRoadmap,
  type RoadmapItem,
  type TaskStatus,
} from "@/lib/admin-board";
import type { DB } from "@/server/db.types";

/**
 * Roadmap Notion ↔ todolist du back-office. Notion reste la source : le back-office importe les lignes (titre,
 * statut, priorité, échéance, notes) et renvoie seulement le statut quand on déplace une action importée.
 * Il faut une intégration Notion interne (NOTION_TOKEN) avec accès à la base Roadmap (NOTION_ROADMAP_DB).
 */

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const DEFAULT_ROADMAP_DB = "e4ae24cc3f674180a2591ccdb7f3bfab";

export const notionAvailable = () => Boolean(process.env.NOTION_TOKEN);

async function notion(path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "notion-version": VERSION,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok)
    throw new Error(`Notion ${init.method} ${path} : ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<Record<string, unknown>>;
}

type Prop = Record<string, unknown> & { type?: string };
const plain = (rich: unknown) =>
  Array.isArray(rich) ? rich.map((r) => (r as { plain_text?: string }).plain_text ?? "").join("") : "";

/** Valeur texte d'une propriété Notion (titre, texte, sélection, statut, date de début). */
export function propValue(prop: Prop | undefined): string | null {
  if (!prop?.type) return null;
  const v = prop[prop.type] as Record<string, unknown> | unknown[] | null;
  switch (prop.type) {
    case "title":
    case "rich_text":
      return plain(v) || null;
    case "select":
    case "status":
      return ((v as { name?: string } | null)?.name ?? null) || null;
    case "date":
      return (v as { start?: string } | null)?.start ?? null;
    default:
      return null;
  }
}

/** Page de la base Roadmap → ligne utile. */
export function roadmapItemFromPage(page: {
  id: string;
  url: string;
  properties: Record<string, Prop>;
}): RoadmapItem {
  const p = page.properties;
  return {
    pageId: page.id,
    url: page.url,
    title: propValue(p["Nom"]) ?? "",
    status: propValue(p["Statut"]),
    priority: propValue(p["Priorité"]),
    phase: propValue(p["Phase"]),
    who: propValue(p["Qui"]),
    type: propValue(p["Type"]),
    due: propValue(p["Échéance"]),
    notes: propValue(p["Notes"]),
  };
}

/** Toutes les lignes (non archivées) de la roadmap. */
export async function fetchRoadmap(): Promise<RoadmapItem[]> {
  const db = process.env.NOTION_ROADMAP_DB || DEFAULT_ROADMAP_DB;
  const items: RoadmapItem[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await notion(`/databases/${db}/query`, {
      method: "POST",
      body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    for (const r of page.results as { id: string; url: string; properties: Record<string, Prop> }[])
      items.push(roadmapItemFromPage(r));
    if (!page.has_more) break;
    cursor = page.next_cursor as string;
  }
  return items;
}

/** Renvoie le statut d'une action importée vers sa ligne Notion. */
export async function pushRoadmapStatus(pageId: string, status: TaskStatus) {
  await notion(`/pages/${pageId}`, {
    method: "PATCH",
    body: { properties: { Statut: { status: { name: NOTION_STATUS[status] } } } },
  });
}

/**
 * Applique la roadmap à la table `admin_tasks` : crée les nouvelles lignes, met à jour les existantes (sauf la
 * catégorie, réglée dans le back-office), retire les lignes abandonnées ou disparues de Notion.
 */
export async function applyRoadmap(db: Kysely<DB>, items: RoadmapItem[], createdBy: string | null = null) {
  const now = new Date().toISOString();
  const existing = await db
    .selectFrom("admin_tasks")
    .select(["id", "notion_page_id", "status"])
    .where("notion_page_id", "is not", null)
    .execute();
  const byPage = new Map(existing.map((t) => [t.notion_page_id!, t]));
  const seen = new Set<string>();
  const stats = { created: 0, updated: 0, removed: 0 };
  for (const item of items) {
    const task = taskFromRoadmap(item);
    if (!task) continue;
    seen.add(item.pageId);
    const current = byPage.get(item.pageId);
    const doneAt = task.status === "done" ? now : null;
    if (current) {
      await db
        .updateTable("admin_tasks")
        .set({
          ...task,
          synced_at: now,
          // La date de fin n'est posée qu'au passage à « fait ».
          ...(current.status === task.status ? {} : { done_at: doneAt }),
        })
        .where("id", "=", current.id)
        .execute();
      stats.updated++;
    } else {
      await db
        .insertInto("admin_tasks")
        .values({
          ...task,
          category: guessCategory(task.title),
          done_at: doneAt,
          synced_at: now,
          created_by: createdBy,
        })
        .execute();
      stats.created++;
    }
  }
  const gone = existing.filter((t) => !seen.has(t.notion_page_id!)).map((t) => t.id);
  if (gone.length) {
    await db.deleteFrom("admin_tasks").where("id", "in", gone).execute();
    stats.removed = gone.length;
  }
  return stats;
}
