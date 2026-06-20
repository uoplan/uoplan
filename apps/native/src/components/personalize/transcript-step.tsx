import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import TranscriptExtractor from "@/lib/transcript-extractor.dom";
import type { PdfPageText } from "@/lib/parseTranscriptNative";
import { Fonts, Spacing, Surface } from "@/constants/theme";

const UOZONE = "https://uozone2.uottawa.ca/";

export interface TranscriptImportSummary {
  courseCount: number;
  startYear: string | null;
  programTitle: string | null;
}

interface TranscriptStepProps {
  pdfBase64: string | null;
  loading: boolean;
  summary: TranscriptImportSummary | null;
  onPick: () => void;
  onResult: (pages: PdfPageText[]) => Promise<void>;
  onError: (message: string) => Promise<void>;
}

function formatStartYear(startYear: string | null): string {
  if (!startYear) return "Not detected";
  const numeric = Number.parseInt(startYear, 10);
  return Number.isFinite(numeric) ? `${numeric}–${numeric + 1}` : startYear;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function TranscriptStep({
  pdfBase64,
  loading,
  summary,
  onPick,
  onResult,
  onError,
}: TranscriptStepProps) {
  return (
    <View style={styles.root}>
      {summary ? (
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <AppIcon name="checkmark.circle.fill" size={24} color={Surface.success} />
            <Text style={styles.summaryHeadText}>Transcript imported</Text>
          </View>
          <View style={styles.summaryRows}>
            <SummaryRow
              label="Courses added"
              value={`${summary.courseCount} course${summary.courseCount === 1 ? "" : "s"}`}
            />
            <SummaryRow label="Start year" value={formatStartYear(summary.startYear)} />
            <SummaryRow label="Program" value={summary.programTitle ?? "Not matched"} />
          </View>
          <Pressable
            onPress={onPick}
            disabled={loading}
            accessibilityRole="button"
            style={styles.relink}
          >
            <Text style={styles.relinkText}>
              {loading ? "Parsing…" : "Choose a different file"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onPick}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Choose transcript PDF"
          style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
        >
          <View style={styles.dropIcon}>
            {loading ? (
              <ActivityIndicator color={Surface.accent} />
            ) : (
              <AppIcon name="doc.text" size={26} color={Surface.accent} />
            )}
          </View>
          <Text style={styles.dropTitle}>
            {loading ? "Parsing transcript…" : "Choose transcript PDF"}
          </Text>
          <Text style={styles.dropHint}>
            Parsed privately on your device — nothing is uploaded.
          </Text>
        </Pressable>
      )}

      {summary ? null : (
        <Pressable
          onPress={() => void Linking.openURL(UOZONE)}
          accessibilityRole="link"
          style={styles.uozone}
        >
          <Text style={styles.linkText}>Get your transcript from uoZone</Text>
          <AppIcon name="arrow.up.right" size={13} color={Surface.dimmed} />
        </Pressable>
      )}

      <TranscriptExtractor
        dom={{ matchContents: true }}
        pdfBase64={pdfBase64}
        onResult={onResult}
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  dropzone: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Surface.border,
    borderRadius: 24,
    backgroundColor: Surface.card,
  },
  dropzonePressed: {
    opacity: 0.85,
  },
  dropIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.accentSoft,
  },
  dropTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 16,
    fontWeight: "700",
    color: Surface.label,
  },
  dropHint: {
    maxWidth: 280,
    textAlign: "center",
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: Surface.dimmed,
  },
  uozone: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: Spacing.one,
  },
  linkText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.dimmed,
  },
  summary: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 22,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  summaryHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  summaryHeadText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 16,
    fontWeight: "700",
    color: Surface.label,
  },
  summaryRows: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
  },
  summaryLabel: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Surface.dimmed,
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.label,
  },
  relink: {
    alignSelf: "center",
    paddingVertical: Spacing.one,
  },
  relinkText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.dimmed,
  },
});
