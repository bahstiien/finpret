import { TermsCheckbox } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { Card, CenteredPage } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";
import { acceptTerms } from "@/server/actions/auth";

const t = fr.login;

/** Accord sur les CGU pour un compte créé sans le formulaire d'inscription (lien magique, Google). */
export function TermsGate() {
  return (
    <CenteredPage>
      <Card as="section" className="flex flex-col gap-4" data-testid="terms-gate">
        <h1 className="t-2">{t.termsGateTitle}</h1>
        <p>{t.termsGateLead}</p>
        <form action={acceptTerms} className="flex flex-col gap-4">
          <TermsCheckbox />
          <Button type="submit" variant="primary" className="btn--block">
            {t.termsGateSubmit}
          </Button>
        </form>
      </Card>
    </CenteredPage>
  );
}
