import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text as NativeText, View } from "react-native";

import { Text } from "@uoplan/ui";

import { Spacing, Surface } from "@/constants/theme";
import { useTr } from "@/i18n";
import { useCourseDescription } from "@/hooks/use-course-description";

/**
 * Native "About" section that fetches and renders the course description.
 *
 * Rendering rules:
 * - Loading: ActivityIndicator skeleton placeholder.
 * - Error: inline error text + retry button.
 * - Empty description after load (no error): renders nothing.
 * - Descriptions that exceed 2 rendered lines are clamped with an inline
 *   Read more / Read less disclosure.
 *
 * Resets expanded state when course changes.
 */
export function CourseDescriptionSection({
  courseCode,
  facultyId,
}: {
  courseCode: string | null;
  facultyId: string | null;
}) {
  const tr = useTr();
  const { description, loading, error, retry } = useCourseDescription(courseCode, facultyId);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Reset expanded on course change
  useEffect(() => {
    setExpanded(false);
    setOverflows(false);
  }, [courseCode]);

  const showToggle = overflows;
  const isClamped = overflows && !expanded;

  // Omit the section entirely when there is nothing to show and no in-progress state.
  if (!loading && !error && !description) return null;

  return (
    <View style={styles.container}>
      <Text size="sm" weight="bold" color={Surface.label}>
        {tr("explore.course.about")}
      </Text>

      {loading ? (
        <View style={styles.skeleton}>
          <ActivityIndicator size="small" color={Surface.dimmed} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text size="sm" color={Surface.danger}>
            {tr("explore.course.description.error")}
          </Text>
          <Pressable onPress={retry} accessibilityRole="button" style={styles.retryButton}>
            <Text size="sm" weight="bold" color={Surface.accent}>
              {tr("explore.course.description.retry")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.descriptionContainer}>
          <NativeText
            testID="course-description-text"
            style={styles.description}
            numberOfLines={isClamped ? 2 : undefined}
            onTextLayout={
              !overflows ? (event) => setOverflows(event.nativeEvent.lines.length > 2) : undefined
            }
          >
            {description}
            {expanded && showToggle ? (
              <>
                {" "}
                <NativeText
                  accessibilityRole="button"
                  accessibilityState={{ expanded: true }}
                  onPress={() => setExpanded(false)}
                  style={styles.expandedToggle}
                >
                  {tr("explore.course.description.showLess")}
                </NativeText>
              </>
            ) : null}
          </NativeText>
          {showToggle && !expanded ? (
            <Pressable
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              hitSlop={8}
              style={styles.collapsedToggle}
            >
              <NativeText style={styles.ellipsis}>… </NativeText>
              <Text size="sm" weight="bold" color={Surface.accent}>
                {tr("explore.course.description.showMore")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  skeleton: {
    paddingVertical: Spacing.three,
    alignItems: "flex-start",
  },
  errorContainer: {
    gap: Spacing.two,
  },
  retryButton: {
    paddingVertical: Spacing.one,
  },
  descriptionContainer: {
    position: "relative",
    width: "100%",
  },
  collapsedToggle: {
    position: "absolute",
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.one,
    backgroundColor: Surface.page,
  },
  ellipsis: {
    color: Surface.label,
    fontFamily: "DM Mono",
    fontSize: 14,
  },
  expandedToggle: {
    color: Surface.accent,
    fontFamily: "DM Mono Medium",
    fontSize: 14,
  },
  description: {
    color: Surface.label,
    fontFamily: "DM Mono",
    fontSize: 14,
    lineHeight: 22,
  },
});
