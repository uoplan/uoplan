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
import { SearchField } from "@/components/redesign/search-field";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import { useBasket } from "@/data/basket-provider";
import { useAppData } from "@/data/data-provider";
import { searchExplore, type ExploreCourseEntry } from "@/data/explore-index";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";
import { useBasketStatus } from "@/lib/use-basket-status";

const FORM_SHEET_MAX_WIDTH = 540;
const FORM_SHEET_MARGIN = Spacing.four;
const FORM_SHEET_MAX_HEIGHT_RATIO = 0.82;
const SEARCH_RESULT_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 120;

interface BasketDrawerProps {
  opened: boolean;
  onClose: () => void;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const isTestEnvironment = process.env.NODE_ENV === "test";
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (isTestEnvironment) return undefined;
    if (value === debounced) return undefined;
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [debounced, delayMs, isTestEnvironment, value]);

  return isTestEnvironment ? value : debounced;
}

/** A basket course's primary readiness bucket, used to group the cart. */
type BasketGroupKey = "ready" | "prereq" | "unavailable";

interface BasketGroupMeta {
  label: string | null;
  tone: "neutral" | "warning" | "danger";
}

const GROUP_META: Record<BasketGroupKey, BasketGroupMeta> = {
  ready: { label: null, tone: "neutral" },
  prereq: { label: "Missing prerequisites", tone: "warning" },
  unavailable: { label: "Not available", tone: "danger" },
};

/** Display order: schedulable courses first, then the ones needing attention. */
const GROUP_ORDER: BasketGroupKey[] = ["ready", "prereq", "unavailable"];

