import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  MIN_COMPARE_ITEMS,
  compareRefsEqual,
  compareRefsFromIds,
  isCompareKind,
  type CompareKind,
  type CompareRef,
} from "@uoplan/core";
import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { GradeHistogram } from "@/components/grade-histogram";
import { RatingBadge } from "@/components/rating-badge";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { buildCourseCompareModels, type CourseCompareModel } from "@/data/compare-courses";
import { useCompare } from "@/data/compare-provider";
import { useAppData, useFeedback } from "@/data/data-provider";
import { useTr } from "@/i18n";
import { useAnalytics } from "@/lib/analytics";

type RouteParam = string | string[] | undefined;

interface CompareRowProps {
  label: string;
  models: readonly CourseCompareModel[];
  render(model: CourseCompareModel): ReactNode;
}

function paramText(raw: RouteParam): string {
  return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
}

function splitIds(raw: RouteParam): string[] {
  const value = paramText(raw);
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function refsKey(refs: readonly CompareRef[]): string {
  return refs.map((ref) => `${ref.kind}:${ref.id}`).join("|");
}

function valueText(value: string | number | null | undefined, fallback: string): ReactNode {
  if (value == null || value === "") {
    return (
      <Text size="sm" color={Surface.dimmed}>
        {fallback}
      </Text>
    );
  }
  return (
    <Text size="sm" color={Surface.label} numberOfLines={4}>
      {value}
    </Text>
  );
}

function languageValue(language: CourseCompareModel["language"], fallback: string): ReactNode {
  return valueText(language?.toUpperCase() ?? null, fallback);
}

function termsValue(model: CourseCompareModel, fallback: string): ReactNode {
  return valueText(model.terms.length > 0 ? model.terms.join("\n") : null, fallback);
}

function gradeValue(model: CourseCompareModel, fallback: string): ReactNode {
  if (!model.gradeViz) return valueText(null, fallback);
  return (
    <GradeHistogram
      gradeViz={model.gradeViz}
      maxBarPx={48}
      showSummary={false}
      density="compact"
      hideLabels
      showLegend={false}
      fitWidth
    />
  );
}

function ratingValue(
  kind: "rmp" | "satisfaction",
  value: number | null,
  fallback: string,
): ReactNode {
  if (value == null) return valueText(null, fallback);
  return <RatingBadge kind={kind} value={value} />;
}

function CompareRow({ label, models, render }: CompareRowProps) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.labelCell}>
        <Text size="xs" weight="bold" color={Surface.dimmed}>
          {label}
        </Text>
      </View>
      {models.map((model) => (
        <View key={`${label}-${model.code}`} style={styles.valueCell}>
          {render(model)}
        </View>
      ))}
    </View>
  );
}

