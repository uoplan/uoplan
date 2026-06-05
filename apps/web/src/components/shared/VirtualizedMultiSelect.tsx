import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  CloseButton,
  Combobox,
  type ComboboxItem,
  Pill,
  PillsInput,
  useCombobox,
} from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * Render the options inside a bounded, virtualized scroll area past this many
 * entries. Below it, options render inline so short lists keep native sizing.
 */
const VIRTUALIZE_THRESHOLD = 20;
/** Max height (px) of the options dropdown / virtualized viewport. */
const DROPDOWN_MAX_HEIGHT = 300;
/** Estimated option row height (px) before dynamic measurement. */
const ESTIMATED_OPTION_HEIGHT = 36;

interface VirtualizedMultiSelectProps {
  label?: ReactNode;
  placeholder?: string;
  data: ComboboxItem[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Hide already-selected values from the dropdown (matches Mantine's prop). */
  hidePickedOptions?: boolean;
  clearable?: boolean;
  /** Custom option renderer, mirrors Mantine MultiSelect's `renderOption`. */
  renderOption?: (input: { option: ComboboxItem }) => ReactNode;
  /** Custom filter, mirrors Mantine MultiSelect's `filter`. */
  filter?: (input: { options: ComboboxItem[]; search: string }) => ComboboxItem[];
  nothingFoundMessage?: ReactNode;
  /** Forwarded to the root so callers can stop click propagation. */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Accessible label for the "clear all" button (required when clearable). */
  clearAriaLabel?: string;
  /** Accessible label factory for an individual pill's remove button. */
  getRemoveAriaLabel?: (label: string) => string;
}

function defaultFilter({
  options,
  search,
}: {
  options: ComboboxItem[];
  search: string;
}): ComboboxItem[] {
  const q = search.toLowerCase().trim();
  if (!q) return options;
  return options.filter(
    (o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
  );
}

/**
 * A multi-select dropdown with the same external contract as the subset of
 * Mantine's `MultiSelect` we rely on, but with a virtualized options list so
 * requirement pools with hundreds of courses render only the visible rows.
 *
 * Built on the low-level {@link Combobox} + {@link PillsInput} primitives plus
 * `@tanstack/react-virtual`, since Mantine v9 has no built-in virtualization for
 * `Select`/`MultiSelect`. Keyboard navigation is handled manually so the active
 * option stays in sync with the virtualizer even when it is scrolled off-screen.
 */
export function VirtualizedMultiSelect({
  label,
  placeholder,
  data,
  value,
  onChange,
  hidePickedOptions = false,
  clearable = false,
  renderOption,
  filter,
  nothingFoundMessage,
  onClick,
  clearAriaLabel,
  getRemoveAriaLabel,
}: VirtualizedMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
    },
  });

  const selectedSet = useMemo(() => new Set(value), [value]);

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data) map.set(item.value, item.label);
    return map;
  }, [data]);

  const filteredOptions = useMemo(() => {
    const base = hidePickedOptions ? data.filter((o) => !selectedSet.has(o.value)) : data;
    return (filter ?? defaultFilter)({ options: base, search });
  }, [data, hidePickedOptions, selectedSet, filter, search]);

  const virtualize = filteredOptions.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => ESTIMATED_OPTION_HEIGHT,
    overscan: 8,
    getItemKey: (index) => filteredOptions[index].value,
  });

  // Keep the active index in range as the filtered list changes.
  useEffect(() => {
    setActiveIndex((i) =>
      filteredOptions.length === 0 ? 0 : Math.min(i, filteredOptions.length - 1),
    );
  }, [filteredOptions.length]);

  const submit = (optionValue: string) => {
    const option = data.find((o) => o.value === optionValue);
    if (option?.disabled) return;
    onChange(
      selectedSet.has(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
    setSearch("");
  };

  const moveActive = (delta: number) => {
    if (filteredOptions.length === 0) return;
    const next = Math.min(Math.max(activeIndex + delta, 0), filteredOptions.length - 1);
    setActiveIndex(next);
    if (virtualize) virtualizer.scrollToIndex(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (combobox.dropdownOpened) moveActive(1);
        else combobox.openDropdown();
        break;
      case "ArrowUp":
        event.preventDefault();
        if (combobox.dropdownOpened) moveActive(-1);
        else combobox.openDropdown();
        break;
      case "Enter": {
        if (!combobox.dropdownOpened) break;
        event.preventDefault();
        const option = filteredOptions[activeIndex];
        if (option) submit(option.value);
        break;
      }
      case "Backspace":
        if (search === "" && value.length > 0) {
          event.preventDefault();
          onChange(value.slice(0, -1));
        }
        break;
      case "Escape":
        combobox.closeDropdown();
        break;
      default:
        break;
    }
  };

  const pills = value.map((v) => {
    const pillLabel = labelByValue.get(v) ?? v;
    return (
      <Pill
        key={v}
        withRemoveButton
        removeButtonProps={
          getRemoveAriaLabel ? { "aria-label": getRemoveAriaLabel(pillLabel) } : undefined
        }
        onRemove={() => onChange(value.filter((x) => x !== v))}
      >
        {pillLabel}
      </Pill>
    );
  });

  const renderRow = (index: number): ReactNode => {
    const option = filteredOptions[index];
    return (
      <Combobox.Option
        value={option.value}
        key={option.value}
        active={index === activeIndex}
        disabled={option.disabled}
        onMouseOver={() => setActiveIndex(index)}
      >
        {renderOption ? renderOption({ option }) : option.label}
      </Combobox.Option>
    );
  };

  return (
    <Combobox store={combobox} onOptionSubmit={submit} withinPortal>
      <Combobox.DropdownTarget>
        <PillsInput
          label={label}
          onClick={(event) => {
            onClick?.(event);
            combobox.openDropdown();
          }}
          rightSection={
            clearable && value.length > 0 ? (
              <CloseButton
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange([]);
                  setSearch("");
                }}
                aria-label={clearAriaLabel}
              />
            ) : undefined
          }
        >
          <Pill.Group>
            {pills}
            <Combobox.EventsTarget>
              <PillsInput.Field
                value={search}
                placeholder={value.length === 0 ? placeholder : undefined}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => combobox.closeDropdown()}
                onChange={(event) => {
                  combobox.openDropdown();
                  setSearch(event.currentTarget.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          {filteredOptions.length === 0 ? (
            <Combobox.Empty>{nothingFoundMessage}</Combobox.Empty>
          ) : virtualize ? (
            <div ref={viewportRef} style={{ maxHeight: DROPDOWN_MAX_HEIGHT, overflowY: "auto" }}>
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualizer.getVirtualItems().map((virtualRow) => (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderRow(virtualRow.index)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: DROPDOWN_MAX_HEIGHT, overflowY: "auto" }}>
              {filteredOptions.map((_, index) => renderRow(index))}
            </div>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
