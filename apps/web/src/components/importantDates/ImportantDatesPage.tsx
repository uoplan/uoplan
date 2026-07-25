import { Accordion, Box, Button, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ImportantDatesData,
  ImportantDateSection,
  ImportantDateTerm,
} from "@uoplan/core/dataTypes";
import { tr, useTr } from "../../i18n";
import {
  groupTermsByPublication,
  isTermPassed,
  selectDefaultTerm,
  sortImportantDateTerms,
  todayInToronto,
} from "../../lib/importantDates";
import type { CalendarEntry, ResolvedMonth } from "../../lib/importantDatesCalendar";
import {
  buildCalendarMonth,
  flattenTermToCalendarEntries,
  monthOfIsoDate,
  resolveInitialMonth,
  shiftMonth,
} from "../../lib/importantDatesCalendar";
import { BackButton } from "../shared/BackButton";
import { ChromeControls } from "../shared/ChromeControls";
import { PageContainer } from "../shared/PageContainer";
import { ImportantDateBadge } from "./ImportantDateBadge";
import { ImportantDatesCalendar } from "./ImportantDatesCalendar";
import classes from "./ImportantDatesPage.module.css";
import { useSchool } from "../../hooks/useSchool";

// ── Types ────────────────────────────────────────────────────────────────

export type ImportantDatesPageProps = {
  data: ImportantDatesData | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onDownload: (term: ImportantDateTerm) => void | Promise<void>;
  downloading?: boolean;
  downloadError?: string | null;
  /** Injected for tests; defaults to todayInToronto(). */
  today?: string;
};

// ── Sub-components ───────────────────────────────────────────────────────

