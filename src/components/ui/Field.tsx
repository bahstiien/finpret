import { Callout } from "./Layout";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const control =
  "min-h-11 w-full rounded-r2 border-[length:var(--bw)] border-line bg-surface px-4 text-base text-ink placeholder:text-muted focus:outline-3 focus:outline-offset-3 focus:outline-violet focus:shadow-hard-sm";

export function TextField({
  label,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-bold uppercase tracking-[0.05em]">
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
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-bold uppercase tracking-[0.05em]">
        {label}
      </label>
      <select id={id} className={control} {...props}>
        {children}
      </select>
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return <Callout tone={tone}>{children}</Callout>;
}
