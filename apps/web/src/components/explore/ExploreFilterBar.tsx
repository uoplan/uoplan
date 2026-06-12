import { ActionIcon, Box, Group, Tooltip, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconArrowsSort, IconEraser } from "@tabler/icons-react";
import { AnimatePresence, m } from "framer-motion";
import { forwardRef, useEffect, useRef, useState } from "react";
import { tr, useTr } from "../../i18n";
import type { ExploreFilterState } from "../../lib/explore/exploreFilters";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { ExploreFilterPopoverContent } from "./ExploreFilterPopoverContent";
import type { DisciplineOption, TermOption } from "./ExploreFilterPopoverContent";
import { ExploreFilterDrawer } from "./ExploreFilterDrawer";

const FILTER_KEYS = [
  "level",
  "language",
  "discipline",
  "difficulty",
  "rating",
  "feedback",
  "term",
  "sort",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
export const FILTER_PILL_RADIUS = "var(--app-radius-pill)";
export const FILTER_POPOVER_RADIUS = "var(--app-radius)";

const RATING_KEY: Record<number, string> = { 3: "good", 3.5: "great", 4: "excellent" };
const FEEDBACK_KEY: Record<number, string> = { 3: "good", 3.5: "great", 4: "excellent" };

function pillLabel(key: FilterKey, filters: ExploreFilterState, termOptions: TermOption[]): string {
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
  if (key === "discipline") {
    if (filters.disciplines.length === 0) return tr("explore.filter.discipline");
    if (filters.disciplines.length === 1) return filters.disciplines[0];
    return `${tr("explore.filter.discipline")} (${filters.disciplines.length})`;
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
  if (key === "feedback") {
    if (filters.minFeedback === null) return tr("explore.filter.feedback");
    const fk = FEEDBACK_KEY[filters.minFeedback];
    return fk ? tr(`explore.filter.feedback.${fk}`) : tr("explore.filter.feedback");
  }
  if (key === "term") {
    if (filters.termId === null) return tr("explore.filter.term");
    const match = termOptions.find((t) => t.value === String(filters.termId));
    return match?.label ?? tr("explore.filter.term");
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
  if (key === "discipline") return filters.disciplines.length > 0;
  if (key === "difficulty") return filters.difficulty !== null;
  if (key === "rating") return filters.minRating !== null;
  if (key === "feedback") return filters.minFeedback !== null;
  if (key === "term") return filters.termId !== null;
  if (key === "sort") return filters.sortKey !== "relevance";
  return false;
}

function pillColors(key: FilterKey, filters: ExploreFilterState): { bg: string; border: string } {
  if (key === "difficulty" && filters.difficulty) {
    if (filters.difficulty === "easy") {
      return { bg: "var(--app-success-soft)", border: "var(--app-success)" };
    }
    if (filters.difficulty === "moderate") {
      return { bg: "var(--app-warning-soft)", border: "var(--app-warning)" };
    }
    return { bg: "var(--app-danger-soft)", border: "var(--app-danger)" };
  }
  if (key === "rating" && filters.minRating !== null) {
    return { bg: "var(--app-info-soft)", border: "var(--app-info)" };
  }
  if (key === "feedback" && filters.minFeedback !== null) {
    return { bg: "var(--app-info-soft)", border: "var(--app-info)" };
  }
  return { bg: "var(--app-translucent)", border: "var(--app-translucent-strong)" };
}

type FilterPillProps = {
  label: string;
  active: boolean;
  activeBg: string;
  activeBorder: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

const FilterPill = forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ label, active, activeBg, activeBorder, onClick, icon }, ref) => (
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
        color: active ? "var(--app-text)" : "var(--app-text-dim)",
        backgroundColor: active ? activeBg : "var(--app-surface)",
        border: `var(--app-border-width) solid ${active ? activeBorder : "var(--app-border)"}`,
        transition:
          "border-color var(--app-transition), background-color var(--app-transition), color var(--app-transition), transform var(--app-transition)",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {label}
      {icon}
    </UnstyledButton>
  ),
);
FilterPill.displayName = "FilterPill";

export function ExploreFilterBar({
  filters,
  onChange,
  disciplineOptions = [],
  termOptions = [],
  padInline = "0px",
}: {
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
  disciplineOptions?: DisciplineOption[];
  termOptions?: TermOption[];
  padInline?: string;
}) {
  useTr();
  const isMobile = useMediaQuery("(max-width: 539px)", false, {
    getInitialValueInEffect: false,
  });

  const [openedPopover, setOpenedPopover] = useState<FilterKey | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
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
      setPopoverPos(null);
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
    if (openedPopover === key) {
      setOpenedPopover(null);
      setPopoverPos(null);
    } else {
      setOpenedPopover(key);
      const el = pillRefs.current.get(key);
      if (el) {
        const rect = el.getBoundingClientRect();
        setPopoverPos({ top: rect.bottom + 6, left: rect.left });
      }
    }
  };

  const handleChange = (next: Partial<ExploreFilterState>) => {
    onChange(next);
  };

  const anyActive =
    filters.levels.length > 0 ||
    filters.languages.length > 0 ||
    filters.disciplines.length > 0 ||
    filters.difficulty !== null ||
    filters.minRating !== null ||
    filters.minFeedback !== null ||
    filters.termId !== null ||
    filters.sortKey !== "relevance";

  return (
    <>
      <Box
        ref={pillBarRef}
        style={{ overflowX: "auto", overflowY: "visible", scrollbarWidth: "none" }}
      >
        <Group gap={6} wrap="nowrap" style={{ width: "max-content", paddingInline: padInline }}>
          {FILTER_KEYS.map((key) => {
            const active = pillIsActive(key, filters);
            const { bg, border } = pillColors(key, filters);
            return (
              <FilterPill
                key={key}
                ref={(el) => {
                  pillRefs.current.set(key, el);
                }}
                label={pillLabel(key, filters, termOptions)}
                active={active}
                activeBg={bg}
                activeBorder={border}
                icon={key === "sort" ? <IconArrowsSort size={13} stroke={1.6} /> : undefined}
                onClick={() => handlePillClick(key)}
              />
            );
          })}

          {anyActive && (
            <Tooltip label={tr("explore.filter.clearAll")} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="md"
                onClick={() => onChange(EMPTY_FILTERS)}
                aria-label={tr("explore.filter.clearAll")}
              >
                <IconEraser size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Box>

      <AnimatePresence>
        {openedPopover && !isMobile && popoverPos && (
          <FilterDropdown
            key={openedPopover}
            filterKey={openedPopover}
            pos={popoverPos}
            dropdownRef={dropdownRef}
            filters={filters}
            onChange={handleChange}
            disciplineOptions={disciplineOptions}
            termOptions={termOptions}
          />
        )}
      </AnimatePresence>

      <ExploreFilterDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={handleChange}
        initialSection={drawerSection}
        disciplineOptions={disciplineOptions}
        termOptions={termOptions}
      />
    </>
  );
}

const POPOVER_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function FilterDropdown({
  filterKey,
  pos,
  dropdownRef,
  filters,
  onChange,
  disciplineOptions,
  termOptions,
}: {
  filterKey: FilterKey;
  pos: { top: number; left: number };
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
  disciplineOptions: DisciplineOption[];
  termOptions: TermOption[];
}) {
  return (
    <m.div
      ref={dropdownRef}
      key={filterKey}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: POPOVER_EASE }}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 300,
        backgroundColor: "var(--app-surface)",
        border: "var(--app-border-width) solid var(--app-border)",
        borderRadius: FILTER_POPOVER_RADIUS,
        padding: "12px 14px",
        minWidth: 180,
        boxShadow: "var(--app-shadow)",
        transformOrigin: "top left",
      }}
    >
      <ExploreFilterPopoverContent
        filterKey={filterKey}
        filters={filters}
        onChange={onChange}
        disciplineOptions={disciplineOptions}
        termOptions={termOptions}
      />
    </m.div>
  );
}
