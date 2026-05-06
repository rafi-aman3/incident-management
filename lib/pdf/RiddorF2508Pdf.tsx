/**
 * RIDDOR F2508 PDF — printable A4 output via @react-pdf/renderer.
 */

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  deriveF2508Fields,
  F2508_FIELD_GROUPS,
  type F2508Source,
} from "@/lib/format/riddorF2508";

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
  fieldLabel: {
    width: 240,
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

export function RiddorF2508Pdf({ source }: { source: F2508Source }) {
  const fields = deriveF2508Fields(source);
  const generatedAt = new Date().toLocaleString("en-GB");

  return (
    <Document
      title={`RIDDOR F2508 — ${source.incident.ref_code ?? "Case"}`}
      author="EHS Operations Platform"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>RIDDOR F2508 — Report of an injury or dangerous occurrence</Text>
        <Text style={styles.subtitle}>
          UK Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013.
          Death / specified injury → phone HSE immediately + F2508 within 10 days.
        </Text>

        <View style={styles.estBox}>
          <Text style={styles.estLabel}>Establishment</Text>
          <Text style={styles.estValue}>{source.site.name}</Text>
          {source.site.address && (
            <Text style={styles.estAddress}>{source.site.address}</Text>
          )}
        </View>

        {F2508_FIELD_GROUPS.map((group) => (
          <View key={group.key} wrap={false}>
            <Text style={styles.groupHeader}>{group.label}</Text>
            {fields
              .filter((f) => f.group === group.key)
              .map((f) => (
                <View key={f.key} style={styles.row}>
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
