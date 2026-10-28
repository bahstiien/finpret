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
    <header className="flex items-start justify-between gap-4 min-[900px]:items-center">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-semibold text-muted first-letter:uppercase">{eyebrow}</p>}
        <h1 className="text-4xl font-bold [overflow-wrap:anywhere]">{title}</h1>
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
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      {aside && <div className="text-sm text-muted">{aside}</div>}
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
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface p-8 text-center">
      <span
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-full bg-violet-soft text-violet-strong"
      >
        <Icon name={icon} className="size-7" />
      </span>
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <p className="max-w-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}

const callouts = {
  info: { cls: "bg-blue-soft text-blue-ink", icon: "info", role: "status" },
  success: { cls: "bg-green-soft text-green-ink", icon: "check", role: "status" },
  warning: { cls: "bg-yellow-soft text-cream-ink", icon: "warning", role: "status" },
  error: { cls: "bg-peach text-peach-ink", icon: "warning", role: "alert" },
} as const satisfies Record<string, { cls: string; icon: IconName; role: "status" | "alert" }>;

/** Message en ligne : information, succès, avertissement ou erreur (annoncé aux lecteurs d'écran). */
export function Callout({ tone = "info", children }: { tone?: keyof typeof callouts; children: ReactNode }) {
  const c = callouts[tone];
  return (
    <p
      role={c.role}
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${c.cls}`}
    >
      <Icon name={c.icon} className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const statTones = {
  surface: "bg-surface",
  "violet-soft": "bg-violet-soft text-violet-strong",
  blue: "bg-blue-soft text-blue-ink",
  yellow: "bg-yellow-soft",
  green: "bg-green-soft text-green-ink",
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
    <div className={`flex flex-col gap-1 rounded-card p-4 ${statTones[tone]}`}>
      <span className="text-sm font-semibold opacity-80">{label}</span>
      <span className="font-display text-3xl font-bold">{value}</span>
      {hint && <span className="text-sm opacity-80">{hint}</span>}
    </div>
  );
}

const rowTones = {
  "violet-soft": "bg-violet-soft text-violet-strong",
  peach: "bg-peach text-peach-ink",
  blue: "bg-blue-soft text-blue-ink",
  green: "bg-green-soft text-green-ink",
  yellow: "bg-yellow-soft text-cream-ink",
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
    <div className="flex min-h-14 items-center gap-4 rounded-2xl bg-surface p-3">
      {icon && (
        <span
          aria-hidden="true"
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${rowTones[tone]}`}
        >
          <Icon name={icon} className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
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
      className={`grid shrink-0 place-items-center rounded-full bg-violet font-display font-bold text-white uppercase ${className}`}
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
      className="h-3 w-full overflow-hidden rounded-pill bg-chip"
    >
      <div
        className="h-full rounded-pill bg-green transition-[width] duration-300"
        style={{ width: `${v}%` }}
      />
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
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-chip" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-green transition-[stroke-dashoffset] duration-300"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
        />
      </svg>
      <span className="text-xs font-bold">{v}%</span>
    </div>
  );
}

/** Bloc de chargement. */
export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
