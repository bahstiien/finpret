import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: fr.nav.session };

// TODO(M8) : onglet session.
export default function Page() {
  return (
    <>
      <h1 className="text-4xl font-black">{fr.nav.session}</h1>
      <Card>
        <p className="text-muted">{fr.common.soon}</p>
      </Card>
    </>
  );
}
