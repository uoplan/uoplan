import { useRef } from "react";
import { Box, Divider, Drawer, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { tr } from "../../i18n";
import type { ExploreFilterState } from "../../lib/explore/exploreFilters";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { ExploreFilterPopoverContent, filterSectionLabel } from "./ExploreFilterPopoverContent";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragOffset, dragging, handlers } = useDragToDismiss({ opened, onClose, scrollRef });

  return (
    <Drawer.Root opened={opened} onClose={onClose} position="bottom" size="auto" radius="md">
      <Drawer.Overlay backgroundOpacity={0.5} />
      <Drawer.Content
        style={{
          backgroundColor: "#1a1b1e",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: `translateY(${dragOffset}px)`,
          transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          {...handlers}
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "#555",
              margin: "10px auto 0",
              flexShrink: 0,
            }}
          />
          <Drawer.Header style={{ backgroundColor: "#1a1b1e", paddingBottom: 0, flexShrink: 0 }}>
            <Drawer.Title
              style={{ color: "#F8F9FA", fontWeight: 600, fontSize: "var(--mantine-font-size-md)" }}
            >
              {tr("explore.filter.clearAll")}
            </Drawer.Title>
            <Drawer.CloseButton style={{ color: "#c1c2c5" }} />
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
                      <ExploreFilterPopoverContent
                        filterKey={key}
                        filters={filters}
                        onChange={onChange}
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
