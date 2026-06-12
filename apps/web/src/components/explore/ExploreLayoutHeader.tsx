import { Link } from "@tanstack/react-router";
import { Anchor, Box, Stack, TextInput, Title } from "@mantine/core";
import { tr, useTr } from "../../i18n";
import type { ExploreFilterState } from "../../lib/explore/exploreFilters";
import { BackButton } from "../shared/BackButton";
import { ExploreFilterBar } from "./ExploreFilterBar";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";

type ExploreLayoutHeaderProps = {
  onIndex: boolean;
  showBackButton: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSearchFocus: () => void;
  loading: boolean;
  filters: ExploreFilterState;
  onFilterChange: (next: Partial<ExploreFilterState>) => void;
  requirementsAvailable: boolean;
  disciplineOptions: { code: string; name: string }[];
  termOptions: { value: string; label: string }[];
};

function ExploreSearchInput({
  value,
  onChange,
  onFocus,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  disabled: boolean;
}) {
  useTr();

  return (
    <TextInput
      placeholder={tr("explore.searchPlaceholder")}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onFocus={onFocus}
      size="lg"
      radius={9999}
      disabled={disabled}
      w="100%"
      autoComplete="off"
      aria-label={tr("explore.searchPlaceholder")}
      styles={{
        root: { width: "100%" },
        input: {
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border-strong)",
          minHeight: 48,
          paddingInline: 18,
          fontSize: "var(--mantine-font-size-md)",
          boxShadow: "var(--app-shadow-sm)",
          "@media (min-width: 540px)": { minHeight: 52, paddingInline: 22 },
        },
      }}
    />
  );
}

export function ExploreLayoutHeader({
  onIndex,
  showBackButton,
  query,
  onQueryChange,
  onSearchFocus,
  loading,
  filters,
  onFilterChange,
  requirementsAvailable,
  disciplineOptions,
  termOptions,
}: ExploreLayoutHeaderProps) {
  useTr();

  return (
    <Box
      pt={24}
      pb="md"
      style={{
        flexShrink: 0,
        paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
        paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
      }}
    >
      <Box mb={8}>
        <BackButton fallbackTo={onIndex ? "/" : "/explore"} />
      </Box>
      <Stack gap="md" maw={520}>
        <Title
          order={showBackButton ? 3 : 2}
          c="var(--app-text)"
          fw={600}
          fz={showBackButton ? { base: "h4", sm: "h3" } : { base: "h3", sm: "h2" }}
        >
          {showBackButton ? (
            <Anchor
              component={Link}
              to="/explore"
              c="inherit"
              underline="hover"
              fz="inherit"
              fw="inherit"
            >
              {tr("explore.title")}
            </Anchor>
          ) : (
            tr("explore.title")
          )}
        </Title>
        <ExploreSearchInput
          value={query}
          onChange={onQueryChange}
          onFocus={onSearchFocus}
          disabled={loading}
        />
      </Stack>
      <Box
        mt="md"
        style={{
          marginLeft: `calc(-1 * ${EXPLORE_ACCORDION_PAD_INLINE.xs})`,
          marginRight: `calc(-1 * ${EXPLORE_ACCORDION_PAD_INLINE.xs})`,
        }}
      >
        <ExploreFilterBar
          filters={filters}
          onChange={onFilterChange}
          requirementsAvailable={requirementsAvailable}
          disciplineOptions={disciplineOptions}
          termOptions={termOptions}
          padInline={EXPLORE_ACCORDION_PAD_INLINE.xs}
        />
      </Box>
    </Box>
  );
}
