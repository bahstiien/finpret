"use client";

import { useEffect } from "react";
import { recordPublicEvent } from "@/server/actions/public";

/** Compte une vue de la landing (événement serveur, sans cookie : pas de bannière de consentement nécessaire). */
export function Track({ event }: { event: "asso_landing_view" | "asso_signup_started" }) {
  useEffect(() => {
    void recordPublicEvent(event);
  }, [event]);
  return null;
}

/** Lien d'inscription qui enregistre le clic (« asso_signup_started ») avant de partir vers /asso/inscription. */
export function SignupLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={className} onClick={() => void recordPublicEvent("asso_signup_started")}>
      {children}
    </a>
  );
}
