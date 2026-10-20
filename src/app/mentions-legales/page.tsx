import { LegalPage, legalMetadata } from "@/components/associations/LegalPage";

export const metadata = legalMetadata("mentions-legales");

export const dynamic = "force-static";

export default function Page() {
  return <LegalPage slug="mentions-legales" />;
}
