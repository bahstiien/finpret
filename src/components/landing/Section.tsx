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
        className="text-2xl font-bold sm:text-3xl lg:text-4xl"
      >
        {nb(title)}
      </h2>
      {lead && <p className="text-base text-muted sm:text-lg">{nb(lead)}</p>}
    </div>
  );
}

/** Action principale jaune (texte encre, 56 px). Une seule par écran visible. */
export function CtaLink({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Link
      href="/login"
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-banana px-3 py-2 text-base font-semibold text-[#17151f] transition duration-300 ease-base hover:brightness-95 active:scale-[0.98] ${className}`}
    >
      {children}
      <Icon name="arrow" className="size-5" />
    </Link>
  );
}
