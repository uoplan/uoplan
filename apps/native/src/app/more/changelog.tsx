import { useMemo } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Stack, Text, Title } from "@uoplan/ui";

import { RedesignScreen, ScreenHeader } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { CHANGELOG_MD } from "@/data/changelog.generated";
import { type ChangelogSection, parseChangelog } from "@/lib/changelog";

/** Sentence-case a conventional-changelog heading (e.g. "Bug Fixes" -> "Bug fixes"). */
function sentenceCase(title: string): string {
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
}

function SectionBlock({ section }: { section: ChangelogSection }) {
  return (
    <View style={styles.section}>
      <Text size="xs" weight="semibold" color={Surface.dimmed}>
        {sentenceCase(section.title)}
      </Text>
      {section.entries.map((entry, i) => (
        <View key={`${entry.text}-${i}`} style={styles.entryRow}>
          <View style={styles.bullet} />
          <View style={styles.entryText}>
            <Text size="sm">
              {entry.scope ? (
                <Text size="sm" weight="semibold" color={Surface.accent}>
                  {entry.scope}:{" "}
                </Text>
              ) : null}
              {entry.text}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Changelog screen — the native analogue of the web `/changelog` page. The web
 * app renders compiled HTML; here we parse the same conventional `CHANGELOG.md`
 * into a quiet, inline list (no cards, no badges): each release is a version +
 * date heading followed by its sections, separated by hairline rules.
 */
export default function ChangelogScreen() {
  const router = useRouter();
  const releases = useMemo(() => parseChangelog(CHANGELOG_MD), []);

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Settings" onBack={() => router.back()}>
      <ScreenHeader title="Changelog" subtitle="Every release of uoplan, newest first." />

      <Stack gap="lg">
        {releases.map((release, index) => (
          <View key={release.version}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.release}>
              <View style={styles.releaseHead}>
                <Title order={4}>{release.version}</Title>
                {release.date ? (
                  <Text size="xs" dimmed>
                    {release.date}
                  </Text>
                ) : null}
              </View>
              {release.sections.map((section) => (
                <SectionBlock key={section.title} section={section} />
              ))}
            </View>
          </View>
        ))}
      </Stack>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Surface.border,
    marginBottom: Spacing.three,
  },
  release: {
    gap: Spacing.two,
  },
  releaseHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  section: {
    gap: Spacing.one,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 7,
    backgroundColor: Surface.dimmed,
  },
  entryText: {
    flex: 1,
  },
});
