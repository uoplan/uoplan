import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { BasketFab } from "@/components/basket-fab";
import { ResponsiveColumns } from "@/components/layout";
import {
  type ChipOption,
  ChipRow,
  RedesignScreen,
  ScreenHeader,
  SectionCard,
} from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import {
  buildTrendsLeaderboard,
  formatLeaderboardDelta,
  formatLeaderboardGpa,
  formatLeaderboardSpan,
  type TrendsLeaderboardRow,
  type TrendsLeaderboardSort,
} from "@/data/trends-leaderboard";

const SORT_OPTIONS: ChipOption[] = [
  { value: "rise", label: "Biggest risers" },
  { value: "easy", label: "Easiest" },
  { value: "hard", label: "Hardest" },
];

/**
 * Trends → Leaderboard. Ranks grade inflation across disciplines by default, then
 * switches to per-course rows when a discipline chip is selected.
 */
export default function TrendsLeaderboardScreen() {
  const router = useRouter();
  const { bundle, index } = useAppData();
  const [sort, setSort] = useState<TrendsLeaderboardSort>("rise");
  const [discipline, setDiscipline] = useState("");

  const disciplineNameByCode = useMemo(
    () => new Map(bundle.disciplines.map((d) => [d.code, d.name] as const)),
    [bundle.disciplines],
  );
  const courseTitleByCode = useMemo(
    () => new Map(index.courses.map((c) => [c.code, c.title] as const)),
    [index.courses],
  );

  const disciplineChips = useMemo<ChipOption[]>(() => {
    const topDisciplines = buildTrendsLeaderboard(bundle.grades, {
      disciplineNameByCode,
      limit: 12,
    });
    return [
      { value: "", label: "All" },
      ...topDisciplines.map((row) => ({ value: row.label, label: row.label })),
    ];
  }, [bundle.grades, disciplineNameByCode]);

  const rows = useMemo(
    () =>
      buildTrendsLeaderboard(bundle.grades, {
        sort,
        discipline: discipline || null,
        disciplineNameByCode,
        courseTitleByCode,
      }),
    [bundle.grades, sort, discipline, disciplineNameByCode, courseTitleByCode],
  );

  const selectedDisciplineName = discipline ? disciplineNameByCode.get(discipline) : null;
  const title = discipline ? "Course leaderboard" : "Discipline leaderboard";

  const openRow = (row: TrendsLeaderboardRow) => {
    if (row.scope === "course") {
      router.push({ pathname: "/explore/course/[code]", params: { code: row.key } });
    } else {
      router.push({ pathname: "/explore/discipline/[code]", params: { code: row.key } });
    }
  };

  const subtitle = discipline
    ? selectedDisciplineName
      ? `${discipline} · ${selectedDisciplineName}`
      : discipline
    : "University-wide, filtered for enough graded volume.";

  return (
    <RedesignScreen
      gap={Spacing.three}
      backLabel="Trends"
      onBack={() => router.back()}
      cart={<BasketFab />}
      onSettings={() => router.push("/more")}
    >
      <ScreenHeader
        title="Leaderboard"
        subtitle="Grade risers, easiest subjects, and hardest subjects on the 10-point scale."
      />

      <ResponsiveColumns gap={Spacing.three}>
        <View style={styles.controls}>
          <ChipRow
            options={SORT_OPTIONS}
            value={sort}
            onSelect={(value) => setSort(value as TrendsLeaderboardSort)}
          />
          <ChipRow options={disciplineChips} value={discipline} onSelect={setDiscipline} />
        </View>

        <SectionCard title={title} subtitle={subtitle}>
          {rows.length > 0 ? (
            <View style={styles.table}>
              <LeaderboardHeader />
              {rows.map((row, index) => (
                <LeaderboardRow
                  key={row.key}
                  row={row}
                  rank={index + 1}
                  onPress={() => openRow(row)}
                />
              ))}
            </View>
          ) : (
            <Text size="sm" dimmed>
              No leaderboard rows meet the minimum volume guard.
            </Text>
          )}
        </SectionCard>
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

function LeaderboardHeader() {
  return (
    <View style={[styles.row, styles.headerRow]}>
      <View style={styles.rankCell}>
        <Text size="xs" dimmed align="center">
          #
        </Text>
      </View>
      <View style={styles.nameCell}>
        <Text size="xs" dimmed>
          Name
        </Text>
      </View>
      <View style={styles.valueCell}>
        <Text size="xs" dimmed align="right">
          GPA
        </Text>
      </View>
      <View style={styles.valueCell}>
        <Text size="xs" dimmed align="right">
          Δ
        </Text>
      </View>
      <View style={styles.chevronCell} />
    </View>
  );
}

function LeaderboardRow({
  row,
  rank,
  onPress,
}: {
  row: TrendsLeaderboardRow;
  rank: number;
  onPress: () => void;
}) {
  const deltaColor =
    row.gpaDelta == null
      ? Surface.dimmed
      : row.gpaDelta > 0
        ? Surface.info
        : row.gpaDelta < 0
          ? Surface.warning
          : Surface.dimmed;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${row.label}${row.name ? `, ${row.name}` : ""}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rankCell}>
        <Text size="sm" weight="bold" dimmed align="center">
          {String(rank)}
        </Text>
      </View>
      <View style={styles.nameCell}>
        <Text size="sm" weight="semibold" numberOfLines={1} color={Surface.label}>
          {row.label}
        </Text>
        {row.name ? (
          <Text size="xs" dimmed numberOfLines={1}>
            {row.name}
          </Text>
        ) : null}
        <Text size="xs" dimmed>
          {formatLeaderboardSpan(row)}
        </Text>
      </View>
      <View style={styles.valueCell}>
        <Text size="sm" weight="semibold" align="right">
          {formatLeaderboardGpa(row.currentGpa)}
        </Text>
      </View>
      <View style={styles.valueCell}>
        <Text size="sm" weight="semibold" color={deltaColor} align="right">
          {formatLeaderboardDelta(row.gpaDelta)}
        </Text>
      </View>
      <View style={styles.chevronCell}>
        <AppIcon name="chevron.right" size={12} color={Surface.dimmed} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: Spacing.two,
  },
  table: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surface.border,
  },
  rowPressed: {
    backgroundColor: Surface.subtle,
  },
  headerRow: {
    paddingTop: 0,
  },
  rankCell: {
    width: 28,
  },
  nameCell: {
    flex: 1,
    gap: 2,
  },
  valueCell: {
    width: 58,
  },
  chevronCell: {
    width: 12,
    alignItems: "center",
  },
});
