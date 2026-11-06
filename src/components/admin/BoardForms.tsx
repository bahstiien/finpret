"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  type TaskCategory,
  type TaskPriority,
} from "@/lib/admin-board";
import type { ActionResult } from "@/server/errors";

type Action = (formData: FormData) => Promise<ActionResult<unknown>>;

/** Envoie le formulaire à l'action, affiche l'erreur éventuelle et rappelle `onDone` en cas de succès. */
function useActionSubmit(action: Action, onDone?: (form: HTMLFormElement) => void) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await action(formData);
      setError(result.ok ? undefined : result.error);
      setSaved(result.ok);
      if (result.ok) onDone?.(form);
    });
  };
  return { error, saved, pending, onSubmit };
}

/** Note interne (demande de contact, prospect association). */
export function NoteForm({ id, note, action }: { id: number | string; note: string | null; action: Action }) {
  const { error, saved, pending, onSubmit } = useActionSubmit(action);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="field-label flex flex-col gap-1">
        Note interne
        <textarea
          name="note"
          defaultValue={note ?? ""}
          maxLength={2000}
          rows={2}
          className="input min-h-20 py-2"
          placeholder="Ce qui a été répondu, la suite à donner…"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          Enregistrer la note
        </Button>
        {saved && !pending && <span className="t-small muted">Enregistrée.</span>}
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </form>
  );
}

export type TaskDraft = {
  id?: number;
  title: string;
  details: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  due_on: string | null;
};

/** Création ou modification d'une action (titre, catégorie, priorité, échéance, détails). */
export function TaskForm({
  action,
  task,
  submitLabel,
  onDone,
}: {
  action: Action;
  task?: TaskDraft;
  submitLabel: string;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { error, pending, onSubmit } = useActionSubmit(action, (form) => {
    if (!task) form.reset();
    onDone?.();
  });
  const uid = task?.id ?? "new";
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      {task?.id && <input type="hidden" name="id" value={task.id} />}
      <label className="field-label flex flex-col gap-1" htmlFor={`task-title-${uid}`}>
        Action
      </label>
      <input
        id={`task-title-${uid}`}
        name="title"
        required
        maxLength={160}
        defaultValue={task?.title}
        className="input"
        placeholder="Ex. : publier le carrousel « semaine type » sur Instagram"
      />
      <div className="grid gap-3 min-[600px]:grid-cols-3">
        <label className="field-label flex flex-col gap-1">
          Catégorie
          <select name="category" defaultValue={task?.category ?? "dev"} className="input">
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TASK_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label flex flex-col gap-1">
          Priorité
          <select name="priority" defaultValue={task?.priority ?? "normal"} className="input">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label flex flex-col gap-1">
          Échéance
          <input type="date" name="due_on" defaultValue={task?.due_on ?? ""} className="input" />
        </label>
      </div>
      <label className="field-label flex flex-col gap-1">
        Détails
        <textarea
          name="details"
          defaultValue={task?.details ?? ""}
          maxLength={2000}
          rows={2}
          className="input min-h-20 py-2"
        />
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </form>
  );
}

/** Petit bouton d'action (changer d'état, supprimer) : champs cachés, confirmation facultative, erreur en ligne. */
export function QuickAction({
  action,
  fields,
  label,
  variant = "outline",
  confirm,
  ariaLabel,
}: {
  action: Action;
  fields: Record<string, string | number>;
  label: string;
  variant?: "primary" | "outline" | "dark" | "ghost" | "danger";
  confirm?: string;
  ariaLabel?: string;
}) {
  const { error, pending, onSubmit } = useActionSubmit(action);
  return (
    <form
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) return event.preventDefault();
        onSubmit(event);
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="sm" variant={variant} disabled={pending} aria-label={ariaLabel}>
        {label}
      </Button>
      {error && <span className="t-small text-[var(--danger)]">{error}</span>}
    </form>
  );
}

/** Transforme une demande de contact en action : choix de la catégorie puis création. */
export function TaskFromContactForm({ id, action }: { id: number; action: Action }) {
  const { error, saved, pending, onSubmit } = useActionSubmit(action);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`task-cat-${id}`}>
        Catégorie de l&apos;action
      </label>
      <select id={`task-cat-${id}`} name="category" defaultValue="dev" className="input !min-h-11 !w-auto">
        {TASK_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {TASK_CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Créer une action
      </Button>
      {saved && !pending && <span className="t-small muted">Action créée.</span>}
      {error && <span className="t-small text-[var(--danger)]">{error}</span>}
    </form>
  );
}

/** Étiquettes d'un compte : retrait d'un clic, ajout avec suggestions. */
export function TagEditor({
  userId,
  tags,
  suggestions,
  add,
  remove,
}: {
  userId: string;
  tags: string[];
  suggestions: readonly string[];
  add: Action;
  remove: Action;
}) {
  const { error, pending, onSubmit } = useActionSubmit(add, (form) => form.reset());
  const [removing, startRemove] = useTransition();
  const listId = `tags-${userId}`;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2" aria-label="Étiquettes">
        {tags.map((tag) => (
          <li key={tag}>
            <button
              type="button"
              className="pill tone-violet inline-flex min-h-8 items-center gap-1"
              disabled={removing}
              aria-label={`Retirer l'étiquette ${tag}`}
              onClick={() =>
                startRemove(async () => {
                  const fd = new FormData();
                  fd.set("userId", userId);
                  fd.set("tag", tag);
                  await remove(fd);
                })
              }
            >
              {tag} <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
        {!tags.length && <li className="t-small muted">Aucune étiquette.</li>}
      </ul>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <label className="sr-only" htmlFor={`${listId}-input`}>
          Nouvelle étiquette
        </label>
        <input
          id={`${listId}-input`}
          name="tag"
          list={listId}
          maxLength={30}
          required
          placeholder="ambassadeur, VIP…"
          className="input !min-h-11 !w-48"
        />
        <datalist id={listId}>
          {suggestions
            .filter((s) => !tags.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Ajouter
        </Button>
      </form>
      {error && <span className="t-small text-[var(--danger)]">{error}</span>}
    </div>
  );
}
