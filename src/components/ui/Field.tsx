import { Callout } from "./Layout";
import { Icon } from "./Icon";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { IconName } from "./Icon";

/** Texte d'aide sous un champ, relié au champ par aria-describedby. */
function FieldHelp({ id, icon, children }: { id: string; icon?: IconName; children: React.ReactNode }) {
  return (
    <p id={id} className="field-help flex items-start gap-2">
      {icon && <Icon name={icon} className="mt-px size-4" />}
      <span>{children}</span>
    </p>
  );
}

export function TextField({
  label,
  id,
  className = "",
  help,
  helpIcon,
  mono = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  help?: React.ReactNode;
  helpIcon?: IconName;
  /** Saisie d'un code : police à chasse fixe. */
  mono?: boolean;
}) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className={`input ${mono ? "mono" : ""}`}
        aria-describedby={help ? `${id}-help` : undefined}
        {...props}
      />
      {help && (
        <FieldHelp id={`${id}-help`} icon={helpIcon}>
          {help}
        </FieldHelp>
      )}
    </div>
  );
}

/** Zone de texte multiligne, avec aide et compteur de caractères si `maxLength` est donné. */
export function TextArea({
  label,
  id,
  className = "",
  help,
  rows = 5,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string; help?: React.ReactNode }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className="input !min-h-32 resize-y !py-3 leading-normal"
        aria-describedby={help ? `${id}-help` : undefined}
        {...props}
      />
      {help && <FieldHelp id={`${id}-help`}>{help}</FieldHelp>}
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
