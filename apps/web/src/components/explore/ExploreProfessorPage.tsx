import { Accordion, Box, Group, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { normalizeProfessorName } from "@uoplan/core";
import { tr } from "../../i18n";
import { groupOfferingsByCourse } from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./ExploreOfferingsContext";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreCourseItem,
} from "./ExploreProfessorGradesLayout";
import { RateMyProfessorLink } from "./RateMyProfessorLink";

const EXPLORE_CHEVRON_RIGHT = {
  base: "12px",
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

const mobileMediaQuery = "@media (max-width: 540px)";

export function ExploreProfessorPage({
  legacyId,
  professorName: professorNameProp,
  professorRatings,
}: (
  | { legacyId: number; professorName?: undefined }
  | { professorName: string; legacyId?: undefined }
) & {
  professorRatings: ProfessorRatingsMap | null;
}) {
  useLingui();
  const { offerings: allOfferings } = useExploreOfferings();

  const professorOfferings = useMemo(() => {
    if (legacyId != null) return allOfferings.filter((o) => o.legacyId === legacyId);
    const nameLower = professorNameProp?.toLowerCase() ?? "";
    return allOfferings.filter((o) => o.professorName.toLowerCase() === nameLower);
  }, [allOfferings, legacyId, professorNameProp]);

  const displayName =
    professorOfferings[0]?.professorName ?? professorNameProp ?? tr("explore.professorFallback");

  const courseGroups = useMemo(
    () => groupOfferingsByCourse(professorOfferings),
    [professorOfferings],
  );

  const rmpEntry = professorRatings ? professorRatings[normalizeProfessorName(displayName)] : null;
  const hasRating = rmpEntry != null && Number.isFinite(rmpEntry.rating);

  const profRouteParam = legacyId != null ? String(legacyId) : encodeURIComponent(displayName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        <Box
          pt={4}
          pb={32}
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          }}
        >
          <Title order={2} c="#F8F9FA" fw={600} fz={{ base: "h3", sm: "h2" }}>
            {displayName}
          </Title>
          {(hasRating || (legacyId != null && Number.isFinite(legacyId) && legacyId > 0)) && (
            <Group gap={6} align="center" mt={8} wrap="wrap">
              {hasRating ? (
                <Text size="sm" c="dimmed">
                  {rmpEntry?.rating.toFixed(1)} · {rmpEntry?.numRatings} ratings
                </Text>
              ) : null}
              {legacyId != null && Number.isFinite(legacyId) && legacyId > 0 ? (
                <RateMyProfessorLink legacyId={legacyId} />
              ) : null}
            </Group>
          )}
        </Box>

        {courseGroups.length === 0 ? (
          <Box
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              [mobileMediaQuery]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
              },
            }}
          >
            <Text c="dimmed" size="sm">
              {tr("explore.professorNoCourses")}
            </Text>
          </Box>
        ) : (
          <Box
            style={{
              width: "100vw",
              maxWidth: "100vw",
              marginInline: "calc(50% - 50vw)",
            }}
          >
            <Accordion
              multiple
              radius={0}
              chevronPosition="right"
              variant="default"
              styles={{
                root: {
                  backgroundColor: "#141517",
                  borderTop: "1px solid #2c2e33",
                },
                item: {
                  borderBottom: "1px solid #2c2e33",
                  backgroundColor: "#18191c",
                  "&:last-of-type": { borderBottom: "none" },
                },
                control: {
                  position: "relative",
                  paddingTop: "var(--mantine-spacing-lg)",
                  paddingBottom: "var(--mantine-spacing-lg)",
                  paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
                  paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
                  borderRadius: 0,
                  backgroundColor: "#18191c",
                  "@media (max-width: 540px)": {
                    paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                    paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
                  },
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
                },
                label: { flex: 1, minWidth: 0, paddingRight: 0 },
                panel: { padding: 0, backgroundColor: "#141517" },
                content: { padding: 0 },
                chevron: {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: EXPLORE_CHEVRON_RIGHT.xs,
                  display: "flex",
                  alignItems: "center",
                  marginLeft: 0,
                  color: "var(--mantine-color-gray-5)",
                  "@media (max-width: 540px)": {
                    right: EXPLORE_CHEVRON_RIGHT.base,
                  },
                },
              }}
            >
              {courseGroups.map((g) => (
                <ExploreCourseItem
                  key={g.groupId}
                  group={g}
                  currentEntry={{
                    to: "/explore/professor/$legacyId",
                    params: { legacyId: profRouteParam },
                    label: displayName,
                  }}
                />
              ))}
            </Accordion>
          </Box>
        )}
      </Stack>
    </motion.div>
  );
}
