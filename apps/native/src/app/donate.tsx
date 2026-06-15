import type { ComponentProps } from "react";
import { useRouter } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";

import { Stack, Text } from "@uoplan/ui";

import {
  IconTile,
  GlassButton,
  RedesignScreen,
  ScreenHeader,
  SectionCard,
} from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";

const DONATION_EMAIL = "donate@uoplan.party";
const DONATION_URL = `mailto:${DONATION_EMAIL}`;

function openDonation() {
  void Linking.openURL(DONATION_URL).catch(() => {});
}

function Pill({ children }: { children: string }) {
  return (
    <View style={styles.pill}>
      <Text size="xs" weight="semibold" color={Surface.accent}>
        {children}
      </Text>
    </View>
  );
}

function InfoRow({
  icon,
  title,
  detail,
}: {
  icon: ComponentProps<typeof IconTile>["icon"];
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.infoRow}>
      <IconTile icon={icon} tone="neutral" size={38} />
      <View style={styles.infoText}>
        <Text size="sm" weight="bold">
          {title}
        </Text>
        <Text size="sm" dimmed>
          {detail}
        </Text>
      </View>
    </View>
  );
}

export default function DonateScreen() {
  const router = useRouter();

  return (
    <RedesignScreen gap={Spacing.three} backLabel="More" onBack={() => router.back()}>
      <ScreenHeader title="Support us" subtitle="Help keep uoplan free and running." />

      <SectionCard title="How to donate" subtitle="Send an Interac e-Transfer to this address.">
        <Stack gap="md">
          <View style={styles.emailBox}>
            <Text size="xs" dimmed>
              Donation email
            </Text>
            <Text size="lg" weight="bold" color={Surface.accent}>
              {DONATION_EMAIL}
            </Text>
          </View>

          <View style={styles.pills}>
            <Pill>Auto-deposit is enabled</Pill>
            <Pill>No security question</Pill>
            <Pill>CAD</Pill>
          </View>

          <GlassButton label="Donate" icon="heart.fill" onPress={openDonation} />
        </Stack>
      </SectionCard>

      <SectionCard title="Where it goes">
        <Stack gap="sm">
          <InfoRow icon="server.rack" title="Hosting" detail="Keeps the planner online." />
          <InfoRow
            icon="arrow.triangle.2.circlepath"
            title="Data refreshes"
            detail="Keeps schedules current."
          />
          <InfoRow
            icon="graduationcap"
            title="Student-run upkeep"
            detail="Keeps the project free."
          />
        </Stack>
      </SectionCard>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  emailBox: {
    gap: Spacing.one,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.subtle,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  pill: {
    borderRadius: 999,
    backgroundColor: Surface.accentSoft,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
});
