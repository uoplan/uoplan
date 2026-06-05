import { Alert, List, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";
import type { DesiredCourseResolution } from "../../../lib/generation/resolveDesiredCourses";
import { tr } from "../../../i18n";

/** Desired courses that count toward one remaining requirement (grouped for display). */
interface DesiredCourseAssignment {
  requirementTitle: string;
  codes: string[];
}

interface DesiredCourseWarningsProps {
  resolution: DesiredCourseResolution;
  /** Prereq-eligible desired courses that matched a remaining requirement, grouped by requirement. */
  assignments: DesiredCourseAssignment[];
}

/**
 * Feedback about the unified "courses you want" list in advanced mode. Every desired course is still
 * scheduled; this panel explains what each one maps to:
 * - assignments: scheduled AND counts toward a specific remaining requirement.
 * - `overflow`: scheduled, matches a requirement, but that requirement is already full.
 * - `noRequirement`: scheduled but may not count toward any remaining requirement.
 * - `prereqUnmet`: scheduled but prerequisites look unmet (likely needs instructor permission).
 * - `unavailable`: not offered this term, so it can't be scheduled.
 */
export function DesiredCourseWarnings({ resolution, assignments }: DesiredCourseWarningsProps) {
  const { noRequirement, prereqUnmet, unavailable, overflow } = resolution;
  if (
    assignments.length === 0 &&
    overflow.length === 0 &&
    noRequirement.length === 0 &&
    prereqUnmet.length === 0 &&
    unavailable.length === 0
  ) {
    return null;
  }

  return (
    <Stack gap="xs" data-testid="desired-course-warnings">
      {assignments.length > 0 && (
        <Alert
          color="green"
          variant="light"
          radius="md"
          icon={<IconCircleCheck size={16} />}
          title={tr("generationOptions.warn.assigned.title")}
        >
          <Stack gap={4}>
            {assignments.map(({ requirementTitle, codes }) => (
              <div key={requirementTitle}>
                <Text size="sm" fw={600}>
                  {requirementTitle}
                </Text>
                <Text size="sm" c="dimmed">
                  {codes.join(", ")}
                </Text>
              </div>
            ))}
          </Stack>
        </Alert>
      )}
      {overflow.length > 0 && (
        <Alert
          color="orange"
          variant="light"
          radius="md"
          icon={<IconAlertTriangle size={16} />}
          title={tr("generationOptions.warn.overflow.title")}
        >
          <Text size="sm">{tr("generationOptions.warn.overflow.body")}</Text>
          <List size="sm" mt={4}>
            {overflow.map((code) => (
              <List.Item key={code}>{code}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {noRequirement.length > 0 && (
        <Alert
          color="blue"
          variant="light"
          radius="md"
          icon={<IconInfoCircle size={16} />}
          title={tr("generationOptions.warn.noRequirement.title")}
        >
          <Text size="sm">{tr("generationOptions.warn.noRequirement.body")}</Text>
          <List size="sm" mt={4}>
            {noRequirement.map((code) => (
              <List.Item key={code}>{code}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {prereqUnmet.length > 0 && (
        <Alert
          color="yellow"
          variant="light"
          radius="md"
          icon={<IconAlertTriangle size={16} />}
          title={tr("generationOptions.warn.prereqUnmet.title")}
        >
          <Text size="sm">{tr("generationOptions.warn.prereqUnmet.body")}</Text>
          <List size="sm" mt={4}>
            {prereqUnmet.map((code) => (
              <List.Item key={code}>{code}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {unavailable.length > 0 && (
        <Alert
          color="gray"
          variant="light"
          radius="md"
          icon={<IconInfoCircle size={16} />}
          title={tr("generationOptions.warn.unavailable.title")}
        >
          <Text size="sm">{tr("generationOptions.warn.unavailable.body")}</Text>
          <List size="sm" mt={4}>
            {unavailable.map((code) => (
              <List.Item key={code}>{code}</List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}
