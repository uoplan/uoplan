import { Box, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import type { Term } from "@uoplan/schedule";

interface TermPickerProps {
  terms: Term[];
  value: string | null;
  onChange: (termId: string) => void;
}

export function TermPicker({ terms, value, onChange }: TermPickerProps) {
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
              backgroundColor: selected ? "rgba(81, 207, 102, 0.06)" : "transparent",
              borderBottom: isLast ? "none" : "1px solid #2C2E33",
              transition: "background-color 140ms ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!selected) e.currentTarget.style.backgroundColor = "#1C1D20";
            }}
            onMouseLeave={(e) => {
              if (!selected) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Text size="sm" c={selected ? "#F8F9FA" : "#CED4DA"} fw={selected ? 600 : 500}>
              {term.name}
            </Text>
            {selected ? (
              <Box
                aria-hidden="true"
                style={{
                  color: "#51cf66",
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
