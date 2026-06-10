import { m, useReducedMotion } from "framer-motion";

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
  const reached = clamped >= 1;
  const prefersReduced = useReducedMotion();
  const fillSpan = JAR_BOTTOM - JAR_TOP;
  const fillHeight = fillSpan * clamped;
  const fillY = JAR_BOTTOM - fillHeight;
  const sparkles = [
    { cx: JAR_LEFT + 28, cy: JAR_TOP + 34, r: 4, delay: 0 },
    { cx: JAR_RIGHT - 30, cy: JAR_TOP + 58, r: 5, delay: 0.25 },
    { cx: WIDTH / 2 + 6, cy: JAR_TOP + 22, r: 3.5, delay: 0.5 },
    { cx: JAR_LEFT + 46, cy: JAR_BOTTOM - 46, r: 4.5, delay: 0.4 },
  ];

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
        <linearGradient id="jar-fill-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#f6c945" />
          <stop offset="100%" stopColor="#d99a16" />
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
          fill={reached ? "url(#jar-fill-gold)" : "url(#jar-fill)"}
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

      {/* Celebratory sparkles, shown only when the goal is reached */}
      {reached && (
        <g aria-hidden="true">
          {sparkles.map((s, i) => (
            <m.g
              key={i}
              initial={prefersReduced ? false : { opacity: 0, scale: 0 }}
              animate={
                prefersReduced
                  ? { opacity: 0.9, scale: 1 }
                  : { opacity: [0, 1, 0.7, 1], scale: [0, 1.1, 0.9, 1] }
              }
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : {
                      duration: 1.8,
                      delay: 0.9 + s.delay,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                    }
              }
              style={{ transformOrigin: `${s.cx}px ${s.cy}px` }}
            >
              <path
                d={`M ${s.cx} ${s.cy - s.r} L ${s.cx + s.r * 0.28} ${s.cy - s.r * 0.28} L ${s.cx + s.r} ${s.cy} L ${s.cx + s.r * 0.28} ${s.cy + s.r * 0.28} L ${s.cx} ${s.cy + s.r} L ${s.cx - s.r * 0.28} ${s.cy + s.r * 0.28} L ${s.cx - s.r} ${s.cy} L ${s.cx - s.r * 0.28} ${s.cy - s.r * 0.28} Z`}
                fill="#f6c945"
              />
            </m.g>
          ))}
        </g>
      )}
    </svg>
  );
}
