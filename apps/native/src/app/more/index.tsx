import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Stack, Text } from "@uoplan/ui";

import { ResponsiveColumns } from "@/components/layout";
import { ListRow } from "@/components/list-row";
import { RedesignScreen, ScreenHeader } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useTr } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";

const WEBSITE = "https://uoplan.party";
const GITHUB = "https://github.com/uoplan/uoplan";
const CONTACT = "mailto:admin@uoplan.party";
const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

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
  const tr = useTr();
  const { overrideLocale } = useLocale();

  const languageDescription =
    overrideLocale === "en"
      ? tr("native.language.english")
      : overrideLocale === "fr-CA"
        ? tr("native.language.frenchCanada")
        : tr("native.language.currentSystem");

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Back" onBack={() => router.back()}>
      <ScreenHeader title="More" subtitle="Settings, about and developer tools" />

      <ResponsiveColumns gap={Spacing.three}>
        <Section title={tr("native.more.settings")}>
          <ListRow
            icon="globe"
            title={tr("native.language.title")}
            description={languageDescription}
            onPress={() => router.push("/more/language")}
          />
        </Section>

        <Section title="About">
          <ListRow
            icon="doc.text"
            title="Changelog"
            description="What's new"
            onPress={() => router.push("/more/changelog")}
          />
          <Separator />
          <ListRow
            icon="heart"
            title="Support us"
            description="Help keep uoplan running"
            onPress={() => router.push("/donate")}
          />
          <Separator />
          <ListRow
            icon="globe"
            title="Open the web app"
            description="View the full uoplan website"
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
          <Separator />
          <ListRow
            icon="chevron.left.forwardslash.chevron.right"
            title="Source code"
            description="github.com/uoplan/uoplan"
            onPress={() => openUrl(GITHUB)}
          />
          <Separator />
          <ListRow
            icon="envelope"
            title="Contact"
            description="admin@uoplan.party"
            onPress={() => openUrl(CONTACT)}
          />
        </Section>
      </ResponsiveColumns>

      <Pressable style={styles.about} accessibilityRole="link" onPress={() => openUrl(WEBSITE)}>
        <Text size="xs" color={Surface.faint}>
          uoplan.party · v{APP_VERSION}
        </Text>
      </Pressable>
    </RedesignScreen>
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
  about: {
    alignItems: "center",
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
});
