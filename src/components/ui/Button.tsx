import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "dark";

const variants: Record<Variant, string> = {
  primary: "bg-banana text-[#17151F] hover:brightness-95",
  outline: "border-2 border-ink text-ink hover:bg-chip",
  dark: "bg-ink text-surface hover:opacity-90",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-6 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
