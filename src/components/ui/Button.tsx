import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "outline" | "dark" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  outline: "btn--outline",
  dark: "btn--dark",
  ghost: "btn--ghost",
  danger: "btn--danger",
};

// Tailles de la maquette : sm 44 px, md 52 px (action), lg 60 px (session, mains occupées).
const sizes: Record<ButtonSize, string> = {
  sm: "btn--sm",
  md: "",
  lg: "btn--lg",
};

/** Classes d'un bouton, pour habiller un lien (`<Link className={buttonClass()}>`) comme un bouton. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `btn ${variants[variant]} ${sizes[size]} ${className}`;
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
    surface: "",
    chip: "",
    dark: "iconbtn--dark",
  };
  return (
    <button
      aria-label={label}
      className={`iconbtn ${tones[tone]} ${className}`}
      {...props}
    >
      <Icon name={icon} className="size-5" />
    </button>
  );
}
