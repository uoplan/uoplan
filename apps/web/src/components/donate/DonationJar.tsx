import { m } from "framer-motion";

interface DonationJarProps {
  /** Fill ratio in the range [0, 1]. */
  percent: number;
}

const WIDTH = 220;
const HEIGHT = 280;
const JAR_TOP = 64;
const JAR_BOTTOM = HEIGHT - 16;
const JAR_LEFT = 30;
const JAR_RIGHT = WIDTH - 30;

/**
 * A playful "donation jar" that fills with liquid as the fundraising progress
 * approaches the goal. Purely decorative; the accessible value lives in the
 * surrounding page text.
 */
export function DonationJar({ percent }: DonationJarProps) {
  const clamped = Math.min(1, Math.max(0, percent));
  const fillSpan = JAR_BOTTOM - JAR_TOP;
  const fillHeight = fillSpan * clamped;
  const fillY = JAR_BOTTOM - fillHeight;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <clipPath id="jar-clip">
          <rect
            x={JAR_LEFT}
            y={JAR_TOP}
            width={JAR_RIGHT - JAR_LEFT}
            height={JAR_BOTTOM - JAR_TOP}
            rx={26}
          />
        </clipPath>
        <linearGradient id="jar-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mantine-color-accentBlue-4)" />
          <stop offset="100%" stopColor="var(--mantine-color-accentBlue-7)" />
        </linearGradient>
      </defs>

      {/* Lid */}
      <rect
        x={JAR_LEFT - 6}
        y={JAR_TOP - 30}
        width={JAR_RIGHT - JAR_LEFT + 12}
        height={26}
        rx={8}
        fill="var(--app-text)"
        opacity={0.85}
      />
      <rect
        x={JAR_LEFT + 24}
        y={JAR_TOP - 46}
        width={JAR_RIGHT - JAR_LEFT - 48}
        height={18}
        rx={6}
        fill="var(--app-text)"
        opacity={0.55}
      />

      {/* Liquid */}
      <g clipPath="url(#jar-clip)">
        <m.rect
          x={JAR_LEFT}
          width={JAR_RIGHT - JAR_LEFT}
          fill="url(#jar-fill)"
          initial={{ y: JAR_BOTTOM, height: 0 }}
          animate={{ y: fillY, height: fillHeight }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </g>

      {/* Jar outline */}
      <rect
        x={JAR_LEFT}
        y={JAR_TOP}
        width={JAR_RIGHT - JAR_LEFT}
        height={JAR_BOTTOM - JAR_TOP}
        rx={26}
        fill="none"
        stroke="var(--app-text)"
        strokeWidth={3}
        opacity={0.7}
      />
    </svg>
  );
}
