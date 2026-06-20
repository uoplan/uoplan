import { useEffect, useRef, useState } from "react";
import { Box, Group, Paper, Popover, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { minutesToTime24 } from "@uoplan/core";
import { tr } from "../../../i18n";
import classes from "./TimeRangeSelect.module.css";

const STEP_MINUTES = 15;
const OPTION_MIN_MINUTES = 6 * 60; // 06:00
const OPTION_MAX_MINUTES = 23 * 60; // 23:00

/** 15-minute option grid, always including the current value even if off-grid. */
function buildOptions(current: number): number[] {
  const set = new Set<number>();
  for (let m = OPTION_MIN_MINUTES; m <= OPTION_MAX_MINUTES; m += STEP_MINUTES) set.add(m);
  set.add(Math.max(0, Math.min(24 * 60, current)));
  return [...set].sort((a, b) => a - b);
}

interface TimeSelectProps {
  value: number;
  onChange: (minutes: number) => void;
  ariaLabel: string;
}

/** A single time field: a custom input-styled trigger opening a scrollable 15-minute list. */
function TimeSelect({ value, onChange, ariaLabel }: TimeSelectProps) {
  const [opened, setOpened] = useState(false);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const options = buildOptions(value);

  // Scroll the selected option into view each time the dropdown opens.
  useEffect(() => {
    if (opened) activeRef.current?.scrollIntoView({ block: "center" });
  }, [opened]);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      withinPortal
      radius="md"
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <UnstyledButton
          className={classes.trigger}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={opened}
          onClick={() => setOpened((o) => !o)}
        >
          <IconClock size={15} aria-hidden className={classes.triggerIcon} />
          <span className={classes.triggerValue}>{minutesToTime24(value)}</span>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p={4}>
        <ScrollArea.Autosize mah={220} type="auto">
          <Box
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom popover listbox of time options, not a native <select>
            role="listbox"
            aria-label={ariaLabel}
            className={classes.optionList}
          >
            {options.map((minutes) => {
              const selected = minutes === value;
              return (
                <UnstyledButton
                  key={minutes}
                  ref={selected ? activeRef : undefined}
                  component="button"
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom listbox option, not a native <option>
                  role="option"
                  tabIndex={selected ? 0 : -1}
                  aria-selected={selected}
                  className={classes.option}
                  data-selected={selected || undefined}
                  onClick={() => {
                    onChange(minutes);
                    setOpened(false);
                  }}
                >
                  {minutesToTime24(minutes)}
                </UnstyledButton>
              );
            })}
          </Box>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

export interface TimeRangeSelectProps {
  minStartMinutes: number;
  maxEndMinutes: number;
  onMinStartMinutesChange: (minutes: number) => void;
  onMaxEndMinutesChange: (minutes: number) => void;
}

/** "Class times between X and Y" using custom popover pickers instead of the native time input. */
export function TimeRangeSelect({
  minStartMinutes,
  maxEndMinutes,
  onMinStartMinutesChange,
  onMaxEndMinutesChange,
}: TimeRangeSelectProps) {
  return (
    <Paper withBorder radius="md" p="sm" style={{ backgroundColor: "var(--app-surface-sunken)" }}>
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {tr("scheduleCount.time.rangeLabel")}
        </Text>
        <Group gap="xs" wrap="nowrap" align="center">
          <Box style={{ flex: 1 }}>
            <TimeSelect
              value={minStartMinutes}
              onChange={onMinStartMinutesChange}
              ariaLabel={tr("scheduleCount.time.earliest")}
            />
          </Box>
          <Text size="sm" c="dimmed">
            {tr("scheduleCount.time.and")}
          </Text>
          <Box style={{ flex: 1 }}>
            <TimeSelect
              value={maxEndMinutes}
              onChange={onMaxEndMinutesChange}
              ariaLabel={tr("scheduleCount.time.latest")}
            />
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
}
