import { LegalPage, legalMetadata } from "@/components/associations/LegalPage";

export const metadata = legalMetadata("partenariat-associations");

export const dynamic = "force-static";

export default function Page() {
  return <LegalPage slug="partenariat-associations" />;
}
