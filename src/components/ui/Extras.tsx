import type { AnchorHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

/** Petits composants du design system « Fin Prêt Néo » : classes de `neo.css`, jetons de `tokens.css`. */

type StickerTone = "surface" | "banane" | "pink" | "violet" | "green" | "blue" | "peach" | "yellow";

/** Étiquette inclinée à ombre dure (nouveautés, offres, tampons du passeport). */
export function Sticker({
  tone = "surface",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StickerTone }) {
  return (
    <span className={`sticker ${tone === "surface" ? "" : `tone-${tone}`} ${className}`} {...props}>
      {children}
    </span>
  );
}

/** Difficulté de 1 à 4 : blocs pleins et vides, lue en texte (« Difficulté 2 sur 4 »). */
export function Difficulty({ level, className = "" }: { level: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <span className={`diff ${className}`} role="img" aria-label={`Difficulté ${level} sur 4`}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={n <= level ? "on" : ""} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Point de notification : carré de 12 px, rose. `label` le rend lisible aux lecteurs d'écran. */
export function Dot({ label, className = "", style }: { label?: string; className?: string; style?: CSSProperties }) {
  return label ? (
    <span className={`dot ${className}`} role="img" aria-label={label} style={style} />
  ) : (
    <span className={`dot ${className}`} aria-hidden="true" style={style} />
  );
}

/** Lien de texte souligné (survol banane). */
export function TextLink({ className = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a className={`lnk ${className}`} {...props} />;
}

/** Case à cocher carrée ; `large` pour la session et les courses. */
export function Checkbox({
  label,
  large = false,
  hideLabel = false,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; large?: boolean; hideLabel?: boolean }) {
  return (
    <label className={`inline-flex min-h-[var(--touch-min)] items-center gap-3 ${className}`}>
      <input type="checkbox" className={`cb ${large ? "cb-lg" : ""}`} aria-label={hideLabel ? label : undefined} {...props} />
      {hideLabel ? null : <span className="t-ui">{label}</span>}
    </label>
  );
}

/** Grille collée sur des filets noirs : une cellule = un bloc (Besoin / Acheté / Reste). */
export function Bento({
  columns = 3,
  shadow = "none",
  className = "",
  style,
  children,
}: {
  columns?: number;
  shadow?: "none" | "sm" | "md";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const sh = shadow === "md" ? "var(--sh)" : shadow === "sm" ? "var(--sh-sm)" : undefined;
  return (
    <div
      className={`bento ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, boxShadow: sh, ...style }}
    >
      {children}
    </div>
  );
}

/** Fil d'Ariane : le dernier élément (page courante) est en aplat banane. */
export function Breadcrumbs({
  items,
  label = "Fil d'Ariane",
  className = "",
}: {
  items: Array<{ label: string; href?: string }>;
  label?: string;
  className?: string;
}) {
  const last = items.length - 1;
  return (
    <nav aria-label={label} className={`crumbs ${className}`}>
      {items.map((item, i) =>
        item.href && i !== last ? (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ) : (
          <span key={item.label} aria-current={i === last ? "page" : undefined}>
            {item.label}
          </span>
        ),
      )}
    </nav>
  );
}

/** Question de FAQ dépliable : fond banane quand elle est ouverte. */
export function Faq({
  question,
  defaultOpen = false,
  className = "",
  children,
}: {
  question: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={`faq ${className}`} open={defaultOpen}>
      <summary>
        <span>{question}</span>
        <Icon name="chevronDown" />
      </summary>
      <div className="faq-body">{children}</div>
    </details>
  );
}

/** Bulle d'aide contextuelle : une seule à la fois par écran, toujours fermable. */
export function Coachmark({
  title,
  step,
  primaryLabel = "Compris",
  secondaryLabel,
  arrow = "none",
  onPrimary,
  onSecondary,
  id,
  className = "",
  children,
}: {
  title: string;
  step?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  arrow?: "top" | "bottom" | "none";
  onPrimary?: () => void;
  onSecondary?: () => void;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <aside id={id} className={`coach ${className}`} aria-label={title}>
      {arrow !== "none" ? (
        <span
          className="coach-arrow"
          aria-hidden="true"
          style={arrow === "top" ? { top: -11, left: 24, transform: "rotate(225deg)" } : { bottom: -11, left: 24 }}
        />
      ) : null}
      {step ? <span className="t-kicker">{step}</span> : null}
      <strong className="t-ui">{title}</strong>
      {children ? <p className="t-small">{children}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={onPrimary}>
          {primaryLabel}
        </Button>
        {secondaryLabel ? (
          <Button variant="ghost" size="sm" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
