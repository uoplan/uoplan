import type { ReactNode } from "react";
import { Accordion, Box, Flex } from "@mantine/core";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  EXPLORE_CENTER_REF_PX,
} from "../../lib/explore/accordionPadding";

export const EXPLORE_MOBILE_MEDIA_QUERY = "@media (max-width: 540px)";

const EXPLORE_CHEVRON_RIGHT_XS = `max(12px, calc((100vw - min(100vw, ${EXPLORE_CENTER_REF_PX}px)) / 2 + 12px))`;

export function ExploreFullBleed({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        width: "100vw",
        maxWidth: "100vw",
        marginInline: "calc(50% - 50vw)",
      }}
    >
      {children}
    </Box>
  );
}

export function ExploreAccordion({
  children,
  chevronRightBase = "12px",
}: {
  children: ReactNode;
  chevronRightBase?: string;
}) {
  return (
    <Accordion
      multiple
      radius="var(--app-radius)"
      chevronPosition="right"
      variant="default"
      classNames={{ control: "explore-accordion-control" }}
      styles={{
        root: {
          backgroundColor: "var(--app-bg)",
          borderTop: "var(--app-border-width) solid var(--app-border)",
        },
        item: {
          borderBottom: "var(--app-border-width) solid var(--app-border)",
          backgroundColor: "var(--app-surface-sunken)",
          "&:last-of-type": { borderBottom: "none" },
        },
        control: {
          position: "relative",
          paddingTop: "var(--mantine-spacing-lg)",
          paddingBottom: "var(--mantine-spacing-lg)",
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
          borderRadius: "var(--app-radius-sm)",
          backgroundColor: "var(--app-surface-sunken)",
          [EXPLORE_MOBILE_MEDIA_QUERY]: {
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
            paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
          },
        },
        label: { flex: 1, minWidth: 0, paddingRight: 0 },
        panel: { padding: 0, backgroundColor: "var(--app-bg)" },
        content: { padding: 0 },
        chevron: {
          position: "absolute",
          top: 0,
          bottom: 0,
          right: EXPLORE_CHEVRON_RIGHT_XS,
          display: "flex",
          alignItems: "center",
          marginLeft: 0,
          color: "var(--app-text-muted)",
          [EXPLORE_MOBILE_MEDIA_QUERY]: {
            right: chevronRightBase,
          },
        },
      }}
    >
      {children}
    </Accordion>
  );
}

export function ExploreEntityHeader({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <Box
      pt={{ base: 4, md: 0 }}
      pb="md"
      style={{
        paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
        paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
      }}
    >
      <Flex
        direction={{ base: "column", md: "row" }}
        gap="lg"
        align={{ base: "stretch", md: "center" }}
      >
        <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
        {aside}
      </Flex>
    </Box>
  );
}

export function ExploreFeedbackAside({ children }: { children: ReactNode }) {
  return <Box style={{ width: "100%", maxWidth: 420 }}>{children}</Box>;
}
