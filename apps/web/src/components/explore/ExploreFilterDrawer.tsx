import { ActionIcon, Box, Divider, Stack, Text, Tooltip } from "@mantine/core";
import { IconEraser } from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";
import type { ExploreFilterState } from "../../lib/explore/exploreFilters";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { BottomDrawer } from "../shared/BottomDrawer";
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

  return (
    <BottomDrawer
      opened={opened}
      onClose={onClose}
      title={tr("explore.filter.title")}
      headerActions={
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
      }
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
    </BottomDrawer>
  );
}
