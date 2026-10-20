import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: fr.nav.shopping };

// TODO(M6) : onglet shopping.
export default function Page() {
  return (
    <>
      <h1 className="text-4xl font-black">{fr.nav.shopping}</h1>
      <Card>
        <p className="text-muted">{fr.common.soon}</p>
      </Card>
    </>
  );
}
