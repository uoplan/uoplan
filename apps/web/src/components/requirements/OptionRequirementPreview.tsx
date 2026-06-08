import {
  useState,
  type CSSProperties,
  type MouseEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Stack, Text, Paper, Badge, Group, Box, Tooltip } from "@mantine/core";
import type { PaperProps } from "@mantine/core";
import type { RequirementWithStatus } from "@uoplan/core";
import {
  getOptionSecondarySummaryLine,
  simplifySingleChildChain,
} from "../../lib/requirements/requirementUtils";
import { getNodeDisplayTitle, getStableNodeKey, REQUIREMENT_INDENT_PX } from "./RequirementNode";
import { tr } from "../../i18n";

const REQUIREMENT_BASE_PADDING_PX = 10;

const TITLE_FLEX = { flex: 1, minWidth: 0 } as const;
const BADGE_NO_SHRINK = { flexShrink: 0 } as const;

const OPTION_CARD_BORDER_UNSELECTED = "var(--app-border)";
const OPTION_CARD_BORDER_SELECTED = "var(--app-accent)";
const OPTION_CARD_BG_SELECTED = "var(--app-info-soft)";
const OPTION_CARD_HOVER_BG = "var(--app-surface-hover)";
const OPTION_CARD_IDLE_BG = "var(--app-surface)";

/** Numbered circle indicator (①②③) shown on each selectable option card. */
function NumberCircle({ number, selected }: { number: number; selected: boolean }) {
  return (
    <Box
      aria-hidden
      style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        borderWidth: "var(--app-border-width)",
        borderStyle: "solid",
        borderColor: selected ? "var(--app-accent)" : "var(--app-border)",
        backgroundColor: selected ? "var(--app-accent)" : "var(--app-bg)",
        color: selected ? "var(--app-on-accent)" : "var(--app-text-muted)",
        transition: "var(--app-transition)",
      }}
    >
      {number}
    </Box>
  );
}

interface RadioConfig {
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
  disabled?: boolean;
}

interface OptionRequirementPreviewProps {
  node: RequirementWithStatus;
  activeBranch: boolean;
  depth?: number;
  radio?: RadioConfig;
  /** Hides catalogue-style titles on option cards; body (nested groups, summaries) stays visible. */
  optionsStepHideCardTitle?: boolean;
  /** 1-based index label ("Option 1") on this selectable card only. */
  optionsStepOptionOrdinal?: number;
}

function optionsStepOptionCardAriaLabel(
  node: RequirementWithStatus,
  optionOrdinal?: number,
): string {
  const detail =
    getOptionSecondarySummaryLine(node) ??
    getNodeDisplayTitle(node) ??
    "Select this requirement option";
  if (optionOrdinal != null) {
    return `${tr("optionsDrilldown.optionTitle", { number: optionOrdinal })}. ${detail}`;
  }
  return detail;
}

type SelectableOptionPaperProps = Omit<PaperProps, "children"> & {
  radio: RadioConfig;
  node: RequirementWithStatus;
  optionsStepHideCardTitle: boolean;
  optionsStepOptionOrdinal?: number;
  children: ReactNode;
};

/** Options step: entire card is clickable; hover feedback; nested cards stopPropagation. */
function SelectableOptionPaper({
  radio,
  node,
  optionsStepHideCardTitle,
  optionsStepOptionOrdinal,
  style,
  children,
  ...paperProps
}: SelectableOptionPaperProps) {
  const [hover, setHover] = useState(false);
  const flatStyle = (style ?? {}) as CSSProperties;
  const { backgroundColor: _ignoredBg, ...restFlat } = flatStyle;
  const visualBg = radio.checked
    ? OPTION_CARD_BG_SELECTED
    : hover && !radio.disabled
      ? OPTION_CARD_HOVER_BG
      : OPTION_CARD_IDLE_BG;
  const showCircle = optionsStepOptionOrdinal != null;

  return (
    <Paper
      {...paperProps}
      withBorder={false}
      radius="var(--app-radius)"
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- rich selectable option card in a radiogroup; native <input type="radio"> can't wrap this content
      role="radio"
      aria-checked={radio.checked}
      aria-disabled={radio.disabled}
      aria-label={
        optionsStepHideCardTitle
          ? optionsStepOptionCardAriaLabel(node, optionsStepOptionOrdinal)
          : undefined
      }
      tabIndex={radio.disabled ? -1 : 0}
      onMouseEnter={() => {
        if (!radio.disabled) setHover(true);
      }}
      onMouseLeave={() => setHover(false)}
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (!radio.disabled) radio.onChange();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (radio.disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          radio.onChange();
        }
      }}
      style={{
        ...restFlat,
        backgroundColor: visualBg,
        cursor: radio.disabled ? undefined : "pointer",
        borderWidth: "var(--app-border-width)",
        borderStyle: "solid",
        borderColor: radio.checked ? OPTION_CARD_BORDER_SELECTED : OPTION_CARD_BORDER_UNSELECTED,
        transition: "var(--app-transition)",
        boxShadow: hover && !radio.disabled && !radio.checked ? "var(--app-shadow-sm)" : undefined,
      }}
    >
      {showCircle ? (
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <NumberCircle number={optionsStepOptionOrdinal!} selected={radio.checked} />
          <Box style={{ minWidth: 0, flex: 1 }}>{children}</Box>
        </Group>
      ) : (
        children
      )}
    </Paper>
  );
}

