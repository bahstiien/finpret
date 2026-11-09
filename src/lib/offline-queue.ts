/**
 * File des modifications de la liste de courses faites hors ligne (§8.3), rejouées au retour du réseau.
 * Chaque opération porte sur un seul article : rien n'écrase la liste des autres.
 */

export type NewItem = {
  id: string;
  household_id: string;
  week_id: string;
  source: "manual" | "pantry_check";
  ingredient_key: string | null;
  label: string | null;
  qty_text: string | null;
  aisle: string;
};

/** Modification d'un article ajouté à la main : son rayon ou sa quantité. */
export type ItemPatch = { aisle?: string; qty_text?: string | null };

export type QueuedOp =
  | { op: "check"; id: string; checked: boolean }
  | { op: "add"; item: NewItem }
  | { op: "delete"; id: string }
  | { op: "edit"; id: string; patch: ItemPatch };

/** Ajoute une opération en simplifiant la file : la dernière coche d'un article l'emporte ; ajout puis suppression s'annulent. */
export function enqueue(queue: readonly QueuedOp[], op: QueuedOp): QueuedOp[] {
  if (op.op === "check") {
    const added = queue.find((q) => q.op === "add" && q.item.id === op.id);
    if (added) return [...queue, op];
    return [...queue.filter((q) => !(q.op === "check" && q.id === op.id)), op];
  }
  if (op.op === "edit") {
    // Article encore en file : la modification rejoint l'ajout ; sinon la dernière modification de chaque champ l'emporte.
    const added = queue.findIndex((q) => q.op === "add" && q.item.id === op.id);
    if (added >= 0) {
      const a = queue[added] as Extract<QueuedOp, { op: "add" }>;
      return queue.map((q, i) => (i === added ? { op: "add", item: { ...a.item, ...op.patch } } : q));
    }
    const prev = queue.find((q): q is Extract<QueuedOp, { op: "edit" }> => q.op === "edit" && q.id === op.id);
    const merged = { ...op, patch: { ...prev?.patch, ...op.patch } };
    return [...queue.filter((q) => !(q.op === "edit" && q.id === op.id)), merged];
  }
  if (op.op === "delete") {
    const wasAdded = queue.some((q) => q.op === "add" && q.item.id === op.id);
    const rest = queue.filter(
      (q) =>
        !((q.op === "check" || q.op === "delete" || q.op === "edit") && q.id === op.id) &&
        !(q.op === "add" && q.item.id === op.id),
    );
    return wasAdded ? rest : [...rest, op];
  }
  return [...queue, op];
}

const key = (weekId: string) => `shopping-queue:${weekId}`;

export function loadQueue(weekId: string): QueuedOp[] {
  try {
    const raw = localStorage.getItem(key(weekId));
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

export function saveQueue(weekId: string, queue: readonly QueuedOp[]) {
  try {
    if (queue.length) localStorage.setItem(key(weekId), JSON.stringify(queue));
    else localStorage.removeItem(key(weekId));
  } catch {
    // Stockage indisponible (navigation privée) : la file reste en mémoire.
  }
}
