import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StatementInput } from "@/server/payouts";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", color: "#17151f", fontSize: 11, lineHeight: 1.45 },
  eyebrow: { fontSize: 10, color: "#7a5af8", fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  row: { flexDirection: "row", borderBottom: "1 solid #17151f", paddingVertical: 5 },
  c1: { flex: 2 },
  c2: { flex: 1, textAlign: "right" },
  total: { flexDirection: "row", paddingVertical: 8, fontFamily: "Helvetica-Bold", fontSize: 13 },
  note: { marginTop: 16, color: "#6b6878" },
});

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Relevé trimestriel : nombres d'abonnements et montant, sans aucune donnée de famille. */
export function renderStatementPdf(s: StatementInput): Promise<Buffer> {
  const rows: [string, number, number][] = [
    ["Abonnements annuels payés", s.yearly, s.yearly * 800],
    ["Mois d'abonnement mensuel payés", s.monthly, s.monthly * 50],
  ];
  return renderToBuffer(
    <Document title={`Relevé ${s.quarter}`} author="Fin Prêt" language="fr">
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>FIN PRÊT · RELEVÉ DE REVERSEMENT</Text>
        <Text style={styles.h1}>
          {s.associationName} · {s.quarter}
        </Text>
        {rows.map(([label, n, cents]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.c1}>
              {label} ({n})
            </Text>
            <Text style={styles.c2}>{euros(cents)}</Text>
          </View>
        ))}
        {s.refunds > 0 && (
          <View style={styles.row}>
            <Text style={styles.c1}>Remboursements et litiges ({s.refunds})</Text>
            <Text style={styles.c2}>déduits</Text>
          </View>
        )}
        <View style={styles.total}>
          <Text style={styles.c1}>Montant versé</Text>
          <Text style={styles.c2}>{euros(s.amountCents)}</Text>
        </View>
        <Text style={styles.note}>
          Ce relevé ne contient aucune information sur les familles. Le virement est effectué sur l&apos;IBAN
          enregistré par votre association. Une question : bonjour@finpret.app.
        </Text>
      </Page>
    </Document>,
  );
}