/** A two-column semantic table for date rows in one section. */
function DatesTable({
  section,
  entryById,
  selectedItemId,
  onActivateBadge,
  registerRowRef,
}: {
  section: ImportantDateSection;
  entryById: Map<string, CalendarEntry>;
  selectedItemId: string | null;
  onActivateBadge: (entry: CalendarEntry, viaKeyboard: boolean) => void;
  registerRowRef: (itemId: string, el: HTMLTableRowElement | null) => void;
}) {
  return (
    <div className={classes.tableWrapper}>
      <table className={classes.table} aria-label={section.label}>
        <thead>
          <tr>
            <th scope="col">{tr("importantDates.table.topic")}</th>
            <th scope="col">{tr("importantDates.table.dates")}</th>
          </tr>
        </thead>
        {section.groups.map((group) => (
          <tbody key={group.id}>
            {group.label ? (
              <tr className={classes.groupRow}>
                {/* Explicit role needed: Chromium's AX tree doesn't expose scope="rowgroup" as rowheader without it */}
                {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles */}
                <th scope="rowgroup" role="rowheader" colSpan={2}>
                  {group.label}
                </th>
              </tr>
            ) : null}
            {group.items.map((item) => {
              const entry = entryById.get(item.id);
              const isSelected = selectedItemId === item.id;
              return (
                <tr
                  key={item.id}
                  id={`importantdates-row-${item.id}`}
                  ref={(el) => registerRowRef(item.id, el)}
                  tabIndex={-1}
                  className={isSelected ? classes.rowSelected : undefined}
                >
                  <td data-testid={`importantdates-topic-${item.id}`}>
                    {item.topic}
                    {item.usedEnglishFallback ? (
                      <span className={classes.fallbackBadge}>{tr("importantDates.fallback")}</span>
                    ) : null}
                  </td>
                  <td>
                    {entry ? (
                      <div className={classes.dateCell}>
                        <ImportantDateBadge
                          entry={entry}
                          selected={isSelected}
                          onActivate={(viaKeyboard) => onActivateBadge(entry, viaKeyboard)}
                        />
                        <span className={classes.dateText}>{item.dateText}</span>
                      </div>
                    ) : (
                      item.dateText
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Loading skeleton layout that matches the page shape. */
function LoadingState() {
  return (
    <Stack gap="md">
      {/* Title skeleton */}
      <Skeleton height={32} width="55%" radius="sm" />
      {/* Disclaimer skeleton */}
      <Skeleton height={14} width="75%" radius="xs" />
      <Skeleton height={14} width="55%" radius="xs" />
      {/* Term strip skeleton */}
      <div className={classes.skeletonStrip}>
        <Skeleton height={30} width={100} radius="xl" />
        <Skeleton height={30} width={120} radius="xl" />
        <Skeleton height={30} width={100} radius="xl" />
        <Skeleton height={30} width={80} radius="xl" />
      </div>
      {/* Content skeleton */}
      <div className={classes.skeletonContent}>
        <Skeleton height={36} radius="sm" />
        <Skeleton height={200} radius="sm" />
        <Skeleton height={36} radius="sm" />
        <Skeleton height={36} radius="sm" />
      </div>
    </Stack>
  );
}

/** Error state with inline retry. */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={classes.statusBox} role="alert">
      <Text c="var(--app-text)">{tr("importantDates.error")}</Text>
      <Button variant="default" size="sm" onClick={onRetry} style={{ alignSelf: "flex-start" }}>
        {tr("importantDates.retry")}
      </Button>
    </div>
  );
}

/** Empty state — no terms available. */
function EmptyState() {
  return (
    <div className={classes.statusBox}>
      <Text c="var(--app-text-muted)">{tr("importantDates.empty")}</Text>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function ImportantDatesPage({
  data,
  loading,
  error,
  onRetry,
  onDownload,
  downloading = false,
  downloadError = null,
  today: todayProp,
}: ImportantDatesPageProps) {
  useTr();
  const school = useSchool();

  const today = todayProp ?? todayInToronto();

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [viewGroup, setViewGroup] = useState<"current" | "historical">("current");

  // Ref map for programmatic focus during keyboard navigation
  const tabRefMap = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Derived term lists
  const sorted = data ? sortImportantDateTerms(data.terms) : [];
  const { current: currentTerms, historical: historicalTerms } = groupTermsByPublication(
    sorted,
    today,
  );
  const visibleTerms = viewGroup === "current" ? currentTerms : historicalTerms;

  // Default selection for the visible group
  const defaultTerm = selectDefaultTerm(visibleTerms, today);

  // Resolve selected term; fall back to default when id is no longer in the list
  const selectedTerm = visibleTerms.find((t) => t.sourceId === selectedSourceId) ?? defaultTerm;

  // ── Calendar + selection state ──────────────────────────────────────────

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<ResolvedMonth>(() =>
    selectedTerm ? resolveInitialMonth(selectedTerm, today) : monthOfIsoDate(today),
  );
  const [accordionValues, setAccordionValues] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const rowRefMap = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const calendarSectionRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<{
    itemId: string;
    keyboard: boolean;
    target: "table" | "calendar";
  } | null>(null);

  const registerRowRef = (itemId: string, el: HTMLTableRowElement | null) => {
    if (el) rowRefMap.current.set(itemId, el);
    else rowRefMap.current.delete(itemId);
  };

  const termEntries = useMemo(
    () => (selectedTerm ? flattenTermToCalendarEntries(selectedTerm) : []),
    [selectedTerm],
  );
  const entryById = useMemo(
    () => new Map(termEntries.map((e) => [e.itemId, e] as const)),
    [termEntries],
  );
  const overviewSectionIds = useMemo(
    () =>
      new Set(
        (selectedTerm?.sections ?? []).filter((s) => s.category === "overview").map((s) => s.id),
      ),
    [selectedTerm],
  );
  const calendarMonthData = useMemo(
    () => buildCalendarMonth(termEntries, calendarMonth),
    [termEntries, calendarMonth],
  );

  // Reset calendar/selection state whenever the selected term changes so
  // stale month/highlight/expansion doesn't leak across terms.
  useEffect(() => {
    if (!selectedTerm) return;
    setCalendarMonth(resolveInitialMonth(selectedTerm, today));
    setSelectedItemId(null);
    setAccordionValues([]);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTerm?.sourceId]);

  // After every render, if a scroll/focus is pending (from a badge or
  // calendar-event activation), try to resolve it. The target row may not
  // exist yet if it lives inside a collapsed Accordion.Panel (unmounted
  // content) — this simply retries on the next render once it expands.
  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

    if (pending.target === "calendar") {
      calendarSectionRef.current?.scrollIntoView({ behavior, block: "start" });
      if (pending.keyboard) {
        document.getElementById(`importantdates-calendar-event-${pending.itemId}`)?.focus();
      }
      pendingScrollRef.current = null;
      return;
    }

    const row = rowRefMap.current.get(pending.itemId);
    if (row) {
      row.scrollIntoView({ behavior, block: "center" });
      if (pending.keyboard) {
        const badgeButton = row.querySelector<HTMLElement>('[data-role="date-badge"]');
        (badgeButton ?? row).focus();
      }
      pendingScrollRef.current = null;
    }
  });

  const handleActivateEntry = (
    entry: CalendarEntry,
    viaKeyboard: boolean,
    origin: "badge" | "calendarEvent",
  ) => {
    setCalendarMonth(monthOfIsoDate(entry.startDate));
    setSelectedItemId(entry.itemId);
    if (!overviewSectionIds.has(entry.sectionId)) {
      setAccordionValues((values) =>
        values.includes(entry.sectionId) ? values : [...values, entry.sectionId],
      );
    }
    setAnnouncement(
      tr("importantDates.calendar.announceSelection", {
        topic: entry.topic,
        dateText: entry.dateText,
      }),
    );
    pendingScrollRef.current = {
      itemId: entry.itemId,
      keyboard: viaKeyboard,
      target: origin === "badge" ? "calendar" : "table",
    };
  };

  const handleNavigateCalendar = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCalendarMonth(monthOfIsoDate(today));
      return;
    }
    setCalendarMonth((m) => shiftMonth(m, direction === "next" ? 1 : -1));
  };

  // When data changes (or the view group changes), if the current selection is
  // no longer valid, clear it so we re-derive from defaultTerm.
  useEffect(() => {
    if (selectedSourceId !== null) {
      const stillValid = visibleTerms.some((t) => t.sourceId === selectedSourceId);
      if (!stillValid) {
        setSelectedSourceId(null);
      }
    }
  }, [visibleTerms, selectedSourceId]);

  // Automatic-activation keyboard handler for the term tablist.
  // Arrow keys, Home, and End both move focus AND select the target tab.
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const len = visibleTerms.length;
    let targetIdx: number | null = null;

    if (e.key === "ArrowRight") {
      targetIdx = (idx + 1) % len;
    } else if (e.key === "ArrowLeft") {
      targetIdx = (idx - 1 + len) % len;
    } else if (e.key === "Home") {
      targetIdx = 0;
    } else if (e.key === "End") {
      targetIdx = len - 1;
    }

    if (targetIdx !== null) {
      e.preventDefault();
      const target = visibleTerms[targetIdx];
      setSelectedSourceId(target.sourceId);
      tabRefMap.current.get(target.sourceId)?.focus();
    }
  };

  const handleDownload = () => {
    if (!selectedTerm) return;
    const run = async () => {
      try {
        await onDownload(selectedTerm);
      } catch {
        // Caller surfaces the error via downloadError prop.
      }
    };
    void run();
  };

  // ── Sections rendering ─────────────────────────────────────────────────

  const renderContent = (term: ImportantDateTerm) => {
    const overviewSections = term.sections.filter((s) => s.category === "overview");
    const otherSections = term.sections.filter((s) => s.category !== "overview");

    return (
      <>
        {overviewSections.map((section) => (
          <div key={section.id} className={classes.overviewSection}>
            {section.label ? (
              <Text fw={600} size="sm" c="var(--app-text-muted)" mb={8}>
                {section.label}
              </Text>
            ) : null}
            <DatesTable
              section={section}
              entryById={entryById}
              selectedItemId={selectedItemId}
              onActivateBadge={(entry, viaKeyboard) =>
                handleActivateEntry(entry, viaKeyboard, "badge")
              }
              registerRowRef={registerRowRef}
            />
          </div>
        ))}

        {otherSections.length > 0 ? (
          <Accordion
            multiple
            value={accordionValues}
            onChange={setAccordionValues}
            className={classes.accordionSections}
            radius="var(--app-radius)"
            variant="default"
            // Mantine keeps panel content mounted (hidden via CSS + inert)
            // by default. Force real unmounting so collapsed rows aren't in
            // the DOM at all, matching the badge/table linkage requirements.
            keepMounted={false}
          >
            {otherSections.map((section) => (
              <Accordion.Item key={section.id} value={section.id}>
                <Accordion.Control>{section.label}</Accordion.Control>
                <Accordion.Panel>
                  <DatesTable
                    section={section}
                    entryById={entryById}
                    selectedItemId={selectedItemId}
                    onActivateBadge={(entry, viaKeyboard) =>
                      handleActivateEntry(entry, viaKeyboard, "badge")
                    }
                    registerRowRef={registerRowRef}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        ) : null}
      </>
    );
  };

  // ── Term strip ─────────────────────────────────────────────────────────

  const otherGroupCount = viewGroup === "current" ? historicalTerms.length : currentTerms.length;
  const toggleLabel =
    viewGroup === "current"
      ? tr("importantDates.previousTerms", { count: otherGroupCount })
      : tr("importantDates.currentTerms", { count: otherGroupCount });

  const renderTermStrip = () => (
    <div className={classes.termStripWrapper}>
      {/* Outer strip: flex container for the tablist + toggle. No ARIA role here
          (role=tablist must own only role=tab children). */}
      <div className={classes.termStrip}>
        <div
          role="tablist"
          aria-label={tr("importantDates.termsLabel")}
          className={classes.termTabList}
        >
          {visibleTerms.map((term, idx) => {
            const passed = isTermPassed(term, today);
            const isActive = term.sourceId === selectedTerm?.sourceId;
            return (
              <button
                key={term.sourceId}
                id={`importantdates-tab-${term.sourceId}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={isActive ? `importantdates-panel-${term.sourceId}` : undefined}
                tabIndex={isActive ? 0 : -1}
                ref={(el) => {
                  if (el) tabRefMap.current.set(term.sourceId, el);
                  else tabRefMap.current.delete(term.sourceId);
                }}
                onClick={() => setSelectedSourceId(term.sourceId)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={[
                  classes.termTab,
                  isActive ? classes.termTabActive : "",
                  passed ? classes.termTabPassed : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {term.label}
                {passed ? (
                  <span className={classes.visuallyHidden}>
                    {" "}
                    {tr("importantDates.term.passed")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {otherGroupCount > 0 ? (
          <button
            type="button"
            className={classes.groupToggle}
            onClick={() => {
              setViewGroup((v) => (v === "current" ? "historical" : "current"));
              setSelectedSourceId(null);
            }}
          >
            {toggleLabel}
          </button>
        ) : null}
      </div>
    </div>
  );

  // ── Page shell ─────────────────────────────────────────────────────────

  return (
    <Box component="main" className={classes.page}>
      <PageContainer>
        <div className={classes.chromeRow}>
          <ChromeControls />
        </div>

        <BackButton fallbackTo="/" />

        <div className={classes.titleRow}>
          <Title
            order={1}
            style={{
              fontFamily: "var(--app-font-heading)",
              color: "var(--app-text)",
              fontWeight: 400,
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
            }}
          >
            {tr("importantDates.title")}
          </Title>
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={onRetry} />
        ) : !data || data.terms.length === 0 ? (
          <>
            <div className={classes.meta}>
              <Text size="sm" className={classes.disclaimer}>
                {tr("importantDates.disclaimer", { school: school.name })}
              </Text>
            </div>
            <EmptyState />
          </>
        ) : (
          <>
            <div className={classes.meta}>
              <Text size="sm" className={classes.disclaimer}>
                {tr("importantDates.disclaimer", { school: school.name })}
              </Text>
              <div className={classes.metaRow}>
                <Text size="sm" c="var(--app-text-muted)">
                  {tr("importantDates.source")}:{" "}
                  <Text
                    component="a"
                    href={data.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    c="var(--app-accent)"
                  >
                    {school.sourceLabel}
                  </Text>
                </Text>
                {data.reviewedText ? (
                  <Text size="sm" c="var(--app-text-dim)">
                    {tr("importantDates.reviewed")}: {data.reviewedText}
                  </Text>
                ) : null}
              </div>
            </div>

            {renderTermStrip()}

            {selectedTerm ? (
              <div
                id={`importantdates-panel-${selectedTerm.sourceId}`}
                role="tabpanel"
                aria-labelledby={`importantdates-tab-${selectedTerm.sourceId}`}
              >
                <div className={classes.actionRow}>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownload}
                    loading={downloading}
                    disabled={downloading}
                  >
                    {downloading ? tr("importantDates.downloading") : tr("importantDates.download")}
                  </Button>
                  {downloadError ? (
                    <Text className={classes.downloadError} role="alert">
                      {downloadError}
                    </Text>
                  ) : null}
                </div>
                <div ref={calendarSectionRef}>
                  <ImportantDatesCalendar
                    month={calendarMonth}
                    calendar={calendarMonthData}
                    today={today}
                    selectedItemId={selectedItemId}
                    onNavigate={handleNavigateCalendar}
                    onSelectEntry={(entry, viaKeyboard) =>
                      handleActivateEntry(entry, viaKeyboard, "calendarEvent")
                    }
                  />
                </div>
                {renderContent(selectedTerm)}
              </div>
            ) : null}
          </>
        )}

        <output aria-live="polite" className={classes.visuallyHidden}>
          {announcement}
        </output>
      </PageContainer>
    </Box>
  );
}
