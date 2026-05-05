/**
 * OSHA Form 301 PDF — printable, single-page output via @react-pdf/renderer.
 *
 * Layout: title block + establishment header + 3 sections (employee /
 * physician / case detail). Tabular numerals for case number and dates.
 */

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  deriveOsha301Fields,
  OSHA_301_FIELD_GROUPS,
  type Osha301Source,
} from "@/lib/format/osha301";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 36,
    color: "#191919",
  },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#525252", marginBottom: 16 },
  estBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 8,
    marginBottom: 16,
  },
  estLabel: { fontSize: 8, color: "#525252", textTransform: "uppercase" },
  estValue: { fontSize: 11, fontWeight: 700 },
  estAddress: { fontSize: 9, color: "#525252" },
  groupHeader: {
    backgroundColor: "#EEF2F7",
    padding: 6,
    marginTop: 8,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#0A2540",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  fieldNum: {
    width: 28,
    fontSize: 8,
    color: "#525252",
  },
  fieldLabel: {
    width: 200,
    fontSize: 8,
    color: "#525252",
    paddingRight: 8,
  },
  fieldValue: {
    flex: 1,
    fontSize: 9,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#9CA3AF",
    textAlign: "center",
  },
});

export function Osha301Pdf({ source }: { source: Osha301Source }) {
  const fields = deriveOsha301Fields(source);
  const generatedAt = new Date().toLocaleString();

  return (
    <Document
      title={`OSHA 301 — ${source.incident.ref_code ?? "Case"}`}
      author="EHS Operations Platform"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>OSHA Form 301 — Injury and Illness Incident Report</Text>
        <Text style={styles.subtitle}>
          One Form 301 per injured employee. Complete within 7 calendar days
          per OSHA §1904.29(b)(3).
        </Text>

        <View style={styles.estBox}>
          <Text style={styles.estLabel}>Establishment</Text>
          <Text style={styles.estValue}>{source.site.name}</Text>
          {source.site.address && (
            <Text style={styles.estAddress}>{source.site.address}</Text>
          )}
        </View>

        {OSHA_301_FIELD_GROUPS.map((group) => (
          <View key={group.key} wrap={false}>
            <Text style={styles.groupHeader}>{group.label}</Text>
            {fields
              .filter((f) => f.group === group.key)
              .map((f) => (
                <View key={f.key} style={styles.row}>
                  <Text style={styles.fieldNum}>
                    {String(f.num).padStart(2, "0")}
                  </Text>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <Text style={styles.fieldValue}>{f.value}</Text>
                </View>
              ))}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Generated {generatedAt} · EHS Operations Platform · Source ref{" "}
          {source.incident.ref_code ?? "—"}
        </Text>
      </Page>
    </Document>
  );
}
