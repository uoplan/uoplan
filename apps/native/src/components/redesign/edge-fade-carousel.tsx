import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Spacing, Surface } from "@/constants/theme";

/** Width of each edge fade, in px. */
const FADE_WIDTH = 28;
/** Scroll distance over which an edge fade animates fully in/out. */
const FADE_DISTANCE = 24;

/** One edge's page-coloured → transparent gradient (drawn with SVG). */
function FadeEdge({
  side,
  opacity,
}: {
  side: "left" | "right";
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  const gid = `${useId()}-${side}`;
  // The opaque page-coloured stop sits against the screen edge, fading inward.
  const [x1, x2] = side === "left" ? ["0", "1"] : ["1", "0"];
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.fade, side === "left" ? styles.fadeLeft : styles.fadeRight, { opacity }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gid} x1={x1} y1="0" x2={x2} y2="0">
            <Stop offset="0" stopColor={Surface.page} stopOpacity={1} />
            <Stop offset="1" stopColor={Surface.page} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Full-bleed horizontal carousel with scroll-aware edge fades — the standard
 * App Store / Play Store pattern. The track breaks out of the page gutter so
 * cards scroll all the way to the screen edges (no dead side margins), while the
 * first/last cards still inset to {@link gutter} so they line up with the section
 * title. A page-coloured gradient fades in at each edge when there is more to
 * scroll in that direction (and out at the ends), making the horizontal scroll
 * obvious and giving the next card a soft "peek".
 */
export function EdgeFadeCarousel({
  children,
  gutter = Spacing.three,
}: {
  children: ReactNode;
  /** Horizontal page padding the track breaks out of (and re-insets to). */
  gutter?: number;
}) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const maxScroll = useRef(new Animated.Value(0)).current;
  const [dims, setDims] = useState({ layout: 0, content: 0 });

  useEffect(() => {
    maxScroll.setValue(Math.max(0, dims.content - dims.layout));
  }, [dims, maxScroll]);

  // Remaining scroll distance to the right end: drives the right fade, and
  // collapses both fades to 0 when the content does not overflow.
  const remaining = Animated.subtract(maxScroll, scrollX);
  const leftOpacity = scrollX.interpolate({
    inputRange: [0, FADE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const rightOpacity = remaining.interpolate({
    inputRange: [0, FADE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.root, { marginHorizontal: -gutter }]}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          setDims((d) => (d.layout === width ? d : { ...d, layout: width }));
        }}
        onContentSizeChange={(width) =>
          setDims((d) => (d.content === width ? d : { ...d, content: width }))
        }
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      >
        {children}
      </Animated.ScrollView>
      <FadeEdge side="left" opacity={leftOpacity} />
      <FadeEdge side="right" opacity={rightOpacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
  },
  content: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingVertical: 2,
  },
  fade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: FADE_WIDTH,
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
  },
});
