import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppIcon } from "@/components/app-icon";
import { useFloatingControlsBottom } from "@/components/redesign/fab";
import { GlassSurface } from "@/components/glass-surface";
import { StepDots } from "@/components/step-dots";
import { Fonts, Spacing, Surface } from "@/constants/theme";

export interface PagedStep {
  key: string;
  title: string;
  description?: string;
  content: ReactNode;
}

interface PagedStepperProps {
  steps: readonly PagedStep[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  /**
   * Bump this number to jump the pager back to the first step without
   * remounting it. Used by the personalize Reset action: a remount would reset
   * the pager's measured `size` to 0 and flash every page stacked at x=0, so we
   * just scroll back to page 0 instead.
   */
  resetSignal?: number;
}

function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

/**
 * One-time-per-launch guard for the swipe "peek" hint (see {@link PagedStepper}).
 * Module-scoped so navigating away and back doesn't replay it; resets on reload.
 */
let hasPlayedSwipePeek = false;

/** Approx. height of the floating dots pill (dots + vertical padding). */
const DOTS_PILL_HEIGHT = 34;

/**
 * Bottom inset (px) a paged step should reserve so its content clears the
 * floating dots pill (and the global basket cart, which shares the same bottom
 * anchor). Scrolling steps apply this to their scroll content's `paddingBottom`
 * so content scrolls *under* the floating controls instead of stopping above an
 * opaque band; short, non-scrolling steps apply it as their container's
 * `paddingBottom`.
 */
export function usePagedStepperContentInset(): number {
  return useFloatingControlsBottom() + DOTS_PILL_HEIGHT + Spacing.three;
}

/**
 * Full-screen, swipe-driven step carousel. Each step is a full-height page that
 * carries its own title + content, so swiping moves the WHOLE page (title and
 * all) rather than swapping a fixed header. There are no Back/Next buttons — the
 * dots **float** over the bottom of the page (a Liquid-Glass pill on iOS, a solid
 * pill elsewhere) and double as a jump control.
 *
 * Steps own their bottom clearance via {@link usePagedStepperContentInset}: the
 * page body fills the full height so scrolling steps can flow their content
 * *under* the floating dots/cart (no opaque band cutting content off), padding
 * their scroll content by the inset so the last item still clears the controls.
 */
export function PagedStepper({
  steps,
  initialIndex = 0,
  onIndexChange,
  resetSignal,
}: PagedStepperProps) {
  const floatingBottom = useFloatingControlsBottom();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(() => clampIndex(initialIndex, steps.length));
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const pageWidth = size.width;

  const moveTo = useCallback(
    (index: number, animated = true) => {
      const nextIndex = clampIndex(index, steps.length);
      setActiveIndex((current) => {
        if (current !== nextIndex) onIndexChange?.(nextIndex);
        return nextIndex;
      });
      if (pageWidth > 0) scrollRef.current?.scrollTo({ x: nextIndex * pageWidth, y: 0, animated });
    },
    [onIndexChange, pageWidth, steps.length],
  );

  // Jump back to the first step when the parent bumps `resetSignal` (e.g. the
  // personalize Reset action). Skip the initial mount so we don't fight
  // `initialIndex`.
  const didMountReset = useRef(false);
  useEffect(() => {
    if (!didMountReset.current) {
      didMountReset.current = true;
      return;
    }
    moveTo(0, false);
  }, [resetSignal, moveTo]);

  // Re-pin the scroll offset to the active page whenever the pager is (re)measured.
  useEffect(() => {
    if (pageWidth > 0) {
      scrollRef.current?.scrollTo({ x: activeIndex * pageWidth, y: 0, animated: false });
    }
  }, [pageWidth, activeIndex]);

  // First time the pager is shown this launch, gently nudge page 0 sideways and
  // back so the horizontal swipe gesture is discoverable: it reveals a sliver of
  // the next step, then springs home. Plays once per app launch and only while
  // sitting on the first step.
  const peekTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (hasPlayedSwipePeek) return;
    if (steps.length <= 1 || pageWidth <= 0 || activeIndex !== 0) return;
    hasPlayedSwipePeek = true;
    const peekDistance = Math.min(56, pageWidth * 0.16);
    peekTimers.current = [
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: peekDistance, y: 0, animated: true });
      }, 600),
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
      }, 1050),
    ];
    return () => {
      for (const timer of peekTimers.current) clearTimeout(timer);
      peekTimers.current = [];
    };
  }, [pageWidth, activeIndex, steps.length]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const nextIndex = clampIndex(
      Math.round(event.nativeEvent.contentOffset.x / pageWidth),
      steps.length,
    );
    setActiveIndex((current) => {
      if (current !== nextIndex) onIndexChange?.(nextIndex);
      return nextIndex;
    });
  };

  if (steps.length === 0) return null;

  return (
    <View style={styles.root}>
      <View
        style={styles.pagerArea}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize((prev) =>
            prev.width === width && prev.height === height ? prev : { width, height },
          );
        }}
      >
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={handleMomentumEnd}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
        >
          {steps.map((step, index) => (
            <View
              key={step.key}
              accessibilityElementsHidden={index !== activeIndex}
              importantForAccessibility={index === activeIndex ? "auto" : "no-hide-descendants"}
              style={{ width: size.width, height: size.height }}
            >
              <View style={styles.page}>
                <View style={styles.pageHeader}>
                  <Text style={styles.title}>{step.title}</Text>
                  {step.description ? (
                    <Text style={styles.description}>{step.description}</Text>
                  ) : null}
                </View>
                <View style={styles.pageBody}>{step.content}</View>
              </View>
            </View>
          ))}
        </Animated.ScrollView>
      </View>

      <View pointerEvents="box-none" style={[styles.dotsOverlay, { bottom: floatingBottom }]}>
        <GlassSurface style={styles.dotsPill}>
          <StepDots
            count={steps.length}
            activeIndex={activeIndex}
            scrollX={scrollX}
            pageWidth={pageWidth > 0 ? pageWidth : 1}
            onDotPress={(index) => moveTo(index)}
          />
          {activeIndex === 0 && steps.length > 1 ? <SwipeHintChevron /> : null}
        </GlassSurface>
      </View>
    </View>
  );
}

/**
 * Subtle, gently-drifting right chevron rendered beside the dots on the first
 * step to signal that the pages are horizontally swipeable. Decorative — hidden
 * from screen readers, which already get the tablist semantics from the dots.
 */
function SwipeHintChevron() {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  return (
    <Animated.View
      testID="swipe-hint"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.swipeHint,
        {
          opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          transform: [
            { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) },
          ],
        },
      ]}
    >
      <AppIcon name="chevron.right" size={15} color={Surface.accent} weight="semibold" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pagerArea: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  pageHeader: {
    gap: Spacing.one,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 38,
    color: Surface.label,
  },
  description: {
    maxWidth: 560,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: Surface.dimmed,
  },
  pageBody: {
    flex: 1,
  },
  dotsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dotsPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    overflow: "hidden",
  },
  swipeHint: {
    marginLeft: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
});
