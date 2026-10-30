import type { Metadata } from "next";
import { AuthSimplePage } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/PasswordForms";
import { Card } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: fr.login.forgotTitle };

export default function ForgotPasswordPage() {
  return (
    <AuthSimplePage title={fr.login.forgotTitle} lead={fr.login.forgotLead}>
      <Card>
        <ForgotPasswordForm />
      </Card>
    </AuthSimplePage>
  );
}
