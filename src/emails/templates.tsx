import { Body, Button, Container, Head, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Gabarits des e-mails (SPEC_JANVIER §8) : français, couleurs du design system. Tutoiement pour les familles,
 * vouvoiement pour les associations. Les e-mails non transactionnels portent un lien de désinscription en un clic.
 */

const INK = "#17151f";
const MUTED = "#6b6878";
const VIOLET = "#7a5af8";
const BANANA = "#ffd23f";

function Layout({
  preview,
  children,
  unsubscribeUrl,
}: {
  preview: string;
  children: ReactNode;
  unsubscribeUrl?: string;
}) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f4f3f8",
          fontFamily: "Helvetica, Arial, sans-serif",
          color: INK,
          margin: 0,
        }}
      >
        <Container style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px" }}>
          <Text
            style={{ color: VIOLET, fontWeight: 700, fontSize: 14, letterSpacing: 1, margin: "0 0 12px" }}
          >
            FIN PRÊT
          </Text>
          <Section style={{ backgroundColor: "#ffffff", borderRadius: 20, padding: 24 }}>{children}</Section>
          <Text style={{ color: MUTED, fontSize: 12, marginTop: 16 }}>
            Fin Prêt · bonjour@finpret.app
            {unsubscribeUrl && (
              <>
                {" · "}
                <Link href={unsubscribeUrl} style={{ color: MUTED }}>
                  Se désinscrire en un clic
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const h1 = { fontSize: 22, fontWeight: 800, margin: "0 0 12px" } as const;
const p = { fontSize: 15, lineHeight: "22px", margin: "0 0 12px" } as const;
const cta = {
  backgroundColor: BANANA,
  color: INK,
  fontWeight: 700,
  borderRadius: 999,
  padding: "12px 24px",
  textDecoration: "none",
} as const;

export function HouseholdInvitationEmail({ householdName, url }: { householdName: string; url: string }) {
  return (
    <Layout preview={`Rejoins le foyer « ${householdName} » sur Fin Prêt`}>
      <Text style={h1}>Rejoins « {householdName} »</Text>
      <Text style={p}>
        On t&apos;invite à partager les repas de la semaine et la liste de courses. Le lien est valable 7
        jours.
      </Text>
      <Button href={url} style={cta}>
        Rejoindre le foyer
      </Button>
    </Layout>
  );
}

export function WelcomeEmail({
  name,
  url,
  unsubscribeUrl,
}: {
  name: string;
  url: string;
  unsubscribeUrl: string;
}) {
  return (
    <Layout preview="Ta première semaine est prête" unsubscribeUrl={unsubscribeUrl}>
      <Text style={h1}>Bienvenue{name ? `, ${name}` : ""} !</Text>
      <Text style={p}>
        Ton foyer est prêt : le menu de la semaine, la liste de courses et la session du dimanche
        t&apos;attendent.
      </Text>
      <Button href={url} style={cta}>
        Ouvrir Fin Prêt
      </Button>
    </Layout>
  );
}

export function TrialEndingEmail({
  days,
  url,
  unsubscribeUrl,
}: {
  days: number;
  url: string;
  unsubscribeUrl: string;
}) {
  return (
    <Layout preview="Ton essai gratuit se termine" unsubscribeUrl={unsubscribeUrl}>
      <Text style={h1}>
        {days === 0 ? "Ton essai se termine aujourd'hui" : `Ton essai se termine dans ${days} jours`}
      </Text>
      <Text style={p}>
        Abonne-toi pour garder le garde-manger, l&apos;impression et les rappels. Sans abonnement, tu gardes
        les courses, la session et Découvrir.
      </Text>
      <Button href={url} style={cta}>
        Voir l&apos;abonnement
      </Button>
    </Layout>
  );
}

export function PaymentFailedEmail({ url }: { url: string }) {
  return (
    <Layout preview="Ton paiement n'a pas abouti">
      <Text style={h1}>Ton paiement n&apos;a pas abouti</Text>
      <Text style={p}>
        On va réessayer plusieurs fois dans les 7 prochains jours. Tu peux aussi mettre à jour ta carte tout
        de suite.
      </Text>
      <Button href={url} style={cta}>
        Mettre à jour ma carte
      </Button>
    </Layout>
  );
}

export function AssociationReceivedEmail({ name }: { name: string }) {
  return (
    <Layout preview="Nous avons bien reçu votre demande">
      <Text style={h1}>Demande reçue</Text>
      <Text style={p}>
        Merci ! Nous vérifions le numéro RNA ou SIREN de {name}. Vous recevrez un e-mail dès que le code de
        votre association sera actif.
      </Text>
    </Layout>
  );
}

export function AssociationApprovedEmail({ name, code, url }: { name: string; code: string; url: string }) {
  return (
    <Layout preview="Votre association est validée">
      <Text style={h1}>{name} est validée</Text>
      <Text style={p}>
        Votre code : <strong>{code}</strong>. Les familles peuvent s&apos;inscrire sur finpret.app/ecole/
        {code} et profiter de 30 jours d&apos;essai, puis de 39,99 € la première année.
      </Text>
      <Button href={url} style={cta}>
        Ouvrir l&apos;espace association
      </Button>
    </Layout>
  );
}

export function AssociationRejectedEmail({ name, reason }: { name: string; reason: string }) {
  return (
    <Layout preview="Votre demande n'a pas pu être validée">
      <Text style={h1}>Demande non validée</Text>
      <Text style={p}>
        Nous n&apos;avons pas pu valider {name}
        {reason ? ` : ${reason}` : "."} Vous pouvez répondre à cet e-mail pour corriger votre demande.
      </Text>
    </Layout>
  );
}

export function StatementEmail({
  name,
  quarter,
  amount,
  paid,
}: {
  name: string;
  quarter: string;
  amount: string;
  paid: boolean;
}) {
  return (
    <Layout preview={`Relevé ${quarter} : ${amount}`}>
      <Text style={h1}>Votre relevé {quarter}</Text>
      <Text style={p}>
        {paid
          ? `Le reversement de ${amount} pour ${name} a été effectué sur l'IBAN enregistré.`
          : `Le reversement de ${amount} pour ${name} est prêt ; le virement suivra sous quelques jours.`}{" "}
        Le relevé détaillé est joint à cet e-mail.
      </Text>
    </Layout>
  );
}
