import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Linking, Pressable, StyleSheet, Switch, View } from "react-native";

import { Stack, Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { ResponsiveColumns } from "@/components/layout";
import { ListRow } from "@/components/list-row";
import { RedesignScreen, ScreenHeader } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useTr } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { useAnalyticsPreference } from "@/lib/analytics";

const WEBSITE = "https://uoplan.party";
const GITHUB = "https://github.com/uoplan/uoplan";
const CONTACT = "mailto:admin@uoplan.party";
const PRIVACY_URL = "https://uoplan.party/privacy";
const TERMS_URL = "https://uoplan.party/terms";
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

function AnalyticsOptOutRow() {
  const tr = useTr();
  const { optedOut, setOptedOut } = useAnalyticsPreference();

  return (
    <View style={styles.analyticsBlock}>
      <View style={styles.analyticsRow}>
        <View style={styles.leading}>
          <AppIcon name="chart.bar" size={20} color={Surface.accent} />
        </View>
        <View style={styles.analyticsCopy}>
          <Text size="md" weight="medium">
            {tr("analytics.optout.title")}
          </Text>
          <Text size="sm" dimmed>
            {tr("analytics.optout.description")}
          </Text>
        </View>
        <Switch
          testID="analytics-opt-out-switch"
          value={!optedOut}
          onValueChange={(enabled) => setOptedOut(!enabled)}
          accessibilityLabel={tr("analytics.optout.toggle")}
        />
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => openUrl(PRIVACY_URL)}
        style={styles.analyticsPrivacy}
      >
        <Text size="xs" color={Surface.dimmed}>
          {tr("analytics.optout.privacyDetails")}
        </Text>
        <Text size="xs" color={Surface.accent} weight="semibold">
          uoplan.party/privacy
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * The More tab: grouped settings/about/developer destinations that aren't in the
 * bottom tab bar. Web-only features link out to uoplan.party until their native
 * screens are ported.
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
      <ScreenHeader title="Settings" subtitle="About, support and developer tools" />

      <ResponsiveColumns gap={Spacing.three}>
        <Section title="Preferences">
          <ListRow
            icon="globe"
            title={tr("native.language.title")}
            description={languageDescription}
            onPress={() => router.push("/more/language")}
          />
          <Separator />
          <AnalyticsOptOutRow />
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

        <Section title="Legal">
          <ListRow
            icon="hand.raised"
            title="Privacy Policy"
            description="How your data is handled"
            onPress={() => openUrl(PRIVACY_URL)}
          />
          <Separator />
          <ListRow
            icon="doc.text"
            title="Terms of Service"
            description="Terms of use"
            onPress={() => openUrl(TERMS_URL)}
          />
        </Section>
      </ResponsiveColumns>

      <View style={styles.about}>
        <Text size="xs" color={Surface.faint} align="center">
          Independent, student-run project. Not affiliated with, endorsed by, or sponsored by the
          University of Ottawa.
        </Text>
        <Pressable accessibilityRole="link" onPress={() => openUrl(WEBSITE)}>
          <Text size="xs" color={Surface.faint}>
            uoplan.party · v{APP_VERSION}
          </Text>
        </Pressable>
      </View>
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
  analyticsBlock: {
    backgroundColor: Surface.card,
  },
  analyticsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  leading: {
    width: 28,
    alignItems: "center",
  },
  analyticsCopy: {
    flex: 1,
    gap: 2,
  },
  analyticsPrivacy: {
    flexDirection: "row",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingLeft: Spacing.three + 28 + Spacing.three,
  },
  about: {
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
});
