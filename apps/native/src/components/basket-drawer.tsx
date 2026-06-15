import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppIcon } from "@/components/app-icon";
import { GradeVizBar } from "@/components/grade-viz-bar";
import { PillButton } from "@/components/redesign/pill-button";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import { useBasket } from "@/data/basket-provider";
import { useAppData } from "@/data/data-provider";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";

const FORM_SHEET_MAX_WIDTH = 540;
const FORM_SHEET_MARGIN = Spacing.four;
const FORM_SHEET_MAX_HEIGHT_RATIO = 0.82;

interface BasketDrawerProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Native bottom-sheet analogue of the web sitewide basket — the courses the user
 * has gathered to schedule. Opened from the cart FAB (instead of navigating to a
 * separate page): lists each desired course with its grade-viz bar and a remove
 * control, and hands off to the schedule generator. The dimmed backdrop fades in
 * while the sheet slides up (matching the calendar event drawer / web overlays).
 */
export function BasketDrawer({ opened, onClose }: BasketDrawerProps) {
  const router = useRouter();
  const { codes, remove, clear, count } = useBasket();
  const { index } = useAppData();
  const { width, height, formSheet } = useAdaptiveLayout();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(opened);

  useEffect(() => {
    if (opened) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [opened, mounted, progress]);

  const items = useMemo(() => {
    const byCode = new Map(index.courses.map((c) => [c.code, c] as const));
    return codes.map((code) => ({ code, course: byCode.get(code) ?? null }));
  }, [codes, index]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const formSheetWidth = Math.max(0, Math.min(FORM_SHEET_MAX_WIDTH, width - FORM_SHEET_MARGIN * 2));
  const formSheetMaxHeight = Math.max(
    0,
    Math.min(height * FORM_SHEET_MAX_HEIGHT_RATIO, height - FORM_SHEET_MARGIN * 2),
  );

  const go = (path: "/explore" | "/schedule") => {
    onClose();
    router.push(path);
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.root, formSheet ? styles.formSheetRoot : null]}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            formSheet
              ? {
                  width: formSheetWidth,
                  maxHeight: formSheetMaxHeight,
                  opacity: progress,
                  transform: [{ scale }],
                }
              : { transform: [{ translateY }] },
            formSheet ? styles.formSheet : null,
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Basket</Text>
            <Text style={styles.subtitle}>
              {count > 0 ? `${count} course${count === 1 ? "" : "s"} to schedule` : "Empty"}
            </Text>
          </View>

          {count === 0 ? (
            <View style={styles.empty}>
              <AppIcon name="cart" size={26} color={Surface.dimmed} />
              <Text style={styles.emptyText}>
                Your basket is empty. Add courses from the explorer to build a schedule.
              </Text>
              <Pressable
                onPress={() => go("/explore")}
                accessibilityRole="button"
                style={styles.browse}
              >
                <Text style={styles.browseText}>Browse courses</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {items.map(({ code, course }) => (
                  <View key={code} style={styles.row}>
                    <View style={styles.head}>
                      <View style={styles.text}>
                        <Text style={styles.code}>{code}</Text>
                        {course ? (
                          <Text style={styles.courseTitle} numberOfLines={1}>
                            {course.title}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => remove(code)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${code}`}
                        hitSlop={10}
                      >
                        <AppIcon name="xmark" size={14} color={Surface.dimmed} />
                      </Pressable>
                    </View>
                    {course?.gradeViz ? <GradeVizBar gradeViz={course.gradeViz} /> : null}
                  </View>
                ))}
              </ScrollView>

              <PillButton
                label="Generate schedule"
                variant="primary"
                onPress={() => go("/schedule")}
                style={styles.generate}
              />

              <PillButton label="Clear basket" variant="destructive" onPress={clear} />
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  formSheetRoot: {
    alignItems: "center",
    justifyContent: "center",
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
    maxHeight: "82%",
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  formSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: Surface.border,
    marginBottom: Spacing.two,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Surface.label,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Surface.dimmed,
  },
  empty: {
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Surface.dimmed,
    textAlign: "center",
  },
  browse: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: Surface.accentSoft,
  },
  browseText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.accent,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 0,
  },
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surface.border,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  code: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13.5,
    fontWeight: "700",
    color: Surface.accent,
  },
  courseTitle: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Surface.dimmed,
  },
  generate: {
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
});
