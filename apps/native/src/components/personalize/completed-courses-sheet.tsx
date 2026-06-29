import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";

export interface CompletedCourse {
  code: string;
  title: string;
}

interface CompletedCoursesSheetProps {
  /** Whether the drawer should be open; it lingers mounted for the exit animation. */
  open: boolean;
  courses: readonly CompletedCourse[];
  onRemove: (code: string) => void;
  onClose: () => void;
}

function CompletedCourseRow({
  course,
  onRemove,
}: {
  course: CompletedCourse;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text size="sm" weight="bold" color={Surface.accent}>
          {course.code}
        </Text>
        <Text size="xs" dimmed numberOfLines={1}>
          {course.title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${course.code}`}
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => [styles.remove, pressed ? styles.pressed : null]}
      >
        <AppIcon name="xmark" size={13} color={Surface.dimmed} weight="semibold" />
      </Pressable>
    </View>
  );
}

/**
 * Bottom-sheet drawer that lists the user's completed courses, each removable
 * with a tap — replacing the old inline expand/collapse chip list so a long
 * list no longer pushes the rest of the step around. Mirrors the picker sheet's
 * slide-up animation and surfaces.
 */
export function CompletedCoursesSheet({
  open,
  courses,
  onRemove,
  onClose,
}: CompletedCoursesSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 180,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, mounted, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [screenHeight, 0] });
  const renderItem: ListRenderItem<CompletedCourse> = ({ item }) => (
    <CompletedCourseRow course={item} onRemove={() => onRemove(item.code)} />
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.host}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text size="xl" weight="bold" color={Surface.label}>
                Completed courses
              </Text>
              <Text size="xs" dimmed>
                {courses.length} selected
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close completed courses"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
            >
              <AppIcon name="xmark" size={15} color={Surface.dimmed} weight="semibold" />
            </Pressable>
          </View>

          <FlatList
            data={courses}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            bounces={false}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text size="sm" dimmed align="center">
                  No completed courses yet.
                </Text>
              </View>
            }
          />

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.doneButton}>
            <Text size="sm" weight="bold" color={Surface.onAccent}>
              Done
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: Surface.page,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "80%",
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: Surface.border,
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  remove: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.page,
  },
  pressed: {
    opacity: 0.6,
  },
  empty: {
    paddingVertical: Spacing.five,
  },
  doneButton: {
    marginTop: Spacing.two,
    backgroundColor: Surface.accent,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
});
