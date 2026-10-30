import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** En-tête de page : titre de niveau 1, surtitre et description facultatifs, actions à droite. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ph">
      <div className="min-w-0">
        {eyebrow && <p className="t-kicker muted first-letter:uppercase">{eyebrow}</p>}
        <h1 className="t-1 [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Titre de section (niveau 2) avec une action ou un compteur à droite. */
export function SectionHeader({ title, aside, id }: { title: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="t-2">
        {title}
      </h2>
      {aside && <div className="t-kicker muted">{aside}</div>}
    </div>
  );
}

/** État vide : une icône, une phrase qui explique, une action. */
export function EmptyState({
  icon = "sparkle",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span
        aria-hidden="true"
        className="tone-violet nb-sm grid size-14 place-items-center"
      >
        <Icon name={icon} className="ic-lg" />
      </span>
      <h2 className="t-3">{title}</h2>
      {children && <p className="muted max-w-sm">{children}</p>}
      {action}
    </div>
  );
}

const callouts = {
  info: { cls: "tone-info", icon: "info", role: "status" },
  success: { cls: "tone-success", icon: "check", role: "status" },
  warning: { cls: "tone-warning", icon: "warning", role: "status" },
  error: { cls: "tone-danger", icon: "warning", role: "alert" },
} as const satisfies Record<string, { cls: string; icon: IconName; role: "status" | "alert" }>;

/** Message en ligne : information, succès, avertissement ou erreur (annoncé aux lecteurs d'écran). */
export function Callout({ tone = "info", children }: { tone?: keyof typeof callouts; children: ReactNode }) {
  const c = callouts[tone];
  return (
    <p role={c.role} className={`callout text-sm font-bold ${c.cls}`}>
      <span className="callout-ic">
        <Icon name={c.icon} />
      </span>
      <span>{children}</span>
    </p>
  );
}

const statTones = {
  surface: "",
  "violet-soft": "tone-violet",
  blue: "tone-blue",
  yellow: "tone-banane",
  green: "tone-green",
};

/** Chiffre clé : valeur en grand, libellé et détail. */
export function StatTile({
  label,
  value,
  hint,
  tone = "surface",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof statTones;
}) {
  return (
    <div className={`card flex flex-col gap-1 ${statTones[tone]}`}>
      <span className="t-label">{label}</span>
      <span className="num-l">{value}</span>
      {hint && <span className="t-small">{hint}</span>}
    </div>
  );
}

const rowTones = {
  "violet-soft": "tone-violet",
  peach: "tone-peach",
  blue: "tone-blue",
  green: "tone-green",
  yellow: "tone-banane",
};

/** Ligne de liste : pastille d'icône, titre, sous-titre, élément de fin. */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  tone = "violet-soft",
}: {
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  tone?: keyof typeof rowTones;
}) {
  return (
    <div className="row">
      {icon && (
        <span
          aria-hidden="true"
          className={`avatar ${rowTones[tone]}`}
        >
          <Icon name={icon} className="size-5" />
        </span>
      )}
      <div className="row-main">
        <p className="t-3 truncate">{title}</p>
        {subtitle && <p className="t-small muted truncate">{subtitle}</p>}
      </div>
      {trailing}
    </div>
  );
}

/** Rond avec l'initiale du prénom. */
export function Avatar({ name, className = "size-12 text-lg" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`avatar tone-violet uppercase ${className}`}
    >
      {name.trim().charAt(0) || "·"}
    </span>
  );
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** Barre de progression (0 à 100). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = clamp(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className="bar"
    >
      <div className="bar-fill" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Anneau de progression avec la valeur au centre. */
export function ProgressRing({ value, label, size = 56 }: { value: number; label: string; size?: number }) {
  const v = clamp(value);
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="ring-track" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="butt"
          className="ring-edge"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
        />
      </svg>
      <span className="mono text-xs font-bold">{v}%</span>
    </div>
  );
}

/** Bloc de chargement. */
export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden="true" className={`skel ${className}`} />;
}
