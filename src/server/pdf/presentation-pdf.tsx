import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { associationsFr } from "@/i18n/associations";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", color: "#17151f", fontSize: 11, lineHeight: 1.4 },
  eyebrow: { fontSize: 10, color: "#7a5af8", fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h1: { fontSize: 24, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  lead: { fontSize: 13, color: "#6b6878", marginBottom: 14 },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 4 },
  mark: { width: 18, fontFamily: "Helvetica-Bold", color: "#7a5af8" },
  grow: { flex: 1 },
  box: {
    backgroundColor: "#ffd23f",
    padding: 12,
    borderRadius: 8,
    marginTop: 14,
    fontFamily: "Helvetica-Bold",
  },
  q: { fontFamily: "Helvetica-Bold", marginTop: 8 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 9, color: "#6b6878" },
});

const List = ({ items, numbered = false }: { items: readonly string[]; numbered?: boolean }) => (
  <View>
    {items.map((item, i) => (
      <View key={i} style={styles.row}>
        <Text style={styles.mark}>{numbered ? `${i + 1}.` : "•"}</Text>
        <Text style={styles.grow}>{item}</Text>
      </View>
    ))}
  </View>
);

/** Fiche de présentation générique (2 pages) envoyée aux bureaux qui veulent en parler en réunion. */
export function renderPresentationPdf(): Promise<Buffer> {
  const t = associationsFr;
  return renderToBuffer(
    <Document title="Fin Prêt pour les associations de parents" author="Fin Prêt" language="fr">
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>FIN PRÊT · ASSOCIATIONS DE PARENTS</Text>
        <Text style={styles.h1}>{t.hero.title}</Text>
        <Text style={styles.lead}>{t.hero.lead}</Text>
        <Text style={styles.h2}>{t.how.title}</Text>
        <List items={t.how.steps} numbered />
        <Text style={styles.h2}>{t.families.title}</Text>
        <List items={t.families.items} />
        <Text style={styles.box}>{t.families.benefit}</Text>
        <Text style={styles.h2}>{t.zero.title}</Text>
        <List items={t.zero.items} />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{t.trust.title}</Text>
        <List items={t.trust.items} />
        <Text style={styles.h2}>{t.faq.title}</Text>
        {t.faq.items.map((f) => (
          <View key={f.q}>
            <Text style={styles.q}>{f.q}</Text>
            <Text>{f.a}</Text>
          </View>
        ))}
        <Text style={styles.footer}>finpret.app/associations · bonjour@finpret.app</Text>
      </Page>
    </Document>,
  );
}
