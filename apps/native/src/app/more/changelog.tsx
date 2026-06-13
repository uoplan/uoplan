import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, type BadgeTone, Paper, Stack, Text, Title } from "@uoplan/ui";

import { BottomTabInset, MaxContentWidth, Spacing, Surface } from "@/constants/theme";
import { CHANGELOG_MD } from "@/data/changelog.generated";
import { type ChangelogSection, parseChangelog } from "@/lib/changelog";

/** Map a conventional-changelog section heading to a badge tone. */
function sectionTone(title: string): BadgeTone {
  const lower = title.toLowerCase();
  if (lower.includes("feature")) return "success";
  if (lower.includes("fix")) return "danger";
  if (lower.includes("performance")) return "accent";
  return "neutral";
}

function SectionBlock({ section }: { section: ChangelogSection }) {
  return (
    <Stack gap="xs">
      <View style={styles.sectionHead}>
        <Badge tone={sectionTone(section.title)}>{section.title}</Badge>
        <Text size="xs" dimmed>
          {section.entries.length}
        </Text>
      </View>
      <Stack gap="xs">
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
      </Stack>
    </Stack>
  );
}

/**
 * Changelog screen — the native analogue of the web `/changelog` page. The web
 * app renders compiled HTML; here we parse the same conventional `CHANGELOG.md`
 * into structured release cards with section badges and a tidy commit list,
 * matching the native card aesthetic instead of dumping raw markup.
 */
export default function ChangelogScreen() {
  const insets = useSafeAreaInsets();
  const releases = useMemo(() => parseChangelog(CHANGELOG_MD), []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.column}>
        <Stack gap="md">
          <View>
            <Title order={3}>Changelog</Title>
            <Text size="sm" dimmed>
              Every release of uoplan, newest first.
            </Text>
          </View>

          {releases.map((release) => (
            <Paper key={release.version} p="md" radius="lg" withBorder shadow="sm">
              <Stack gap="sm">
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
              </Stack>
            </Paper>
          ))}
        </Stack>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Surface.page,
  },
  content: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: "center",
  },
  column: {
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  releaseHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
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
