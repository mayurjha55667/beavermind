import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ComponentProps, ReactElement } from "react";
import type { CompletedEvaluation } from "@/lib/evaluation/types";

Font.registerHyphenationCallback((word) => [word]);

const navy = "#152D2B";
const cream = "#F7F2E8";
const coral = "#D76B4D";
const muted = "#61716D";
const line = "#D9DDD5";

const styles = StyleSheet.create({
  page: { backgroundColor: cream, color: navy, fontFamily: "Helvetica", fontSize: 9, padding: 42, paddingBottom: 58 },
  cover: { backgroundColor: navy, color: cream, padding: 48 },
  brand: { fontSize: 10, letterSpacing: 2.2, textTransform: "uppercase", color: "#D8CBAF" },
  coverRule: { width: 42, height: 3, backgroundColor: coral, marginTop: 28, marginBottom: 72 },
  coverTitle: { fontFamily: "Times-Roman", fontSize: 38, lineHeight: 1.05, maxWidth: 380 },
  coverMeta: { fontSize: 10, marginTop: 18, color: "#D8CBAF", lineHeight: 1.5 },
  coverScoreRow: { position: "absolute", left: 48, right: 48, bottom: 70, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  coverScore: { fontFamily: "Times-Roman", fontSize: 68, lineHeight: 0.9 },
  coverOutOf: { fontSize: 11, color: "#D8CBAF", marginLeft: 8, marginBottom: 8 },
  coverGrade: { fontSize: 13, letterSpacing: 1.8, textTransform: "uppercase", color: "#F0B19C", marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: line, paddingBottom: 10, marginBottom: 24, color: muted, fontSize: 7.5, letterSpacing: 1.1, textTransform: "uppercase" },
  sectionLabel: { color: coral, fontSize: 7.5, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  heading: { fontFamily: "Times-Roman", fontSize: 24, marginBottom: 12 },
  body: { fontSize: 10, lineHeight: 1.55, color: "#304541" },
  heroGrid: { flexDirection: "row", gap: 16, marginBottom: 24 },
  heroCard: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 4, padding: 18, backgroundColor: "#FBF8F1" },
  oneThingTitle: { fontFamily: "Times-Roman", fontSize: 17, lineHeight: 1.2, marginBottom: 8 },
  scoreDelta: { marginTop: 14, color: coral, fontSize: 12 },
  cap: { borderLeftWidth: 3, borderLeftColor: coral, paddingLeft: 10, marginBottom: 7, lineHeight: 1.4 },
  redFlag: { borderTopWidth: 1, borderTopColor: line, paddingTop: 10, marginTop: 10 },
  redFlagTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  severity: { color: coral, fontSize: 7, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 },
  dimension: { borderTopWidth: 1, borderTopColor: line, paddingTop: 14, marginTop: 14 },
  dimensionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  dimensionNumber: { fontSize: 7.5, color: coral, letterSpacing: 1 },
  dimensionName: { fontFamily: "Times-Roman", fontSize: 15, width: "68%" },
  dimensionScore: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  subheading: { fontFamily: "Helvetica-Bold", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 10, marginBottom: 5 },
  evidence: { backgroundColor: "#ECEDE5", borderRadius: 3, padding: 9, marginTop: 5 },
  evidenceLine: { fontSize: 8, lineHeight: 1.45, marginBottom: 4 },
  evidenceNumber: { color: coral, fontFamily: "Helvetica-Bold" },
  evidenceSpeaker: { fontFamily: "Helvetica-Bold" },
  listItem: { fontSize: 8.5, lineHeight: 1.45, marginBottom: 3 },
  quickFix: { backgroundColor: navy, color: cream, borderRadius: 3, padding: 10, marginTop: 10, lineHeight: 1.45 },
  footer: { position: "absolute", left: 42, right: 42, bottom: 26, borderTopWidth: 1, borderTopColor: line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: muted },
});

export function EvaluationPdf({ evaluation }: { evaluation: CompletedEvaluation }): ReactElement<
  ComponentProps<typeof Document>
> {
  const date = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(evaluation.completedAt ?? evaluation.createdAt));
  const oneThing = evaluation.oneThing;

  return (
    <Document title={`Signal Review - ${evaluation.callType} call`} author="Signal Review">
      <Page size="A4" style={styles.cover}>
        <Text style={styles.brand}>Signal Review · BeaverMind exercise</Text>
        <View style={styles.coverRule} />
        <Text style={styles.coverTitle}>Call quality evaluation</Text>
        <Text style={styles.coverMeta}>
          {evaluation.callType === "kickoff" ? "Kick-off call" : "Coaching call"}{"\n"}
          Evaluated {date}{"\n"}
          Report {evaluation.id}
        </Text>
        <View style={styles.coverScoreRow}>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={styles.coverScore}>{formatScore(evaluation.finalScore)}</Text>
            <Text style={styles.coverOutOf}>/ 100</Text>
          </View>
          <Text style={styles.coverGrade}>{evaluation.grade}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <PdfHeader evaluation={evaluation} label="Executive review" />
        <View style={styles.heroGrid}>
          <View style={styles.heroCard}>
            <Text style={styles.sectionLabel}>The one thing</Text>
            <Text style={styles.oneThingTitle}>{oneThing.headline}</Text>
            <Text style={styles.body}>{oneThing.explanation}</Text>
            <Text style={styles.scoreDelta}>
              {formatScore(oneThing.currentFinalTotal)} to {formatScore(oneThing.counterfactualFinalTotal)} (+{formatScore(oneThing.improvement)})
            </Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.sectionLabel}>Score mechanics</Text>
            <Text style={styles.oneThingTitle}>{evaluation.grade}</Text>
            <Text style={styles.body}>
              Raw {formatScore(evaluation.rawScore)} / {formatScore(evaluation.maxPossibleScore)}{"\n"}
              Normalized {formatScore(evaluation.normalizedScore)} / 100{"\n"}
              Final {formatScore(evaluation.finalScore)} / 100
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Coach brief</Text>
        <Text style={styles.heading}>How the call landed</Text>
        <Text style={styles.body}>{evaluation.brief}</Text>

        {evaluation.appliedCaps.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Text style={styles.sectionLabel}>Automatic caps</Text>
            {evaluation.appliedCaps.map((cap) => <Text key={cap.id} style={styles.cap}>{cap.label}</Text>)}
          </View>
        ) : null}

        {evaluation.redFlags.length === 0 ? (
          <View style={{ marginTop: 22 }} wrap={false}>
            <Text style={styles.sectionLabel}>Red flags</Text>
            <Text style={styles.body}>No material retention red flags were supported by verified evidence.</Text>
          </View>
        ) : null}
        <PdfFooter evaluation={evaluation} />
      </Page>

      {evaluation.redFlags.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <PdfHeader evaluation={evaluation} label="Risk review" />
          <Text style={styles.sectionLabel}>Red flags</Text>
          <Text style={styles.heading}>Evidence-backed risks</Text>
          {evaluation.redFlags.map((flag, index) => (
            <View
              style={styles.redFlag}
              key={`${flag.title}-${index}`}
              wrap={false}
              minPresenceAhead={90}
            >
              <Text style={styles.severity}>{flag.severity} risk</Text>
              <Text style={styles.redFlagTitle}>{flag.title}</Text>
              <Text style={styles.body}>{flag.explanation}</Text>
              <Text style={{ ...styles.evidenceLine, color: muted, marginTop: 4 }}>
                {flag.evidenceLineNumbers.length > 0
                  ? `Evidence: ${flag.evidenceLineNumbers.map((lineNumber) => `L${lineNumber}`).join(", ")}`
                  : "Evidence: This risk is based on the absence of required rubric evidence."}
              </Text>
            </View>
          ))}
          <PdfFooter evaluation={evaluation} />
        </Page>
      ) : null}

      {evaluation.dimensions.map((dimension) => (
        <Page size="A4" style={styles.page} key={dimension.dimensionId}>
          <PdfHeader evaluation={evaluation} label="Dimension scorecard" fixed={false} />
          {dimension.dimensionId === 1 ? (
            <>
              <Text style={styles.sectionLabel}>Full scorecard</Text>
              <Text style={styles.heading}>Twelve dimensions</Text>
            </>
          ) : null}
          <View
            style={styles.dimension}
          >
            <View style={styles.dimensionHeader} wrap={false}>
              <Text style={styles.dimensionNumber}>D{String(dimension.dimensionId).padStart(2, "0")}</Text>
              <Text style={styles.dimensionName}>{dimension.name}</Text>
              <Text style={styles.dimensionScore}>
                {dimension.disabled ? "N/A" : `${formatScore(dimension.score)} / ${formatScore(dimension.rubricMaxScore)}`}
              </Text>
            </View>
            {dimension.disabled ? <Text style={styles.body}>{dimension.disabledReason}</Text> : null}
            {!dimension.disabled && dimension.effectiveMaxScore !== dimension.rubricMaxScore ? (
              <Text style={{ ...styles.body, color: coral }}>
                Effective redistributed weight: {formatScore(dimension.effectiveMaxScore)}
              </Text>
            ) : null}
            <View minPresenceAhead={65}>
              <Text style={styles.subheading}>Why this score</Text>
              <Text style={styles.body}>{dimension.reasoning}</Text>
            </View>
            <View minPresenceAhead={90}>
              <Text style={styles.subheading}>Verified evidence</Text>
              {dimension.evidence.length === 0 ? (
                <Text style={styles.body}>No supporting transcript evidence was verified.</Text>
              ) : (
                <View style={styles.evidence}>
                  {dimension.evidence.map((evidence) => (
                    <Text style={styles.evidenceLine} key={evidence.lineNumber}>
                      <Text style={styles.evidenceNumber}>L{evidence.lineNumber} </Text>
                      <Text style={styles.evidenceSpeaker}>{evidence.speaker}: </Text>
                      {evidence.text}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            <View minPresenceAhead={70}>
              <Text style={styles.subheading}>Missing behaviours</Text>
              {dimension.missingBehaviours.length === 0 ? (
                <Text style={styles.body}>No rubric behaviour was explicitly missing.</Text>
              ) : dimension.missingBehaviours.map((item) => (
                <Text style={styles.listItem} key={item}>• {item}</Text>
              ))}
            </View>
            <Text style={styles.quickFix} wrap={false} minPresenceAhead={55}>
              QUICK FIX{"\n"}{dimension.quickFix}{"\n"}
              Maximum lift if all dimension gaps are fixed: +{formatScore(dimension.improvementPotential)}
            </Text>
          </View>
          <PdfFooter evaluation={evaluation} />
        </Page>
      ))}
    </Document>
  );
}

function PdfHeader({
  evaluation,
  label,
  fixed = true,
}: {
  evaluation: CompletedEvaluation;
  label: string;
  fixed?: boolean;
}) {
  return (
    <View style={styles.header} fixed={fixed}>
      <Text>Signal Review</Text>
      <Text>{label}</Text>
      <Text>{evaluation.id.slice(0, 8).toUpperCase()}</Text>
    </View>
  );
}

function PdfFooter({ evaluation }: { evaluation: CompletedEvaluation }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Evidence-grounded · Deterministically scored</Text>
      <Text render={({ pageNumber, totalPages }) => `Report ${evaluation.id.slice(0, 8)} · ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function formatScore(value: number | null): string {
  if (value === null) return "N/A";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
