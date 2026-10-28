import "server-only";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { familyUrl, type TutoInput, tutoContent } from "@/lib/tuto";

// Couleurs du design system (design-system/tokens.json), lisibles aussi en noir et blanc.
const INK = "#17151f";
const VIOLET = "#7a5af8";
const BANANA = "#ffd23f";
const MUTED = "#6b6878";

// TODO(spec) : Manrope à embarquer quand les fichiers de police seront fournis ; Helvetica en attendant.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", color: INK, fontSize: 11, lineHeight: 1.4 },
  eyebrow: { fontSize: 10, color: VIOLET, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h1: { fontSize: 24, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  hook: { fontSize: 13, color: MUTED, marginBottom: 16 },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 4 },
  num: { width: 20, fontFamily: "Helvetica-Bold", color: VIOLET },
  bullet: { width: 12 },
  grow: { flex: 1 },
  box: { backgroundColor: BANANA, padding: 12, borderRadius: 8, marginTop: 14 },
  boxText: { fontFamily: "Helvetica-Bold" },
  qrRow: { flexDirection: "row", alignItems: "center", marginTop: 18, gap: 16 },
  qr: { width: 130, height: 130 },
  address: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  table: { borderTop: `1 solid ${INK}`, marginTop: 4 },
  tr: { flexDirection: "row", borderBottom: `1 solid ${INK}`, paddingVertical: 4 },
  td1: { flex: 1, fontFamily: "Helvetica-Bold" },
  td2: { flex: 2 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 9, color: MUTED },
});

function List({ items, numbered = false }: { items: string[]; numbered?: boolean }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={numbered ? styles.num : styles.bullet}>{numbered ? `${i + 1}.` : "•"}</Text>
          <Text style={styles.grow}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function FicheTuto({ input, qr }: { input: TutoInput; qr: string }) {
  const c = tutoContent(input);
  return (
    <Document title={c.family.title} author="Fin Prêt" language="fr">
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>FIN PRÊT</Text>
        <Text style={styles.h1}>{c.family.title}</Text>
        <Text style={styles.hook}>{c.family.hook}</Text>
        <Text style={styles.h2}>{c.family.stepsTitle}</Text>
        <List items={c.family.steps} numbered />
        <Text style={styles.h2}>{c.family.featuresTitle}</Text>
        <List items={c.family.features} />
        <View style={styles.box}>
          <Text style={styles.boxText}>{c.family.benefit}</Text>
        </View>
        <View style={styles.qrRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant Image de react-pdf, pas une balise HTML */}
          <Image src={qr} style={styles.qr} />
          <View style={styles.grow}>
            <Text style={styles.address}>{c.family.address}</Text>
          </View>
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>POUR LE BUREAU ET LES BÉNÉVOLES</Text>
        <Text style={styles.h1}>{c.bureau.title}</Text>
        <View style={styles.table}>
          {c.bureau.summary.map(([k, v]) => (
            <View key={k} style={styles.tr}>
              <Text style={styles.td1}>{k}</Text>
              <Text style={styles.td2}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.h2}>{c.bureau.roleTitle}</Text>
        <List items={c.bureau.role} numbered />
        <Text style={styles.h2}>{c.bureau.payoutsTitle}</Text>
        <View style={styles.table}>
          {c.bureau.payouts.map(([k, v]) => (
            <View key={k} style={styles.tr}>
              <Text style={styles.td1}>{k}</Text>
              <Text style={styles.td2}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={{ marginTop: 4 }}>{c.bureau.payoutsNote}</Text>
        <Text style={styles.h2}>{c.bureau.rulesTitle}</Text>
        <List items={c.bureau.rules} />
        <Text style={styles.h2}>{c.bureau.calendarTitle}</Text>
        <List items={c.bureau.calendar} />
        <Text style={styles.footer}>{c.bureau.generated}</Text>
      </Page>
    </Document>
  );
}

/** Image PNG (data URL) du QR code vers la page famille de l'association. */
export function qrDataUrl(baseUrl: string, code: string): Promise<string> {
  return QRCode.toDataURL(familyUrl(baseUrl, code), { margin: 1, width: 400, errorCorrectionLevel: "M" });
}

/** Fiche tuto de deux pages A4 en PDF. */
export async function renderTutoPdf(input: TutoInput): Promise<Buffer> {
  const qr = await qrDataUrl(input.baseUrl, input.code);
  return renderToBuffer(<FicheTuto input={input} qr={qr} />);
}
