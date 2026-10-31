"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import type { ActionResult } from "@/server/errors";

type Input = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: [value: string, label: string][];
};

/** Formulaire d'une action du back-office avec champs de saisie, confirmation facultative et message en ligne. */
export function AdminForm({
  action,
  hidden = {},
  inputs = [],
  submit,
  confirm,
  variant = "outline",
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  hidden?: Record<string, string>;
  inputs?: Input[];
  submit: string;
  confirm?: string;
  variant?: "primary" | "outline" | "dark";
  resetOnSuccess?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const res = await action(fd);
          setError(res.ok ? undefined : res.error);
          setDone(res.ok);
          if (res.ok && resetOnSuccess) form.reset();
        });
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {inputs.map((i) => (
        <label key={i.name} className="field-label flex flex-col gap-1">
          {i.label}
          {i.type === "textarea" ? (
            <textarea name={i.name} required={i.required} placeholder={i.placeholder} rows={3} maxLength={2000} className="input" />
          ) : i.type === "select" ? (
            <select name={i.name} required={i.required} className="input">
              {i.options?.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={i.name}
              type={i.type ?? "text"}
              required={i.required}
              placeholder={i.placeholder}
              step={i.type === "number" ? "any" : undefined}
              className="input"
            />
          )}
        </label>
      ))}
      <Button type="submit" variant={variant} disabled={pending}>
        {submit}
      </Button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {done && !error && <FormMessage tone="success">Fait.</FormMessage>}
    </form>
  );
}
