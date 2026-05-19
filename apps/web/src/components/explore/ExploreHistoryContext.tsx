import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";

export type ExploreHistoryEntry = {
  to: "/explore" | "/explore/course/$course" | "/explore/professor/$legacyId";
  params?: { course: string } | { legacyId: string };
  label: string;
};

type ExploreHistoryContextValue = {
  stack: ExploreHistoryEntry[];
  push: (entry: ExploreHistoryEntry) => void;
  /** Remove the top entry. Read stack[stack.length - 1] before calling. */
  pop: () => void;
  clear: () => void;
};

const ExploreHistoryContext = createContext<ExploreHistoryContextValue>({
  stack: [],
  push: () => {},
  pop: () => {},
  clear: () => {},
});

export function ExploreHistoryProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ExploreHistoryEntry[]>([]);

  const push = useCallback((entry: ExploreHistoryEntry) => {
    setStack((prev) => [...prev, entry]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  return (
    <ExploreHistoryContext.Provider value={{ stack, push, pop, clear }}>
      {children}
    </ExploreHistoryContext.Provider>
  );
}

export function useExploreHistory() {
  return useContext(ExploreHistoryContext);
}

export function ExploreBackButton({
  entry,
  onBack,
}: {
  entry: ExploreHistoryEntry;
  onBack: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onBack}
      style={{ alignSelf: "flex-start", color: "var(--mantine-color-dimmed)" }}
    >
      <Group gap={2} wrap="nowrap">
        <IconChevronLeft size={15} stroke={1.8} />
        <Text size="sm" c="dimmed">
          {entry.label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
