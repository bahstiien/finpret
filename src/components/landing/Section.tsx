import Link from "next/link";
import type { ReactNode } from "react";
import { nb } from "@/lib/typography";
import { Icon } from "./Icon";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-4 sm:px-8 ${className}`}>{children}</div>;
}

export function SectionTitle({
  id,
  title,
  lead,
  className = "",
}: {
  id?: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={`flex max-w-2xl flex-col gap-3 ${className}`}>
      <h2
        id={id}
        className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.01em] sm:text-4xl lg:text-[44px]"
      >
        {nb(title)}
      </h2>
      {lead && <p className="text-base text-muted sm:text-lg">{nb(lead)}</p>}
    </div>
  );
}

/** Action principale jaune (texte encre, 52 px). Une seule par écran visible. */
export function CtaLink({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Link
      href="/login"
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill bg-banana px-8 text-base font-extrabold text-[#17151f] transition hover:brightness-95 active:scale-[0.98] ${className}`}
    >
      {children}
      <Icon name="arrow" className="size-5" />
    </Link>
  );
}
