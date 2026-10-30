import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

/**
 * Gabarits des e-mails (SPEC_JANVIER §8) : français, design system « Fin Prêt Néo » (néo-brutalisme : aplats,
 * bordures de 2 px, ombre dure). Tutoiement pour les familles, vouvoiement pour les associations. Les e-mails
 * non transactionnels portent un lien de désinscription en un clic.
 * Mise en page en tableaux et styles en ligne (clients mail) ; polices Google avec repli système.
 */

const INK = "#17151f";
const MUTED = "#4a4658";
const CREAM = "#fff8e7";
const CREAM_DEEP = "#fff6d6";
const VIOLET = "#4b2fc9";
const GREEN = "#1fa85a";
const ORANGE = "#ff8c42";
const BANANA = "#ffd23f";

const DISPLAY = "'Archivo Black', 'Arial Black', Arial, sans-serif";
const MONO = "'Space Mono', 'Courier New', monospace";
const SANS = "'Space Grotesk', Arial, Helvetica, sans-serif";

const side: CSSProperties = { borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}` };

function Layout({
  preview,
  badge,
  headerRight,
  title,
  children,
  unsubscribeUrl,
  reason,
}: {
  preview: string;
  /** Pastille noire au-dessus du titre (« BIENVENUE », « FIN D'ESSAI · J-3 »). */
  badge?: string;
  /** Repère à droite du bandeau noir (« ESSAI · JOUR 1 / 30 »). */
  headerRight?: string;
  title?: string;
  children: ReactNode;
  unsubscribeUrl?: string;
  /** Pourquoi la personne reçoit cet e-mail. */
  reason?: string;
}) {
  return (
    <Html lang="fr">
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- e-mail, pas une page Next */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: SANS, color: INK, margin: 0 }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px 40px" }}>
          <Section style={{ backgroundColor: INK, border: `2px solid ${INK}`, borderBottomWidth: 0 }}>
            <Row>
              <Column style={{ padding: "20px 0 20px 32px" }}>
                <Text
                  style={{
                    margin: 0,
                    fontFamily: DISPLAY,
                    fontSize: 26,
                    lineHeight: "28px",
                    letterSpacing: "-0.01em",
                    color: CREAM,
                  }}
                >
                  FIN PRÊT
                </Text>
              </Column>
              {headerRight && (
                <Column align="right" style={{ padding: "20px 32px 20px 0" }}>
                  <Text
                    style={{
                      margin: 0,
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      lineHeight: "24px",
                      color: CREAM,
                    }}
                  >
                    {headerRight}
                  </Text>
                </Column>
              )}
            </Row>
          </Section>

          <Section style={{ backgroundColor: "#ffffff", ...side, padding: "36px 32px 32px" }}>
            {badge && (
              <Text
                style={{
                  display: "inline-block",
                  margin: 0,
                  backgroundColor: INK,
                  color: CREAM,
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  lineHeight: "16px",
                  padding: "5px 10px",
                }}
              >
                {badge}
              </Text>
            )}
            {title && <Text style={h1}>{title.toUpperCase()}</Text>}
            {children}
          </Section>

          <Section style={{ backgroundColor: CREAM_DEEP, border: `2px solid ${INK}`, padding: "28px 32px" }}>
            <Text
              style={{
                display: "inline-block",
                margin: 0,
                transform: "rotate(-3deg)",
                backgroundColor: "#ffffff",
                border: `2px solid ${INK}`,
                padding: "8px 12px",
                fontFamily: DISPLAY,
                fontSize: 15,
                lineHeight: "17px",
              }}
            >
              LA SEMAINE EST FIN PRÊTE.
            </Text>
            {reason && <Text style={{ ...small, margin: "20px 0 0" }}>{reason}</Text>}
            {unsubscribeUrl && (
              <Text style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, lineHeight: "24px" }}>
                <Link href={unsubscribeUrl} style={{ color: INK, textDecoration: "underline" }}>
                  Se désinscrire en un clic
                </Link>
              </Text>
            )}
            <Text
              style={{ margin: "10px 0 0", fontFamily: MONO, fontSize: 12, lineHeight: "18px", color: MUTED }}
            >
              FIN PRÊT · FINPRET.APP · BONJOUR@FINPRET.APP
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const h1: CSSProperties = {
  margin: "16px 0 0",
  fontFamily: DISPLAY,
  fontWeight: 400,
  fontSize: 32,
  lineHeight: "34px",
  letterSpacing: "-0.005em",
  color: INK,
};
const p: CSSProperties = { fontSize: 16, lineHeight: "26px", margin: "16px 0 0", color: INK };
const small: CSSProperties = { fontSize: 14, lineHeight: "20px", margin: "16px 0 0", color: MUTED };

/** Bouton jaune à ombre dure : le lien vit dans la cellule, la bordure (2 px, 5 px en bas à droite) sur le tableau. */
function Cta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table role="presentation" style={{ marginTop: 24, borderCollapse: "separate", borderSpacing: 0 }}>
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: BANANA,
              border: `2px solid ${INK}`,
              borderRightWidth: 5,
              borderBottomWidth: 5,
              borderRadius: 2,
            }}
          >
            <Link
              href={href}
              style={{
                display: "inline-block",
                padding: "16px 24px",
                fontFamily: SANS,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: "20px",
                color: INK,
                textDecoration: "none",
              }}
            >
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Encadré d'information (bleu), tel que « Ton essai court jusqu'au… ». */
function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section
      style={{
        marginTop: 24,
        backgroundColor: "#4d96ff",
        border: `2px solid ${INK}`,
        borderRadius: 2,
        padding: 16,
      }}
    >
      <Text style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: "24px" }}>{title}</Text>
      <Text style={{ margin: "4px 0 0", fontSize: 14, lineHeight: "20px" }}>{children}</Text>
    </Section>
  );
}

const STAT_COLORS = [
  { bg: VIOLET, fg: "#ffffff" },
  { bg: GREEN, fg: INK },
  { bg: ORANGE, fg: INK },
];

/** Rangée de trois chiffres-clés sur aplats violet, vert, orange. */
function Stats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <Section style={{ marginTop: 24, tableLayout: "fixed" }}>
      <Row>
        {items.map((item, i) => {
          const c = STAT_COLORS[i % STAT_COLORS.length]!;
          return (
            <Column
              key={item.label}
              style={{ backgroundColor: c.bg, border: `2px solid ${INK}`, padding: 16, verticalAlign: "top" }}
            >
              <Text
                style={{
                  margin: 0,
                  fontFamily: MONO,
                  fontSize: 30,
                  fontWeight: 700,
                  lineHeight: "34px",
                  letterSpacing: "-0.03em",
                  color: c.fg,
                  whiteSpace: "nowrap",
                }}
              >
                {item.value}
              </Text>
              <Text
                style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  lineHeight: "17px",
                  color: c.fg,
                }}
              >
                {item.label}
              </Text>
            </Column>
          );
        })}
      </Row>
    </Section>
  );
}

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Layout preview="Ton lien de connexion à Fin Prêt" badge="CONNEXION" title="Ton lien de connexion">
      <Text style={p}>
        Ouvre ce lien depuis l&apos;appareil où tu as demandé à te connecter. Il est valable 15 minutes et ne
        sert qu&apos;une fois.
      </Text>
      <Cta href={url}>Me connecter</Cta>
      <Text style={small}>
        Tu n&apos;as rien demandé ? Ignore cet e-mail, personne ne pourra se connecter sans ce lien.
      </Text>
    </Layout>
  );
}

export function HouseholdInvitationEmail({ householdName, url }: { householdName: string; url: string }) {
  return (
    <Layout
      preview={`Rejoins le foyer « ${householdName} » sur Fin Prêt`}
      badge="INVITATION"
      title={`Rejoins « ${householdName} »`}
    >
      <Text style={p}>
        On t&apos;invite à partager les repas de la semaine et la liste de courses. Le lien est valable 7
        jours.
      </Text>
      <Cta href={url}>Rejoindre le foyer</Cta>
    </Layout>
  );
}

const STEPS = [
  {
    color: VIOLET,
    fg: "#ffffff",
    title: "Choisis ton menu",
    text: "Garde les plats qui te plaisent, remplace les autres.",
  },
  {
    color: GREEN,
    fg: INK,
    title: "Fais tes courses",
    text: "Ta liste suit ton menu. Coche au fil des rayons.",
  },
  {
    color: ORANGE,
    fg: INK,
    title: "Cuisine dimanche",
    text: "La session guidée enchaîne les étapes et lance tes minuteurs.",
  },
];

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
    <Layout
      preview="Ta première semaine est prête"
      badge="BIENVENUE"
      headerRight="ESSAI · 30 JOURS OFFERTS"
      title={name ? `${name}, ta semaine va être fin prête.` : "Ta semaine va être fin prête."}
      unsubscribeUrl={unsubscribeUrl}
      reason="Tu reçois cet e-mail car tu as créé un compte Fin Prêt."
    >
      <Text style={p}>
        Le dimanche, tu cuisines 10&nbsp;repas en 2&nbsp;h&nbsp;30. La semaine, tu réchauffes et tu passes à
        table. Commence par choisir ton premier menu.
      </Text>
      <Cta href={url}>Choisir mon premier menu</Cta>

      <Section
        style={{
          marginTop: 32,
          border: `2px solid ${INK}`,
          borderRightWidth: 5,
          borderBottomWidth: 5,
          borderRadius: 2,
        }}
      >
        <Text
          style={{
            margin: 0,
            backgroundColor: INK,
            padding: "18px 20px 14px",
            fontFamily: DISPLAY,
            fontSize: 22,
            lineHeight: "24px",
            color: CREAM,
          }}
        >
          TES 3 PREMIÈRES ÉTAPES
        </Text>
        {STEPS.map((step, i) => (
          <Row key={step.title} style={{ borderTop: `2px solid ${INK}` }}>
            <Column style={{ width: 44, padding: "16px 0 16px 20px", verticalAlign: "top" }}>
              <Text
                style={{
                  margin: 0,
                  width: 40,
                  height: 40,
                  boxSizing: "border-box",
                  backgroundColor: step.color,
                  border: `2px solid ${INK}`,
                  fontFamily: MONO,
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: "36px",
                  textAlign: "center",
                  color: step.fg,
                }}
              >
                {i + 1}
              </Text>
            </Column>
            <Column style={{ padding: "16px 20px 16px 16px", verticalAlign: "top" }}>
              <Text style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: "24px" }}>
                {step.title}
              </Text>
              <Text style={{ margin: "2px 0 0", fontSize: 14, lineHeight: "20px", color: MUTED }}>
                {step.text}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <Text style={{ ...p, margin: "32px 0 0" }}>
        À dimanche,
        <br />
        <strong>L&apos;équipe Fin Prêt</strong>
      </Text>
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
  const title = days === 0 ? "Ton essai se termine aujourd'hui" : `Ton essai se termine dans ${days} jours`;
  return (
    <Layout
      preview="Ton essai gratuit se termine"
      badge={days === 0 ? "FIN D'ESSAI · AUJOURD'HUI" : `FIN D'ESSAI · J-${days}`}
      title={title}
      unsubscribeUrl={unsubscribeUrl}
      reason="Tu reçois cet e-mail car ton essai Fin Prêt est en cours."
    >
      <Text style={p}>
        Abonne-toi pour garder le garde-manger, l&apos;impression et les rappels. Sans abonnement, tu gardes
        les courses, la session et Découvrir.
      </Text>
      <Stats
        items={[
          { value: "5,99 €", label: "MENSUEL, PAR MOIS" },
          { value: "49,99 €", label: "ANNUEL, PAR AN" },
          { value: "4,17 €", label: "ANNUEL, PAR MOIS" },
        ]}
      />
      <Cta href={url}>Choisir ma formule</Cta>
      <Text style={{ ...p, margin: "32px 0 0" }}>
        À dimanche,
        <br />
        <strong>L&apos;équipe Fin Prêt</strong>
      </Text>
    </Layout>
  );
}

