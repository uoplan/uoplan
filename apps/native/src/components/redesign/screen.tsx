import type { ReactNode } from "react";
import { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { BottomTabInset, MaxContentWidth, Spacing, Surface } from "@/constants/theme";

import { GlassIconButton } from "./glass-button";
import { FabStack } from "./fab";

/** Diameter of the sticky-bar glass buttons + the vertical padding around them. */
const BAR_BUTTON = 40;
const BAR_PAD_V = Spacing.one;
const BAR_HEIGHT = BAR_BUTTON + BAR_PAD_V * 2;
/** Extra distance the top scrim fades over, below the buttons' bottom edge. */
const SCRIM_FADE = 72;

interface RedesignScreenProps {
  children: ReactNode;
  /** Absolutely-positioned overlay (e.g. a FAB or bottom control bar). */
  overlay?: ReactNode;
  /** Vertical gap between top-level children. Defaults to `four` (24). */
  gap?: number;
  /** Drop the horizontal gutter (for full-bleed content like the calendar). */
  fullBleed?: boolean;
  /** Sticky-bar leading control: renders a glass back arrow on the left. */
  onBack?: () => void;
  /** Accessibility label for the sticky-bar back arrow (no visible text). */
  backLabel?: string;
  /** Extra leading control rendered on the left when there is no back arrow. */
  leading?: ReactNode;
  /**
   * Floating action button(s) — e.g. the basket / "add to basket" controls.
   * Rendered in a bottom-right {@link FabStack} (clearing the tab bar), NOT in
   * the sticky top bar, so they're easy to spot and reach on mobile.
   */
  cart?: ReactNode;
  /** Sticky-bar trailing control: renders a glass settings gear on the right. */
  onSettings?: () => void;
}

/**
 * Scroll scaffold for the redesigned screens: warm-paper background, safe-area +
 * tab-bar insets, a centred max-width column, and an optional absolute overlay
 * for FABs / control bars.
 *
 * The header chrome (back arrow on the left, a settings gear on the right) is
 * rendered as a **sticky top bar** that floats over the scrolling content: the
 * glass buttons stay pinned while the page title (rendered by `ScreenHeader` as
 * the first scroll child) scrolls underneath. A full-width top-down gradient
 * scrim fades in as content scrolls beneath the bar — opaque behind the buttons
 * and fading to transparent below them — so the floating buttons stay legible
 * over content without a hard solid band.
 *
 * The `cart` prop (basket / "add to basket" controls) is rendered separately as
 * a bottom-right {@link FabStack} so those primary actions are easy to spot and
 * thumb-reach on mobile.
 */
export function RedesignScreen({
  children,
  overlay,
  gap,
  fullBleed,
  onBack,
  backLabel,
  leading,
  cart,
  onSettings,
}: RedesignScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const hasLeading = Boolean(onBack || leading);
  const hasTrailing = Boolean(onSettings);
  const hasBar = hasLeading || hasTrailing;

  const edgeOpacity = scrollY.interpolate({
    inputRange: [0, 28],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // The page title rests one content gap (Spacing.three) below the BUTTONS'
  // bottom edge — not below the full bar height — so there's no dead band between
  // the floating buttons and the title. Scrolling slides the title up under them.
  const topInset = hasBar ? BAR_PAD_V + BAR_BUTTON : 0;

  // The sticky scrim spans the safe area + bar height, then fades out over an
  // extra `SCRIM_FADE` band below the buttons. It is a soft, mostly-transparent
  // top-down gradient (no opaque page-coloured band) so it reads as a gentle
  // shadow from the top: content scrolling underneath stays visible while the
  // floating glass buttons keep their own contrast.
  const scrimHeight = insets.top + BAR_HEIGHT + SCRIM_FADE;
  const scrimSolidStop = (insets.top + BAR_HEIGHT) / scrimHeight;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + topInset + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
            paddingHorizontal: fullBleed ? 0 : Spacing.three,
          },
        ]}
      >
        <View style={[styles.column, { gap: gap ?? Spacing.four }]}>{children}</View>
      </Animated.ScrollView>

      {hasBar ? (
        <View pointerEvents="box-none" style={[styles.barWrap, { paddingTop: insets.top }]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.barEdge, { height: scrimHeight, opacity: edgeOpacity }]}
          >
            <Svg width="100%" height={scrimHeight}>
              <Defs>
                <LinearGradient id="rd-top-scrim" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={Surface.page} stopOpacity={0.6} />
                  <Stop offset={scrimSolidStop} stopColor={Surface.page} stopOpacity={0.3} />
                  <Stop offset="1" stopColor={Surface.page} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height={scrimHeight} fill="url(#rd-top-scrim)" />
            </Svg>
          </Animated.View>
          <View pointerEvents="box-none" style={styles.barCenter}>
            <View pointerEvents="box-none" style={styles.barRow}>
              <View pointerEvents="box-none" style={styles.barSide}>
                {onBack ? (
                  <GlassIconButton
                    icon="chevron.left"
                    onPress={onBack}
                    accessibilityLabel={backLabel ?? "Back"}
                  />
                ) : (
                  leading
                )}
              </View>
              <View pointerEvents="box-none" style={styles.barSideEnd}>
                {onSettings ? (
                  <GlassIconButton
                    icon="gearshape"
                    onPress={onSettings}
                    accessibilityLabel="Settings"
                  />
                ) : null}
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {cart ? <FabStack>{cart}</FabStack> : null}

      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Surface.page,
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignItems: "center",
  },
  column: {
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  barWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  // Soft top-down gradient scrim: page-coloured and opaque behind the buttons,
  // fading to transparent below them (drawn with an SVG linear gradient). It
  // fades IN as content scrolls beneath the bar, so the floating glass buttons
  // stay legible over scrolling content without a hard solid band.
  barEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  barCenter: {
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: BAR_HEIGHT,
    paddingHorizontal: Spacing.three,
  },
  barSide: {
    flexDirection: "row",
    alignItems: "center",
  },
  barSideEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
});
