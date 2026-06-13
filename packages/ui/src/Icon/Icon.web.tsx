import type { ComponentType } from "react";

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBook,
  IconCalendar,
  IconChartBar,
  IconChartDots3,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconFilter,
  IconHeart,
  IconHome,
  IconInfoCircle,
  IconMinus,
  IconPencil,
  IconPlus,
  IconSchool,
  IconSearch,
  IconSettings,
  IconShare3,
  IconStar,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import type { IconName, IconProps } from "./Icon.types";

interface TablerIconProps {
  size?: number;
  color?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
  "data-testid"?: string;
}

const COMPONENT_FOR_ICON: Record<IconName, ComponentType<TablerIconProps>> = {
  search: IconSearch,
  calendar: IconCalendar,
  home: IconHome,
  chart: IconChartBar,
  heart: IconHeart,
  settings: IconSettings,
  user: IconUser,
  book: IconBook,
  close: IconX,
  check: IconCheck,
  chevronRight: IconChevronRight,
  chevronDown: IconChevronDown,
  chevronLeft: IconChevronLeft,
  arrowLeft: IconArrowLeft,
  plus: IconPlus,
  minus: IconMinus,
  info: IconInfoCircle,
  alert: IconAlertTriangle,
  star: IconStar,
  share: IconShare3,
  download: IconDownload,
  trash: IconTrash,
  edit: IconPencil,
  filter: IconFilter,
  clock: IconClock,
  graph: IconChartDots3,
  school: IconSchool,
};

/** Web (Mantine/Tabler) implementation of the Icon contract. */
export function Icon({ name, size = 20, color, label, testID }: IconProps) {
  const Glyph = COMPONENT_FOR_ICON[name];
  return (
    <Glyph
      size={size}
      color={color ?? "currentColor"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid={testID}
    />
  );
}
