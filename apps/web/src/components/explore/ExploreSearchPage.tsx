import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { ExploreFacultyBrowse } from "./ExploreFacultyBrowse";
import { useTr } from "../../i18n";

export function ExploreSearchPage({ searchParams }: { searchParams: ExploreSearchParams }) {
  useTr();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ paddingInline: EXPLORE_ACCORDION_PAD_INLINE.xs, paddingBottom: 80 }}>
        <ExploreFacultyBrowse searchParams={searchParams} />
      </div>
    </div>
  );
}
