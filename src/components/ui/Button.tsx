import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "outline" | "dark" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-banana text-[#17151F] hover:brightness-95",
  secondary: "bg-violet-soft text-violet-strong hover:brightness-95",
  outline: "border-2 border-ink text-ink hover:bg-chip",
  dark: "bg-ink text-surface hover:opacity-90",
  ghost: "text-ink hover:bg-chip",
  danger: "bg-peach text-peach-ink hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-11 px-6",
  lg: "min-h-14 px-8 text-lg",
};

/** Classes d'un bouton, pour habiller un lien (`<Link className={buttonClass()}>`) comme un bouton. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-pill font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`;
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
    dark: "bg-ink text-surface",
  };
  return (
    <button
      aria-label={label}
      className={`grid size-11 shrink-0 place-items-center rounded-full transition disabled:opacity-50 ${tones[tone]} ${className}`}
      {...props}
    >
      <Icon name={icon} className="size-5" />
    </button>
  );
}
