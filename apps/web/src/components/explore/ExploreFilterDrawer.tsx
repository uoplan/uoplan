import { Box, Divider, Drawer, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { tr } from "../../i18n";
import type { ExploreFilterState } from "../../lib/explore/exploreFilters";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { ExploreFilterPopoverContent, filterSectionLabel } from "./ExploreFilterPopoverContent";

const FILTER_KEYS = ["level", "language", "difficulty", "rating"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export function ExploreFilterDrawer({
  opened,
  onClose,
  filters,
  onChange,
  initialSection,
}: {
  opened: boolean;
  onClose: () => void;
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
  initialSection?: FilterKey;
}) {
  useLingui();

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="auto"
      radius="md"
      styles={{
        content: { backgroundColor: "#1a1b1e", maxHeight: "85dvh", overflowY: "auto" },
        header: { backgroundColor: "#1a1b1e", paddingBottom: 0 },
        title: { color: "#F8F9FA", fontWeight: 600, fontSize: "var(--mantine-font-size-md)" },
        close: { color: "#c1c2c5" },
      }}
      title={tr("explore.filter.clearAll")}
      withCloseButton
    >
      <Stack gap={0} pb={24}>
        <Group justify="flex-end" px={16} pb={8}>
          <UnstyledButton
            onClick={() => onChange(EMPTY_FILTERS)}
            style={{
              fontSize: "var(--mantine-font-size-xs)",
              color: "#868e96",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {tr("explore.filter.clearAll")}
          </UnstyledButton>
        </Group>

        {FILTER_KEYS.map((key, i) => (
          <Box key={key} id={`drawer-section-${key}`}>
            {i > 0 && <Divider color="#2c2e33" my={16} />}
            <Box px={16}>
              <Text
                size="xs"
                fw={700}
                tt="uppercase"
                c={initialSection === key ? "var(--mantine-color-violet-4)" : "dimmed"}
                mb={12}
                style={{ letterSpacing: "0.06em" }}
              >
                {filterSectionLabel(key)}
              </Text>
              <ExploreFilterPopoverContent filterKey={key} filters={filters} onChange={onChange} />
            </Box>
          </Box>
        ))}
      </Stack>
    </Drawer>
  );
}
