import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: fr.nav.stock };

// TODO(M7) : onglet stock.
export default function Page() {
  return (
    <>
      <h1 className="text-4xl font-black">{fr.nav.stock}</h1>
      <Card>
        <p className="text-muted">{fr.common.soon}</p>
      </Card>
    </>
  );
}
