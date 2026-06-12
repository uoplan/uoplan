import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import type { TrendsSearch } from "../../lib/trends/searchParams";
import { TrendsFilterProvider } from "./TrendsFilterProvider";
import { useTrends } from "./trendsContext";

/**
 * Fires the given `update` calls back-to-back on mount, mimicking a user
 * toggling two filters faster than the router commits the first navigation (the
 * `search` prop is still stale on the second call).
 */
function RapidUpdater({ patches }: { patches: Partial<TrendsSearch>[] }) {
  const { update } = useTrends();
  useEffect(() => {
    for (const patch of patches) update(patch);
    // oxlint-disable-next-line react/exhaustive-deps -- mount-only: fire the burst exactly once
  }, []);
  return null;
}

describe("TrendsFilterProvider rapid filter changes", () => {
  it("accumulates successive update() calls instead of dropping earlier ones", async () => {
    const onChange = vi.fn();
    // `onChange` intentionally does NOT update the `search` prop, simulating the
    // window before the router commits the navigation.
    await renderWithProviders(
      <TrendsFilterProvider search={{}} onChange={onChange}>
        <RapidUpdater patches={[{ level: 1000 }, { season: "fall" }]} />
      </TrendsFilterProvider>,
    );

    expect(onChange).toHaveBeenCalledTimes(2);
    const last = onChange.mock.calls.at(-1)?.[0] as TrendsSearch;
    expect(last).toEqual({ level: 1000, season: "fall" });
  });
});
