import { Box, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import type { Term } from "@uoplan/core";
import { useTr } from "../../i18n";
import { formatTermLabel } from "../../lib/term/termLabel";

interface TermPickerProps {
  terms: Term[];
  value: string | null;
  onChange: (termId: string) => void;
}

export function TermPicker({ terms, value, onChange }: TermPickerProps) {
  useTr();
  return (
    <Stack gap={0} data-tour="term-select">
      {terms.map((term, index) => {
        const selected = String(term.termId) === value;
        const isLast = index === terms.length - 1;
        return (
          <UnstyledButton
            key={term.termId}
            onClick={(e) => {
              e.stopPropagation();
              onChange(term.termId);
            }}
            aria-pressed={selected}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "14px var(--mantine-spacing-lg)",
              backgroundColor: selected ? "var(--app-info-soft)" : "transparent",
              borderBottom: isLast ? "none" : "1px solid var(--app-border)",
              transition: "var(--app-transition)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!selected) e.currentTarget.style.backgroundColor = "var(--app-surface-hover)";
            }}
            onMouseLeave={(e) => {
              if (!selected) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Text
              size="sm"
              c={selected ? "var(--app-text)" : "var(--app-text-muted)"}
              fw={selected ? 600 : 500}
            >
              {formatTermLabel(term.termId)}
            </Text>
            {selected ? (
              <Box
                aria-hidden="true"
                style={{
                  color: "var(--app-info)",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <IconCheck size={16} stroke={2.6} />
              </Box>
            ) : null}
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
