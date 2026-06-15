import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";
import type { PersonalizeRequirementsReadout } from "@/lib/personalize-requirements";
import type { CompletedRequirementItem, RemainingRequirement } from "@uoplan/core/requirements";

const DONE_COLOR = "#318c4c";
const ACTIVE_COLOR = "#bd7221";

/** A short, human label for a requirement node lacking an explicit title. */
function requirementLabel(type: string): string {
  switch (type) {
    case "discipline_elective":
      return "Discipline elective";
    case "faculty_elective":
      return "Faculty elective";
    case "credit_count":
      return "Course units";
    case "or_group":
    case "or_course":
      return "Choose one";
    default:
      return "Requirement";
  }
}

/** "9 credits · 2 done" style summary of what an outstanding block still needs. */
export function remainingSubtitle(req: RemainingRequirement): string {
  const parts: string[] = [];
  if (req.creditsNeeded != null && req.creditsNeeded > 0) {
    parts.push(`${req.creditsNeeded} credit${req.creditsNeeded === 1 ? "" : "s"} needed`);
  }
  if (req.satisfiedBy.length > 0) {
    parts.push(`${req.satisfiedBy.length} completed so far`);
  }
  if (parts.length === 0 && req.candidateCourses.length > 0) {
    parts.push(
      `${req.candidateCourses.length} eligible course${req.candidateCourses.length === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" · ");
}

function RemainingRow({ req }: { req: RemainingRequirement }) {
  const title = req.title ?? requirementLabel(req.type);
  const subtitle = remainingSubtitle(req);
  return (
    <View style={styles.row}>
      <AppIcon name="circle" size={16} color={ACTIVE_COLOR} weight="semibold" />
      <View style={styles.rowCopy}>
        <Text size="sm" weight="bold">
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" dimmed>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function CompletedRow({ item }: { item: CompletedRequirementItem }) {
  return (
    <View style={styles.row}>
      <AppIcon name="checkmark.circle.fill" size={16} color={DONE_COLOR} weight="semibold" />
      <View style={styles.rowCopy}>
        <Text size="sm" weight="bold">
          {item.title}
        </Text>
        {item.satisfiedBy.length > 0 ? (
          <Text size="xs" dimmed numberOfLines={1}>
            {item.satisfiedBy.join(", ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Renders the program's requirement progress inside the personalize "Fill
 * requirements" step: a status banner, the outstanding requirement blocks, and
 * the requirements already satisfied by the basket. Read-only — it reflects the
 * same `@uoplan/core` evaluation the web personalize page uses.
 */
export function PersonalizeRequirementsReadoutView({
  readout,
}: {
  readout: PersonalizeRequirementsReadout;
}) {
  const allMet = readout.remainingCount === 0;
  return (
    <View style={styles.container}>
      <View style={[styles.banner, allMet ? styles.bannerDone : styles.bannerActive]}>
        <AppIcon
          name={allMet ? "checkmark.circle.fill" : "list.bullet"}
          size={18}
          color={allMet ? DONE_COLOR : ACTIVE_COLOR}
          weight="semibold"
        />
        <Text size="sm" weight="bold" color={allMet ? DONE_COLOR : ACTIVE_COLOR}>
          {allMet
            ? "All program requirements met"
            : `${readout.remainingCount} requirement${readout.remainingCount === 1 ? "" : "s"} remaining`}
        </Text>
      </View>

      {readout.remaining.length > 0 ? (
        <View style={styles.section}>
          <Text size="xs" weight="bold" color={Surface.dimmed}>
            Outstanding
          </Text>
          {readout.remaining.map((req) => (
            <RemainingRow key={req.requirementId} req={req} />
          ))}
        </View>
      ) : null}

      {readout.completed.length > 0 ? (
        <View style={styles.section}>
          <Text size="xs" weight="bold" color={Surface.dimmed}>
            Completed ({readout.completed.length})
          </Text>
          {readout.completed.map((item, i) => (
            <CompletedRow key={`${item.title}-${i}`} item={item} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bannerActive: {
    backgroundColor: "rgba(189, 114, 33, 0.12)",
  },
  bannerDone: {
    backgroundColor: "rgba(49, 140, 76, 0.12)",
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
