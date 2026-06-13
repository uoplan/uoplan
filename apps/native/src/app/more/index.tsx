import { useRouter } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";

import { Stack, Text } from "@uoplan/ui";

import { ListRow } from "@/components/list-row";
import { ScreenScaffold } from "@/components/screen-scaffold";
import { Spacing, Surface } from "@/constants/theme";

const WEBSITE = "https://uoplan.party";

function openUrl(url: string) {
  void Linking.openURL(url);
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

/** A grouped iOS-style settings section: a small heading + a rounded card. */
function Section({ title, children }: SectionProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" weight="semibold" color={Surface.dimmed}>
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
    </Stack>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

/**
 * The More tab: grouped settings/about/developer destinations that aren't in the
 * bottom tab bar. Web-only features link out to uoplan.party until their native
 * screens are ported; the developer rows push the on-device component gallery
 * and shared-core diagnostics.
 */
export default function MoreScreen() {
  const router = useRouter();

  return (
    <ScreenScaffold title="More" subtitle="Settings, about and developer tools">
      <Section title="Planning">
        <ListRow
          icon="slider.horizontal.3"
          title="Personalize"
          description="Set your program and completed courses"
          onPress={() => openUrl(`${WEBSITE}/personalize`)}
        />
      </Section>

      <Section title="Explore">
        <ListRow
          icon="point.3.connected.trianglepath.dotted"
          title="Professor network"
          description="Co-teaching graph of professors"
          onPress={() => router.push("/more/graph")}
        />
      </Section>

      <Section title="About">
        <ListRow
          icon="heart.fill"
          title="Support uoplan"
          description="Help keep the project free"
          onPress={() => openUrl(`${WEBSITE}/donate`)}
        />
        <Separator />
        <ListRow
          icon="doc.text"
          title="Changelog"
          description="What's new"
          onPress={() => router.push("/more/changelog")}
        />
        <Separator />
        <ListRow
          icon="globe"
          title="Visit uoplan.party"
          description="Open the full web app"
          onPress={() => openUrl(WEBSITE)}
        />
      </Section>

      <Section title="Developer">
        <ListRow
          icon="square.grid.2x2.fill"
          title="Component gallery"
          description="Shared @uoplan/ui primitives, native variants"
          onPress={() => router.push("/more/gallery")}
        />
        <Separator />
        <ListRow
          icon="waveform.path.ecg"
          title="Diagnostics"
          description="Shared-core wiring proof"
          onPress={() => router.push("/more/diagnostics")}
        />
      </Section>

      <Text size="xs" dimmed align="center">
        uoplan · made for uOttawa students
      </Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Surface.border,
    marginLeft: Spacing.three + 28 + Spacing.three,
  },
});
