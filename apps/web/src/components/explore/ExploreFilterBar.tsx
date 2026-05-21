import { Box, Group, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useLingui } from "@lingui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { tr } from "../../i18n";
import type { ExploreFilterState } from "../../lib/explore/exploreFilters";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { ExploreFilterPopoverContent } from "./ExploreFilterPopoverContent";
import { ExploreFilterDrawer } from "./ExploreFilterDrawer";

const FILTER_KEYS = ["level", "language", "difficulty", "rating", "sort"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
export const FILTER_PILL_RADIUS = 0;
export const FILTER_POPOVER_RADIUS = 0;

export function pillHasChevron(key: FilterKey): boolean {
  return key === "sort";
}

const RATING_KEY: Record<number, string> = { 3: "good", 3.5: "great", 4: "excellent" };

function pillLabel(key: FilterKey, filters: ExploreFilterState): string {
  if (key === "level") {
    if (filters.levels.length === 0) return tr("explore.filter.level");
    if (filters.levels.length === 1) return tr(`explore.filter.level.${filters.levels[0]}`);
    return `${tr("explore.filter.level")} (${filters.levels.length})`;
  }
  if (key === "language") {
    if (filters.languages.length === 0) return tr("explore.filter.language");
    if (filters.languages.length === 1)
      return tr(`explore.filter.language.${filters.languages[0]}`);
    return `${tr("explore.filter.language.en")} · ${tr("explore.filter.language.fr")}`;
  }
  if (key === "difficulty") {
    if (!filters.difficulty) return tr("explore.filter.difficulty");
    return tr(`explore.filter.difficulty.${filters.difficulty}`);
  }
  if (key === "rating") {
    if (filters.minRating === null) return tr("explore.filter.rating");
    const rk = RATING_KEY[filters.minRating];
    return rk ? tr(`explore.filter.rating.${rk}`) : tr("explore.filter.rating");
  }
  if (key === "sort") {
    const label = tr(`explore.sort.${filters.sortKey}`);
    if (filters.sortKey === "relevance") return label;
    const dirLabel =
      filters.sortDir === "asc" ? tr("explore.sort.ascending") : tr("explore.sort.descending");
    return `${label} · ${dirLabel}`;
  }
  return "";
}

function pillIsActive(key: FilterKey, filters: ExploreFilterState): boolean {
  if (key === "level") return filters.levels.length > 0;
  if (key === "language") return filters.languages.length > 0;
  if (key === "difficulty") return filters.difficulty !== null;
  if (key === "rating") return filters.minRating !== null;
  if (key === "sort") return filters.sortKey !== "relevance";
  return false;
}

function pillColors(key: FilterKey, filters: ExploreFilterState): { bg: string; border: string } {
  if (key === "difficulty" && filters.difficulty) {
    if (filters.difficulty === "easy")
      return { bg: "rgba(29,158,117,0.15)", border: "rgba(29,158,117,0.55)" };
    if (filters.difficulty === "moderate")
      return { bg: "rgba(186,117,23,0.15)", border: "rgba(186,117,23,0.55)" };
    if (filters.difficulty === "tough")
      return { bg: "rgba(163,45,45,0.18)", border: "rgba(163,45,45,0.55)" };
  }
  if (key === "rating" && filters.minRating !== null) {
    return { bg: "rgba(212,184,0,0.12)", border: "rgba(212,184,0,0.5)" };
  }
  // Level and Language: neutral white tint
  return { bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.22)" };
}

type FilterPillProps = {
  label: string;
  active: boolean;
  activeBg: string;
  activeBorder: string;
  onClick: () => void;
  showChevron?: boolean;
};

const FilterPill = forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ label, active, activeBg, activeBorder, onClick, showChevron = false }, ref) => (
    <UnstyledButton
      ref={ref}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        paddingInline: 10,
        paddingBlock: 4,
        borderRadius: FILTER_PILL_RADIUS,
        fontSize: "var(--mantine-font-size-xs)",
        fontWeight: active ? 600 : 400,
        color: active ? "#e9ecef" : "#868e96",
        backgroundColor: active ? activeBg : "#1a1b1e",
        border: `1px solid ${active ? activeBorder : "#3f424a"}`,
        transition: "border-color 120ms, background-color 120ms, color 120ms",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {label}
      {showChevron ? <IconChevronDown size={12} stroke={1.6} /> : null}
    </UnstyledButton>
  ),
);
FilterPill.displayName = "FilterPill";

export function ExploreFilterBar({
  filters,
  onChange,
}: {
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
}) {
  useLingui();
  const isMobile = useMediaQuery("(max-width: 539px)", false, {
    getInitialValueInEffect: false,
  });

  const [openedPopover, setOpenedPopover] = useState<FilterKey | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<FilterKey>("level");

  const pillBarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<FilterKey, HTMLButtonElement | null>>(new Map());

  // Close when clicking anywhere outside the pill bar or dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pillBarRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpenedPopover(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePillClick = (key: FilterKey) => {
    if (isMobile) {
      setDrawerSection(key);
      setDrawerOpen(true);
      return;
    }
    setOpenedPopover((prev) => (prev === key ? null : key));
  };

  const handleChange = (next: Partial<ExploreFilterState>) => {
    onChange({ ...filters, ...next });
  };

  const anyActive =
    filters.levels.length > 0 ||
    filters.languages.length > 0 ||
    filters.difficulty !== null ||
    filters.minRating !== null ||
    filters.sortKey !== "relevance";

  return (
    <>
      <Box
        ref={pillBarRef}
        style={{ overflowX: "auto", overflowY: "visible", scrollbarWidth: "none" }}
      >
        <Group gap={6} wrap="nowrap" style={{ width: "max-content" }}>
          {FILTER_KEYS.map((key) => {
            const active = pillIsActive(key, filters);
            const { bg, border } = pillColors(key, filters);
            return (
              <FilterPill
                key={key}
                ref={(el) => {
                  pillRefs.current.set(key, el);
                }}
                label={pillLabel(key, filters)}
                active={active}
                activeBg={bg}
                activeBorder={border}
                showChevron={pillHasChevron(key)}
                onClick={() => handlePillClick(key)}
              />
            );
          })}

          {anyActive && (
            <UnstyledButton
              onClick={() => onChange(EMPTY_FILTERS)}
              style={{
                fontSize: "var(--mantine-font-size-xs)",
                color: "#868e96",
                paddingInline: 4,
                whiteSpace: "nowrap",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {tr("explore.filter.clearAll")}
            </UnstyledButton>
          )}
        </Group>
      </Box>

      {openedPopover && !isMobile && (
        <FilterDropdown
          filterKey={openedPopover}
          pillRef={{ current: pillRefs.current.get(openedPopover) ?? null }}
          dropdownRef={dropdownRef}
          filters={filters}
          onChange={handleChange}
        />
      )}

      <ExploreFilterDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={handleChange}
        initialSection={drawerSection}
      />
    </>
  );
}

function FilterDropdown({
  filterKey,
  pillRef,
  dropdownRef,
  filters,
  onChange,
}: {
  filterKey: FilterKey;
  pillRef: React.RefObject<HTMLButtonElement | null>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
  }, [filterKey, pillRef]);

  if (!pos) return null;

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 300,
        backgroundColor: "#1a1b1e",
        border: "1px solid #3f424a",
        borderRadius: FILTER_POPOVER_RADIUS,
        padding: "12px 14px",
        minWidth: 180,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <ExploreFilterPopoverContent filterKey={filterKey} filters={filters} onChange={onChange} />
    </div>
  );
}