function BasketPill({
  code,
  title,
  onRemove,
}: {
  code: string;
  title: string | null;
  onRemove: () => void;
}) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillCode}>{code}</Text>
      {title ? (
        <Text style={styles.pillTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.pillTitle} />
      )}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${code}`}
        hitSlop={10}
        style={({ pressed }) => [styles.trashButton, pressed && styles.pressed]}
      >
        <AppIcon name="trash" size={16} color={Surface.dimmed} />
      </Pressable>
    </View>
  );
}

function GroupHeader({ meta, count }: { meta: BasketGroupMeta; count: number }) {
  if (!meta.label) return null;
  const dotColor = meta.tone === "danger" ? Surface.danger : Surface.warning;
  return (
    <View style={styles.groupHeader}>
      <View style={[styles.groupDot, { backgroundColor: dotColor }]} />
      <Text style={styles.groupLabel}>{meta.label}</Text>
      <Text style={styles.groupCount}>{count}</Text>
    </View>
  );
}

function SearchResultRow({
  course,
  inBasket,
  onPress,
}: {
  course: ExploreCourseEntry;
  inBasket: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={inBasket ? `Remove ${course.code} from basket` : `Add ${course.code}`}
      style={({ pressed }) => [
        styles.pill,
        inBasket && styles.pillAdded,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.pillCode}>{course.code}</Text>
      <Text style={styles.pillTitle} numberOfLines={1}>
        {course.title}
      </Text>
      <View style={styles.searchIcon}>
        <AppIcon
          name={inBasket ? "checkmark" : "plus"}
          size={16}
          color={inBasket ? Surface.accent : Surface.dimmed}
          weight="semibold"
        />
      </View>
    </Pressable>
  );
}

function SearchBlock({
  query,
  onQueryChange,
  results,
  hasQuery,
  isEmptyBasket,
  hasCourse,
  onAddCourse,
  onBrowse,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: ExploreCourseEntry[];
  hasQuery: boolean;
  isEmptyBasket: boolean;
  hasCourse: (code: string) => boolean;
  onAddCourse: (course: ExploreCourseEntry) => void;
  onBrowse: () => void;
}) {
  return (
    <View style={styles.searchBlock}>
      <View style={styles.searchLabelRow}>
        <Text style={styles.sectionLabel}>
          {isEmptyBasket ? "Search for courses to add" : "Add another course"}
        </Text>
        <Pressable onPress={onBrowse} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.explorerLink}>Open explorer</Text>
        </Pressable>
      </View>
      <SearchField
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search for courses to add"
      />
      {hasQuery ? (
        results.length > 0 ? (
          <View style={styles.searchResults}>
            {results.map((course) => (
              <SearchResultRow
                key={course.code}
                course={course}
                inBasket={hasCourse(course.code)}
                onPress={() => onAddCourse(course)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.noResults}>No courses found</Text>
        )
      ) : null}
    </View>
  );
}

/**
 * Native bottom-sheet analogue of the web sitewide basket: a compact course cart
 * with inline readiness signals, grade context, and quick course search.
 */
export function BasketDrawer({ opened, onClose }: BasketDrawerProps) {
  const router = useRouter();
  const basket = useBasket();
  const { codes, remove, clear, count, has, add, toggle } = basket;
  const { index } = useAppData();
  const { items } = useBasketStatus();
  const { width, height, formSheet } = useAdaptiveLayout();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(opened);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

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

  const groups = useMemo(() => {
    const buckets: Record<BasketGroupKey, typeof items> = {
      ready: [],
      prereq: [],
      unavailable: [],
    };
    for (const item of items) {
      if (item.status.offering === "not_offered") buckets.unavailable.push(item);
      else if (item.status.prerequisite === "not_met") buckets.prereq.push(item);
      else buckets.ready.push(item);
    }
    return GROUP_ORDER.map((key) => ({ key, meta: GROUP_META[key], items: buckets[key] })).filter(
      (group) => group.items.length > 0,
    );
  }, [items]);

  const normalizedSearchQuery = debouncedSearchQuery.trim();
  const searchResults = useMemo(
    () =>
      normalizedSearchQuery.length > 0
        ? searchExplore(index, normalizedSearchQuery, SEARCH_RESULT_LIMIT).courses
        : [],
    [index, normalizedSearchQuery],
  );

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
    router.navigate(path);
  };

  const handleSearchResultPress = (course: ExploreCourseEntry) => {
    if (has(course.code)) {
      toggle(course.code);
    } else {
      add(course.code);
    }
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
            <View>
              <Text style={styles.title}>Basket</Text>
              <Text style={styles.subtitle}>
                {count > 0 ? `${count} course${count === 1 ? "" : "s"} to schedule` : "Start here"}
              </Text>
            </View>
            {count > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{count}</Text>
              </View>
            ) : null}
          </View>

          <SearchBlock
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            hasQuery={normalizedSearchQuery.length > 0}
            isEmptyBasket={count === 0}
            hasCourse={has}
            onAddCourse={handleSearchResultPress}
            onBrowse={() => go("/explore")}
          />

          {count === 0 ? (
            <View style={styles.emptyPanel}>
              <AppIcon name="cart.badge.plus" size={24} color={Surface.dimmed} />
              <Text style={styles.emptyText}>
                Add courses here, then generate a schedule from one place.
              </Text>
            </View>
          ) : (
            <View style={styles.cartBody}>
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {groups.map((group) => (
                  <View key={group.key} style={styles.group}>
                    <GroupHeader meta={group.meta} count={group.items.length} />
                    {group.items.map(({ code, course }) => (
                      <BasketPill
                        key={code}
                        code={code}
                        title={course?.title ?? null}
                        onRemove={() => remove(code)}
                      />
                    ))}
                  </View>
                ))}
              </ScrollView>

              <View style={styles.actions} pointerEvents="box-none">
                <Pressable
                  onPress={() => go("/schedule")}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.generateButton, pressed && styles.pressed]}
                >
                  <Text style={styles.generateText}>Generate</Text>
                </Pressable>
                <Pressable
                  onPress={clear}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
            </View>
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
    gap: Spacing.three,
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
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: Surface.label,
  },
  subtitle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Surface.dimmed,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.accentSoft,
  },
  countBadgeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: "700",
    color: Surface.accent,
  },
  searchBlock: {
    flexShrink: 0,
    gap: Spacing.two,
  },
  searchLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
    color: Surface.label,
  },
  explorerLink: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11.5,
    fontWeight: "700",
    color: Surface.accent,
  },
  searchResults: {
    gap: Spacing.one,
  },
  searchIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  noResults: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Surface.dimmed,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  emptyPanel: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    backgroundColor: Surface.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Surface.dimmed,
    textAlign: "center",
    lineHeight: 19,
  },
  cartBody: {
    flexShrink: 1,
    minHeight: 0,
    position: "relative",
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    gap: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: 64,
  },
  group: {
    gap: Spacing.one,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.one,
  },
  groupDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  groupLabel: {
    flex: 1,
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Surface.dimmed,
  },
  groupCount: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    color: Surface.dimmed,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: 48,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    borderRadius: 14,
    backgroundColor: Surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  pillAdded: {
    backgroundColor: Surface.accentSoft,
    borderColor: Surface.accentSoft,
  },
  pillCode: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.accent,
  },
  pillTitle: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Surface.label,
  },
  trashButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    backgroundColor: Surface.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
  },
  generateButton: {
    minHeight: 44,
    flexGrow: 1,
    flexBasis: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    backgroundColor: Surface.label,
  },
  generateText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.page,
  },
  clearButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  clearText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.dimmed,
  },
  pressed: {
    opacity: 0.82,
  },
});
