import { fr } from "@/i18n/fr";
import { LinkButton } from "./Button";
import { Card } from "./Card";

/** Remplace un écran réservé à l'offre payante (le serveur refuse de toute façon l'action). */
export function UpgradeCard() {
  return (
    <Card tone="yellow" className="flex flex-col items-start gap-3" data-testid="upgrade">
      <h2 className="text-xl font-extrabold">{fr.upgrade.title}</h2>
      <p className="text-muted">{fr.upgrade.body}</p>
      <LinkButton href="/settings/subscription">{fr.upgrade.cta}</LinkButton>
    </Card>
  );
}
