import { type ReactNode, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from "react-native";

import type { GradeVizData } from "@uoplan/core/gradeDistribution";
import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { GradeVizBar } from "@/components/grade-viz-bar";
import { Spacing, Surface } from "@/constants/theme";

// LayoutAnimation needs an opt-in on old-architecture Android; iOS supports it
// natively. Under the New Architecture (Fabric) the setter is a no-op and warns,
// so only call it on the old architecture.
const IS_FABRIC = Boolean(
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager,
);
if (Platform.OS === "android" && !IS_FABRIC && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface CollapsibleEntry {
  /** Stable identity for the open/closed set. */
  key: string;
  /** Bold leading label (course code / discipline code). */
  code: string;
  /** Muted subtitle under the code (course/discipline name). */
  title?: string;
  /** Rich node rendered under the code/title (e.g. rating badges). */
  subtitleNode?: ReactNode;
  /** Trailing aligned stat (e.g. "5.3 avg"). */
  meta?: string;
  /** Compact grade-distribution bar drawn across the bottom of the header. */
  gradeViz?: GradeVizData | null;
  /**
   * Full-width node drawn across the bottom of the header, replacing the
   * compact `gradeViz` bar when provided (e.g. a full grade histogram).
   */
  headerExtra?: ReactNode;
  /** Expanded panel content. */
  body: ReactNode;
}

/**
 * Full-bleed collapsible list — the native analogue of the web explore
 * `ExploreFullBleed` + `ExploreAccordion`. Each entry is a tappable header (code
 * + title + trailing stat + grade-viz bar + a chevron that flips when open) that
 * reveals its `body` panel. Bleeds to the screen edges (negative gutter), draws
 * top/inter-item hairlines on a sunken surface, and animates open/close. Multiple
 * entries may be open at once, mirroring the web `Accordion multiple`.
 */
export function CollapsibleList({ entries }: { entries: CollapsibleEntry[] }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={styles.list}>
      {entries.map((entry, i) => {
        const open = openKeys.has(entry.key);
        const last = i === entries.length - 1;
        return (
          <View key={entry.key} style={[styles.item, last && styles.itemLast]}>
            <Pressable
              onPress={() => toggle(entry.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={styles.control}
            >
              <View style={styles.row}>
                <View style={styles.head}>
                  <View style={styles.text}>
                    <Text size="sm" weight="bold" numberOfLines={1}>
                      {entry.code}
                    </Text>
                    {entry.title ? (
                      <Text size="sm" dimmed numberOfLines={1}>
                        {entry.title}
                      </Text>
                    ) : null}
                    {entry.subtitleNode ?? null}
                  </View>
                  {entry.meta ? (
                    <Text size="sm" color={Surface.label}>
                      {entry.meta}
                    </Text>
                  ) : null}
                  <AppIcon
                    name={open ? "chevron.down" : "chevron.right"}
                    size={12}
                    color={Surface.dimmed}
                  />
                </View>
                {entry.headerExtra ? (
                  entry.headerExtra
                ) : entry.gradeViz ? (
                  <GradeVizBar gradeViz={entry.gradeViz} />
                ) : null}
              </View>
            </Pressable>
            {open ? <View style={styles.panel}>{entry.body}</View> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    // Bleed past the screen's horizontal gutter to the device edges.
    marginHorizontal: -Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
    backgroundColor: Surface.subtle,
  },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surface.border,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  control: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  row: {
    gap: Spacing.two,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  panel: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: Surface.page,
  },
});
