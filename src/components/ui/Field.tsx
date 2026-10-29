import { Callout } from "./Layout";
import { Icon } from "./Icon";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function TextField({
  label,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} className="input" {...props} />
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
    <div className={`field ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <span className="select-wrap">
        <select id={id} className="input" {...props}>
          {children}
        </select>
        <Icon name="chevronDown" className="ic" />
      </span>
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return <Callout tone={tone}>{children}</Callout>;
}