export default function CompareScreen() {
  const router = useRouter();
  const tr = useTr();
  const analytics = useAnalytics();
  const params = useLocalSearchParams<{ resource?: string; ids?: string }>();
  const resource = paramText(params.resource);
  const resourceKind: CompareKind | null = isCompareKind(resource) ? resource : null;
  const urlRefs = useMemo(
    () => (resourceKind ? compareRefsFromIds(resourceKind, splitIds(params.ids)) : []),
    [resourceKind, params.ids],
  );
  const [activeRefs, setActiveRefs] = useState<CompareRef[]>(urlRefs);
  const activeKey = refsKey(activeRefs);
  const activeIds = useMemo(() => activeRefs.map((ref) => ref.id), [activeKey]);
  const { bundle, index, schedulesByTerm, aliasGroups } = useAppData();
  const feedback = useFeedback();
  const compare = useCompare();
  const viewed = useRef(false);

  useEffect(() => {
    setActiveRefs(urlRefs);
  }, [urlRefs]);

  useEffect(() => {
    if (viewed.current || !resourceKind) return;
    viewed.current = true;
    analytics.capture("compare_viewed", {
      kind: resourceKind,
      count: activeIds.length,
      ids: activeIds,
    });
  }, [analytics, resourceKind, activeKey, activeIds]);

  const models = useMemo(
    () =>
      resourceKind === "course"
        ? buildCourseCompareModels({
            bundle,
            index,
            schedulesByTerm,
            feedback,
            aliasGroups,
            ids: activeIds,
          })
        : [],
    [resourceKind, bundle, index, schedulesByTerm, feedback, aliasGroups, activeKey, activeIds],
  );

  const removeCourse = (code: string) => {
    const ref: CompareRef = { kind: "course", id: code };
    compare.remove(ref);
    const nextRefs = activeRefs.filter((active) => !compareRefsEqual(active, ref));
    setActiveRefs(nextRefs);
    router.setParams({ ids: nextRefs.map((next) => next.id).join(",") });
  };

  const none = tr("compare.value.none");
  const hasEnoughCourses = resourceKind === "course" && models.length >= MIN_COMPARE_ITEMS;

  return (
    <RedesignScreen gap={Spacing.three} onBack={() => router.back()}>
      <ScreenHeader
        title={tr("compare.page.title")}
        subtitle={resourceKind === "course" ? tr("compare.kind.course") : undefined}
      />

      {!hasEnoughCourses ? (
        <SectionCard>
          <View style={styles.emptyState}>
            <Text size="lg" weight="bold" color={Surface.label}>
              {tr("compare.empty.title")}
            </Text>
            <Text size="sm" dimmed>
              {tr("compare.empty.body")}
            </Text>
          </View>
        </SectionCard>
      ) : (
        <SectionCard padding={0}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.headerRow]}>
                <View style={styles.labelCell}>
                  <Text size="xs" weight="bold" color={Surface.dimmed}>
                    {tr("compare.kind.course")}
                  </Text>
                </View>
                {models.map((model) => (
                  <View key={model.code} style={[styles.valueCell, styles.headerCell]}>
                    <View style={styles.headerTitle}>
                      <Text size="sm" weight="bold" color={Surface.accent} numberOfLines={1}>
                        {model.code}
                      </Text>
                      <Text size="xs" dimmed numberOfLines={2}>
                        {model.title}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={tr("compare.remove.aria", { name: model.code })}
                      onPress={() => removeCourse(model.code)}
                      style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                    >
                      <AppIcon name="xmark" size={12} color={Surface.dimmed} />
                      <Text size="xs" color={Surface.dimmed}>
                        {tr("compare.remove")}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <CompareRow
                label={tr("compare.row.credits")}
                models={models}
                render={(model) => valueText(model.credits, none)}
              />
              <CompareRow
                label={tr("compare.row.faculty")}
                models={models}
                render={(model) => valueText(model.facultyName, none)}
              />
              <CompareRow
                label={tr("compare.row.level")}
                models={models}
                render={(model) => valueText(model.level, none)}
              />
              <CompareRow
                label={tr("compare.row.language")}
                models={models}
                render={(model) => languageValue(model.language, none)}
              />
              <CompareRow
                label={tr("compare.row.prereqs")}
                models={models}
                render={(model) =>
                  valueText(model.prerequisites ?? tr("compare.value.noPrereqs"), none)
                }
              />
              <CompareRow
                label={tr("compare.row.terms")}
                models={models}
                render={(model) => termsValue(model, none)}
              />
              <CompareRow
                label={tr("compare.row.grades")}
                models={models}
                render={(model) => gradeValue(model, none)}
              />
              <CompareRow
                label={tr("compare.row.avgGpa")}
                models={models}
                render={(model) =>
                  valueText(model.averageGpa == null ? null : model.averageGpa.toFixed(2), none)
                }
              />
              <CompareRow
                label={tr("compare.row.passing")}
                models={models}
                render={(model) =>
                  valueText(
                    model.passingPercent == null ? null : `${Math.round(model.passingPercent)}%`,
                    none,
                  )
                }
              />
              <CompareRow
                label={tr("compare.row.topRating")}
                models={models}
                render={(model) => ratingValue("rmp", model.topProfessorRating, none)}
              />
              <CompareRow
                label={tr("compare.row.sentiment")}
                models={models}
                render={(model) => ratingValue("satisfaction", model.sentiment, none)}
              />
            </View>
          </ScrollView>
        </SectionCard>
      )}
    </RedesignScreen>
  );
}

const LABEL_WIDTH = 92;
const COLUMN_WIDTH = 124;

const styles = StyleSheet.create({
  emptyState: {
    gap: Spacing.two,
  },
  table: {
    padding: Spacing.three,
  },
  tableRow: {
    alignItems: "stretch",
    borderBottomColor: Surface.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 64,
  },
  headerRow: {
    minHeight: 104,
  },
  labelCell: {
    justifyContent: "center",
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
    width: LABEL_WIDTH,
  },
  valueCell: {
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    width: COLUMN_WIDTH,
  },
  headerCell: {
    gap: Spacing.two,
    justifyContent: "space-between",
  },
  headerTitle: {
    gap: 2,
  },
  removeButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
