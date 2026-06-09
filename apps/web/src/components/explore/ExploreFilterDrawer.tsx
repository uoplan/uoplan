import { useRef } from "react";
import { ActionIcon, Box, Divider, Drawer, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconEraser } from "@tabler/icons-react";
import { useTr, tr } from "../../i18n";
import type { ExploreFilterState } from "../../lib/explore/exploreFilters";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { ExploreFilterPopoverContent } from "./ExploreFilterPopoverContent";
import { filterSectionLabel } from "../../lib/explore/filterLabels";
import type { DisciplineOption, TermOption } from "./ExploreFilterPopoverContent";

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

export function ExploreFilterDrawer({
  opened,
  onClose,
  filters,
  onChange,
  initialSection,
  disciplineOptions = [],
  termOptions = [],
}: {
  opened: boolean;
  onClose: () => void;
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
  initialSection?: FilterKey;
  disciplineOptions?: DisciplineOption[];
  termOptions?: TermOption[];
}) {
  useTr();

  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Drawer.Root
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="auto"
      radius="md"
      styles={{ inner: { top: "auto", bottom: 0, height: "auto", alignItems: "flex-end" } }}
    >
      <Drawer.Overlay backgroundOpacity={0.5} />
      <Drawer.Content
        style={{
          backgroundColor: "var(--app-surface)",
          width: "100%",
          maxWidth: "100%",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "var(--app-border-strong)",
              margin: "10px auto 0",
              flexShrink: 0,
            }}
          />
          <Drawer.Header
            style={{ backgroundColor: "var(--app-surface)", paddingBottom: 0, flexShrink: 0 }}
          >
            <Drawer.Title
              style={{
                color: "var(--app-text)",
                fontWeight: 600,
                fontSize: "var(--mantine-font-size-md)",
              }}
            >
              {tr("explore.filter.title")}
            </Drawer.Title>
            <Group gap={4} wrap="nowrap">
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
              <Drawer.CloseButton style={{ color: "var(--app-text-muted)" }} />
            </Group>
          </Drawer.Header>
          <Drawer.Body style={{ flex: 1, minHeight: 0, padding: 0 }}>
            <div
              ref={scrollRef}
              style={{
                height: "100%",
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
            >
              <Stack gap={0} pb={24} pt={8}>
                {FILTER_KEYS.map((key, i) => (
                  <Box key={key} id={`drawer-section-${key}`}>
                    {i > 0 && <Divider color="var(--app-border)" my={16} />}
                    <Box px={16}>
                      <Text
                        size="xs"
                        fw={700}
                        c={initialSection === key ? "var(--app-accent)" : "dimmed"}
                        mb={12}
                        style={{ letterSpacing: "0.02em" }}
                      >
                        {filterSectionLabel(key)}
                      </Text>
                      <ExploreFilterPopoverContent
                        filterKey={key}
                        filters={filters}
                        onChange={onChange}
                        disciplineOptions={disciplineOptions}
                        termOptions={termOptions}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </div>
          </Drawer.Body>
        </div>
      </Drawer.Content>
    </Drawer.Root>
  );
}