/**
 * Read-only renderer for the Program options step. Mirrors a requirement
 * subtree without any assignment / constrain machinery (no course dropdown,
 * no cache), and optionally renders the node as a selectable radio card.
 *
 * Nested children render via this component too (never via RequirementNode):
 * the Program options step and the Assign / Constrain steps share no rendering.
 */
export function OptionRequirementPreview({
  node: rawNode,
  activeBranch,
  depth = 0,
  radio,
  optionsStepHideCardTitle = false,
  optionsStepOptionOrdinal,
}: OptionRequirementPreviewProps) {
  // When a parent (option) owns the selection, keep it but still reduce nested
  // single-child wrappers inside it.
  const radioSafeMerge = (() => {
    if (!radio) return null;
    if (!rawNode.options || rawNode.options.length !== 1) return null;
    const onlyChild = rawNode.options[0];
    if (!onlyChild?.options || onlyChild.options.length === 0) return null;

    const parentTitle = (rawNode.title ?? "").trim();
    const childTitle = getNodeDisplayTitle(onlyChild);
    const mergedTitle =
      parentTitle && childTitle
        ? `${parentTitle}${parentTitle.endsWith(":") ? " " : ": "}${childTitle}`
        : parentTitle || childTitle || rawNode.code || `${rawNode.type} requirement`;

    const merged: RequirementWithStatus = {
      ...onlyChild,
      title: mergedTitle,
      complete: rawNode.complete && onlyChild.complete,
      satisfiedBy: rawNode.satisfiedBy.length ? rawNode.satisfiedBy : onlyChild.satisfiedBy,
    };
    return merged;
  })();

  const node = radioSafeMerge ?? (radio ? rawNode : simplifySingleChildChain(rawNode).node);

  const hasOptions = node.options && node.options.length > 0;
  const rawTitle = (node.title ?? "").trim();
  const title = rawTitle || node.code || `${node.type} requirement`;
  const isOrGroup = node.type === "or_group";
  const isOptionsGroup = node.type === "options_group";
  const isAnd = node.type === "and";
  const isSection = node.type === "section";

  const creditsNeeded = node.creditsNeeded ?? 0;
  const hasRequirementId = node.requirementId != null;
  const showAsComplete = node.complete && node.satisfiedBy.length > 0;
  const creditsRemaining = creditsNeeded;

  if (isSection) {
    return (
      <Text fw={600} size="sm" c="dimmed" mt={depth > 0 ? "md" : 0} mb="xs">
        {title}
      </Text>
    );
  }

  // Compact read-only "Complete" card for tree-matched leaves (no dropdown).
  if (node.complete && node.satisfiedBy.length > 0 && !hasOptions) {
    return (
      <Paper
        p="sm"
        withBorder
        radius="var(--app-radius)"
        mt="xs"
        style={{
          paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX,
          backgroundColor: "var(--app-bg)",
        }}
      >
        <Group gap="xs" wrap="nowrap" align="center">
          <Tooltip label={title} multiline maw={320} withArrow disabled={!title}>
            <Text size="sm" c="dimmed" lineClamp={1} style={TITLE_FLEX}>
              {title}
            </Text>
          </Tooltip>
          <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
            {[...new Set(node.satisfiedBy)].sort().join(", ")}
          </Text>
          <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
            Complete
          </Badge>
        </Group>
      </Paper>
    );
  }

  if ((isOrGroup || isOptionsGroup) && hasOptions) {
    const selectedOptionIndex = node.satisfiedOptionIndex;
    const showError =
      activeBranch && node.requirementId != null && selectedOptionIndex == null && !node.complete;

    const useGenericLabel = isOrGroup && (rawTitle === "" || rawTitle.toLowerCase() === "or");
    const groupLabel = useGenericLabel ? "One of the following must be completed" : title;

    const groupBody = (
      <>
        {radio && !optionsStepHideCardTitle && (
          <Group justify="space-between" align="center" wrap="nowrap" mb={4}>
            <Text fw={500} size="sm" lh={1.25} style={{ minWidth: 0 }}>
              {groupLabel}
            </Text>
            {node.complete && (
              <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
                Complete
              </Badge>
            )}
          </Group>
        )}
        {showError && (
          <Text size="xs" c="red" mt={4}>
            {tr("optionsDrilldown.selectOneError")}
          </Text>
        )}
        {node.complete && node.satisfiedOptionIndex != null && (
          <Text size="xs" c="dimmed" mb="xs">
            {tr("requirementNode.satisfiedBy", { courses: node.satisfiedBy.join(", ") })}
          </Text>
        )}
        <Stack gap="xs">
          {node.options!.map((opt, idx) => {
            const isSatisfiedOption = node.satisfiedOptionIndex === idx && opt.complete;
            const childActiveBranch =
              activeBranch &&
              (!node.requirementId || selectedOptionIndex == null || selectedOptionIndex === idx);
            const childKey = getStableNodeKey(
              opt,
              `${getStableNodeKey(node, "parent")}:opt:${idx}`,
            );
            const summaryLine = !optionsStepHideCardTitle
              ? getOptionSecondarySummaryLine(opt)
              : null;
            return (
              <Box key={childKey}>
                {summaryLine && (
                  <Text size="xs" c="dimmed" mb={4}>
                    {summaryLine}
                  </Text>
                )}
                <OptionRequirementPreview
                  node={opt}
                  activeBranch={childActiveBranch}
                  depth={depth + 1}
                  optionsStepHideCardTitle={optionsStepHideCardTitle}
                />
                {isSatisfiedOption && opt.satisfiedBy.length > 0 && (
                  <Box pl="sm" mt={4}>
                    <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
                      {tr("requirementNode.satisfiedBy", { courses: opt.satisfiedBy.join(", ") })}
                    </Badge>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </>
    );

    if (radio) {
      return (
        <SelectableOptionPaper
          radio={radio}
          node={node}
          optionsStepHideCardTitle={optionsStepHideCardTitle}
          optionsStepOptionOrdinal={optionsStepOptionOrdinal}
          p="sm"
          mt="xs"
          data-missing-selection={showError ? "true" : undefined}
          style={{ paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX }}
        >
          {groupBody}
        </SelectableOptionPaper>
      );
    }

    return (
      <Paper
        p="sm"
        withBorder
        radius="var(--app-radius)"
        mt="xs"
        data-missing-selection={showError ? "true" : undefined}
        style={{
          paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX,
          backgroundColor: "var(--app-surface)",
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap" mb={0}>
          <Text fw={500} size="sm" lh={1.25} style={TITLE_FLEX}>
            {groupLabel}
          </Text>
          {node.complete && (
            <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
              Complete
            </Badge>
          )}
        </Group>
        {groupBody}
      </Paper>
    );
  }

  if (isAnd && hasOptions) {
    const andChildren = (
      <Stack gap="xs">
        {node.options!.map((child, idx) => {
          const childKey = getStableNodeKey(
            child,
            `${getStableNodeKey(node, "parent")}:child:${idx}`,
          );
          return (
            <OptionRequirementPreview
              key={childKey}
              node={child}
              activeBranch={activeBranch}
              depth={depth + 1}
              optionsStepHideCardTitle={optionsStepHideCardTitle}
            />
          );
        })}
      </Stack>
    );

    if (radio) {
      return (
        <SelectableOptionPaper
          radio={radio}
          node={node}
          optionsStepHideCardTitle={optionsStepHideCardTitle}
          optionsStepOptionOrdinal={optionsStepOptionOrdinal}
          p="sm"
          mt="xs"
          style={{ paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX }}
        >
          {title && !optionsStepHideCardTitle && (
            <Group justify="space-between" align="center" wrap="nowrap" mb={4}>
              <Text fw={500} size="sm" lh={1.25} style={{ minWidth: 0 }}>
                {title}
              </Text>
              {node.complete && (
                <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
                  Complete
                </Badge>
              )}
            </Group>
          )}
          {andChildren}
        </SelectableOptionPaper>
      );
    }

    return (
      <Paper
        p="sm"
        withBorder
        radius="var(--app-radius)"
        mt="xs"
        style={{
          paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX,
          backgroundColor: "var(--app-surface)",
        }}
      >
        {title && (
          <Group justify="space-between" align="center" wrap="nowrap" mb={0}>
            <Text fw={500} size="sm" lh={1.25} style={TITLE_FLEX}>
              {title}
            </Text>
            {node.complete && (
              <Badge color="green" variant="light" size="sm" style={BADGE_NO_SHRINK}>
                Complete
              </Badge>
            )}
          </Group>
        )}
        {andChildren}
      </Paper>
    );
  }

  // Leaf / pick / group.
  const label =
    creditsNeeded > 0 && !showAsComplete
      ? `${title} (${creditsRemaining} credit${creditsRemaining !== 1 ? "s" : ""} needed)`
      : title;

  const pickChildren =
    hasOptions && (node.type === "pick" || node.type === "group") ? (
      <Stack gap="xs" pl="xs">
        {node.options!.map((child, idx) => {
          const childKey = getStableNodeKey(
            child,
            `${getStableNodeKey(node, "parent")}:child:${idx}`,
          );
          return (
            <OptionRequirementPreview
              key={childKey}
              node={child}
              activeBranch={activeBranch}
              depth={depth + 1}
              optionsStepHideCardTitle={optionsStepHideCardTitle}
            />
          );
        })}
      </Stack>
    ) : null;

  const primaryText = !optionsStepHideCardTitle ? (
    <Tooltip label={label} multiline maw={320} withArrow disabled={!label}>
      <Text fw={500} size="sm" lh={1.3} lineClamp={2} style={{ minWidth: 0, flex: 1 }}>
        {label}
      </Text>
    </Tooltip>
  ) : (
    (() => {
      const line = getOptionSecondarySummaryLine(node);
      if (line) {
        return (
          <Text size="xs" c="dimmed" lh={1.35} style={{ minWidth: 0, flex: 1 }}>
            {line}
          </Text>
        );
      }
      if (hasRequirementId && creditsRemaining > 0) {
        return (
          <Text size="xs" c="dimmed" style={{ minWidth: 0, flex: 1 }}>
            {creditsRemaining} credit{creditsRemaining !== 1 ? "s" : ""} needed
          </Text>
        );
      }
      return (
        <Text size="xs" c="dimmed" style={{ minWidth: 0, flex: 1 }}>
          Tap to select
        </Text>
      );
    })()
  );

  const paperBg = optionsStepHideCardTitle ? "var(--app-bg)" : "var(--app-surface)";

  if (radio) {
    return (
      <SelectableOptionPaper
        radio={radio}
        node={node}
        optionsStepHideCardTitle={optionsStepHideCardTitle}
        optionsStepOptionOrdinal={optionsStepOptionOrdinal}
        p="sm"
        mt="xs"
        style={{
          paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX,
          backgroundColor: hasOptions ? paperBg : "var(--app-bg)",
        }}
      >
        <Stack gap="xs">
          <Group
            justify="space-between"
            wrap="nowrap"
            align="flex-start"
            gap="xs"
            style={{ width: "100%" }}
          >
            {primaryText}
          </Group>
          {pickChildren}
        </Stack>
      </SelectableOptionPaper>
    );
  }

  return (
    <Paper
      p="sm"
      withBorder
      radius="var(--app-radius)"
      mt="xs"
      style={{
        paddingLeft: depth * REQUIREMENT_INDENT_PX + REQUIREMENT_BASE_PADDING_PX,
        backgroundColor: hasOptions ? "var(--app-surface)" : "var(--app-bg)",
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="xs" align="flex-start" style={TITLE_FLEX}>
            <Tooltip label={label} multiline maw={320} withArrow disabled={!label}>
              <Text fw={500} size="sm" lh={1.3} lineClamp={2} style={{ minWidth: 0 }}>
                {label}
              </Text>
            </Tooltip>
          </Group>
        </Group>
        {pickChildren}
      </Stack>
    </Paper>
  );
}
