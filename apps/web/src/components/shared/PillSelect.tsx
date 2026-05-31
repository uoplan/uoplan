import type { ReactNode } from "react";
import { Combobox, useCombobox } from "@mantine/core";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import {
  applyPillHover,
  pillButtonStyle,
  pillIconStyle,
  pillLabelStyle,
  resetPillHover,
} from "./pillButtonStyle";

export interface PillSelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface PillSelectProps<T extends string> {
  options: PillSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * A select-style dropdown that keeps the shared "glass pill" trigger used by the
 * chrome controls (theme / language switchers). Built on Mantine's low-level
 * {@link Combobox} so we get proper listbox semantics, keyboard handling and
 * focus management while rendering a custom pill target and themed options.
 */
export function PillSelect<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: PillSelectProps<T>) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <Combobox
      store={combobox}
      withinPortal={false}
      onOptionSubmit={(submitted) => {
        onChange(submitted as T);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={() => combobox.toggleDropdown()}
          style={{ ...pillButtonStyle, paddingRight: 8 }}
          onMouseEnter={(e) => applyPillHover(e.currentTarget)}
          onMouseLeave={(e) => resetPillHover(e.currentTarget)}
        >
          {selected?.icon}
          <span style={pillLabelStyle}>{selected?.label}</span>
          <IconChevronDown size={14} style={pillIconStyle} aria-hidden="true" />
        </button>
      </Combobox.Target>

      <Combobox.Dropdown
        style={{
          background: "var(--app-surface)",
          border: "1px solid var(--app-border)",
          borderRadius: 12,
          padding: 4,
          minWidth: 150,
          boxShadow: "var(--app-shadow)",
        }}
      >
        <Combobox.Options style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <Combobox.Option
                key={option.value}
                value={option.value}
                active={isActive}
                className="pill-select-option"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: "var(--app-text)",
                }}
              >
                {option.icon}
                <span style={{ ...pillLabelStyle, flex: 1 }}>{option.label}</span>
                {isActive ? <IconCheck size={14} style={pillIconStyle} aria-hidden="true" /> : null}
              </Combobox.Option>
            );
          })}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