export function PaymentFailedEmail({ url }: { url: string }) {
  return (
    <Layout preview="Ton paiement n'a pas abouti" badge="PAIEMENT" title="Ton paiement n'a pas abouti">
      <Note title="On réessaie pendant 7 jours">Aucune action n&apos;est obligatoire tout de suite.</Note>
      <Text style={p}>
        On va réessayer plusieurs fois dans les 7 prochains jours. Tu peux aussi mettre à jour ta carte tout
        de suite.
      </Text>
      <Cta href={url}>Mettre à jour ma carte</Cta>
    </Layout>
  );
}

export function AssociationReceivedEmail({ name }: { name: string }) {
  return (
    <Layout preview="Nous avons bien reçu votre demande" badge="ASSOCIATION" title="Demande reçue">
      <Text style={p}>
        Merci ! Nous vérifions le numéro RNA ou SIREN de {name}. Vous recevrez un e-mail dès que le code de
        votre association sera actif.
      </Text>
    </Layout>
  );
}

export function AssociationApprovedEmail({ name, code, url }: { name: string; code: string; url: string }) {
  return (
    <Layout preview="Votre association est validée" badge="ASSOCIATION VALIDÉE" title={`${name} est validée`}>
      <Text style={p}>
        Votre code : <strong style={{ fontFamily: MONO }}>{code}</strong>. Les familles peuvent
        s&apos;inscrire sur finpret.app/ecole/{code} et profiter de 30 jours d&apos;essai, puis de 39,99 € la
        première année.
      </Text>
      <Cta href={url}>Ouvrir l&apos;espace association</Cta>
    </Layout>
  );
}

export function AssociationRejectedEmail({ name, reason }: { name: string; reason: string }) {
  return (
    <Layout preview="Votre demande n'a pas pu être validée" badge="ASSOCIATION" title="Demande non validée">
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
    <Layout
      preview={`Relevé ${quarter} : ${amount}`}
      badge={`RELEVÉ ${quarter}`}
      title={`Votre relevé ${quarter}`}
    >
      <Stats items={[{ value: amount, label: paid ? "REVERSÉ" : "PRÊT À VERSER" }]} />
      <Text style={p}>
        {paid
          ? `Le reversement de ${amount} pour ${name} a été effectué sur l'IBAN enregistré.`
          : `Le reversement de ${amount} pour ${name} est prêt ; le virement suivra sous quelques jours.`}{" "}
        Le relevé détaillé est joint à cet e-mail.
      </Text>
    </Layout>
  );
}
