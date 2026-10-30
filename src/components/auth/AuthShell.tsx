import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";

/** Cadre commun des écrans publics de connexion et de contact : bandeau (logo + lien) et colonne centrale. */
const wrap = "mx-auto w-full max-w-[1240px] px-4 min-[900px]:px-10";

export function BrandLogo() {
  return (
    <Link href="/" className="logo" aria-label="Fin Prêt, accueil">
      <span className="logo-mark" aria-hidden="true">
        <Icon name="pot" className="ic" />
      </span>
      Fin Prêt
    </Link>
  );
}

export function AuthShell({
  aside,
  asideHref,
  asideLabel,
  children,
}: {
  /** Phrase à droite du logo (« Une question ? »). */
  aside: string;
  asideHref: string;
  asideLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b-[length:var(--bw)] border-line bg-surface">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-3 !py-4`}>
          <BrandLogo />
          <p className="t-small">
            {aside}{" "}
            <Link href={asideHref} className="lnk">
              {asideLabel}
            </Link>
          </p>
        </div>
      </header>
      <main className={`${wrap} flex-1 pt-8 pb-16 min-[900px]:pt-12`}>{children}</main>
    </div>
  );
}

/** Page d'un seul formulaire (mot de passe oublié, nouveau mot de passe). */
export function AuthSimplePage({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  const t = fr.login;
  return (
    <AuthShell aside={t.helpLead} asideHref="/contact" asideLabel={t.helpLink}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="t-1">{title}</h1>
          <p className="muted">{lead}</p>
        </div>
        {children}
      </div>
    </AuthShell>
  );
}
