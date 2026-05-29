import type { ReactNode } from "react";
import type { ComboboxItem, OptionsFilter } from "@mantine/core";
import type { DataCache } from "@uoplan/core";

/** Options use label = code so selected pills show only the code; use renderOption in MultiSelect to show "code – title" in the dropdown. */
export function createCourseOptions(
  codes: string[],
  _cache: DataCache | null,
): { value: string; label: string }[] {
  return codes.map((code) => ({
    value: code,
    label: code,
  }));
}

/** Use with MultiSelect renderOption to show "code – title" in the dropdown while pills show code only. */
export function renderCourseOption(
  cache: DataCache | null,
): (input: { option: { value: string; label: string } }) => ReactNode {
  return ({ option }) => {
    const course = cache?.getCourse(option.value);
    return course?.title ? `${option.value} – ${course.title}` : option.value;
  };
}

/**
 * Build an OptionsFilter that matches a search query against both the course code
 * (option value/label) and its title from the cache, so title search keeps working
 * even though option labels only contain the code.
 */
export function createCourseOptionsFilter(cache: DataCache | null): OptionsFilter {
  return ({ options, search }) => {
    const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return (options as ComboboxItem[]).filter((option) => {
      const title = cache?.getCourse(option.value)?.title ?? "";
      const haystack = `${option.label} ${title}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  };
}
