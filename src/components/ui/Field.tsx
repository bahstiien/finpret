import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const control =
  "min-h-11 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base text-ink placeholder:text-muted focus:border-violet focus:outline-none";

export function TextField({
  label,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input id={id} className={control} {...props} />
    </div>
  );
}

export function SelectField({
  label,
  id,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select id={id} className={control} {...props}>
        {children}
      </select>
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
        tone === "error" ? "bg-peach text-peach-ink" : "bg-yellow-soft text-ink"
      }`}
    >
      {children}
    </p>
  );
}
