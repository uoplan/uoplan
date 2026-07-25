import { IconSchool } from "@tabler/icons-react";
import { SCHOOL_LIST } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";
import { tr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { getActiveSchool, switchSchool } from "../../lib/activeSchool";
import { AVAILABLE_SCHOOL_IDS } from "../../lib/dataAssetIndex";
import { PillSelect } from "./PillSelect";
import type { PillSelectOption } from "./PillSelect";
import { pillIconStyle } from "./pillButtonStyle";

/**
 * Global school picker.
 *
 * Selecting a school triggers a full page load at the equivalent path under
 * that school (see `switchSchool`), so this reads the active school directly
 * rather than from React state — it can never change without the document being
 * torn down and rebuilt.
 *
 * Only schools this build actually ships data for are offered, and the picker
 * hides itself entirely when there is nothing to choose between. A school can
 * sit in the registry before its scraped data has landed on the `data` branch,
 * and offering it then would hand the user a page that boots and immediately
 * fails to load a catalogue.
 */
export function SchoolSwitcher() {
  const analytics = useAnalytics();
  const active = getActiveSchool();

  const options: PillSelectOption<SchoolId>[] = SCHOOL_LIST.filter((school) =>
    AVAILABLE_SCHOOL_IDS.includes(school.id),
  ).map((school) => ({
    value: school.id,
    label: school.shortName,
    icon: <IconSchool size={14} style={pillIconStyle} />,
  }));

  if (options.length < 2) return null;

  return (
    <PillSelect
      options={options}
      value={active}
      onChange={(next) => {
        if (next === active) return;
        analytics.capture("school_changed", { school: next });
        switchSchool(next);
      }}
      ariaLabel={tr("schoolSwitcher.ariaLabel")}
    />
  );
}
