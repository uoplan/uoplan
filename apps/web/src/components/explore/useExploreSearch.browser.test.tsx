import { render } from "vitest-browser-react";
import { describe, expect, it, vi } from "vitest";
import { useExploreSearch } from "./useExploreSearch";

// Drive the router hooks by hand so we can simulate the asynchronous,
// out-of-order URL param updates that cause the rapid-filter race.
const routerMock = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMock.navigate,
  useSearch: () => routerMock.search,
}));

let api: ReturnType<typeof useExploreSearch>;
function Harness() {
  api = useExploreSearch(true);
  return null;
}

describe("useExploreSearch rapid filter changes", () => {
  it("does not let a lagging URL param echo clobber newer local edits", async () => {
    routerMock.search = {};
    routerMock.navigate.mockClear();
    const screen = await render(<Harness />);

    // Two taps in quick succession before either navigation has updated the URL.
    api.handleFilterChange({ levels: [1000] });
    api.handleFilterChange({ levels: [1000, 2000] });
    await expect.poll(() => api.filters.levels).toEqual([1000, 2000]);

    // The FIRST navigation's params finally land — a stale echo. It must be
    // ignored, not applied over the newer [1000, 2000] selection.
    routerMock.search = { levels: "1000" };
    await screen.rerender(<Harness />);
    await expect.poll(() => api.filters.levels).toEqual([1000, 2000]);

    // The latest navigation's params land and clear the pending guard.
    routerMock.search = { levels: "1000,2000" };
    await screen.rerender(<Harness />);
    await expect.poll(() => api.filters.levels).toEqual([1000, 2000]);

    // A genuine external navigation (e.g. back button) is still adopted.
    routerMock.search = { levels: "3000" };
    await screen.rerender(<Harness />);
    await expect.poll(() => api.filters.levels).toEqual([3000]);
  });
});
