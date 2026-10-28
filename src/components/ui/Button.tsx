import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "outline" | "dark" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-banana text-[#17151F]",
  secondary: "bg-violet text-white",
  outline: "bg-surface text-ink hover:bg-chip",
  dark: "bg-nav text-on-nav",
  ghost: "text-ink hover:bg-chip [box-shadow:none] hover:[transform:none]",
  danger: "bg-pink-soft text-pink-ink",
};

// Boutons principaux : text-base semibold, 8 px / 12 px de marge ; boutons d'en-tête : text-sm. Hauteur ≥ 44 px pour le toucher.
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 py-2 text-sm",
  md: "min-h-11 px-3 py-2 text-base",
  lg: "min-h-14 px-3 py-2 text-base",
};

/** Classes d'un bouton, pour habiller un lien (`<Link className={buttonClass()}>`) comme un bouton. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `inline-flex items-center justify-center gap-2 btn-hard rounded-r2 border-[length:var(--bw)] border-line font-sans font-bold uppercase tracking-[0.03em] transition duration-90 ease-base disabled:cursor-not-allowed disabled:bg-chip disabled:text-muted ${sizes[size]} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}

/** Lien qui a l'apparence d'un bouton. */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })}>
      {children}
    </Link>
  );
}

/** Bouton rond à icône seule : le libellé ARIA est obligatoire. */
export function IconButton({
  icon,
  label,
  tone = "surface",
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  icon: IconName;
  label: string;
  tone?: "surface" | "chip" | "dark";
}) {
  const tones = {
    surface: "bg-surface hover:bg-chip",
    chip: "bg-chip hover:bg-line",
    dark: "bg-nav text-on-nav",
  };
  return (
    <button
      aria-label={label}
      className={`btn-hard grid size-11 shrink-0 place-items-center rounded-r2 border-[length:var(--bw)] border-line transition duration-90 ease-base disabled:bg-chip disabled:text-muted ${tones[tone]} ${className}`}
      {...props}
    >
      <Icon name={icon} className="size-5" />
    </button>
  );
}
