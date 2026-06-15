import { page } from "vitest/browser";
import { expect, test } from "vitest";
import { normalizeGradeVizDistribution } from "@uoplan/core";

import { GradeDistributionHistogram } from "./GradeDistributionViz";
import { renderWithProviders } from "../../test/renderWithProviders";

const gradeViz = normalizeGradeVizDistribution({
  D: 1,
  "A+": 30,
  S: 2,
  NS: 1,
})!;

function getColumnGeometry(labelText: string) {
  const label = [...document.querySelectorAll(".cal-grade-histogram-label")].find(
    (element) => element.textContent?.trim() === labelText,
  );
  const item = label?.closest(".cal-grade-histogram-item");
  const histogram = item?.closest(".cal-grade-histogram");
  const bar = item?.querySelector(".cal-grade-histogram-bar");
  if (!item || !histogram || !bar) throw new Error(`Missing histogram column ${labelText}`);

  const histogramRect = histogram.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const hitElement = document.elementFromPoint(
    itemRect.left + itemRect.width / 2,
    histogramRect.top + 1,
  );
  return {
    histogramTop: histogramRect.top,
    itemTop: itemRect.top,
    barTop: barRect.top,
    hitColumnText: hitElement?.closest(".cal-grade-histogram-item")?.textContent?.trim() ?? "",
  };
}

test("histogram tooltip columns span the chart top without stretching their bars", async () => {
  await renderWithProviders(
    <div style={{ width: 360 }}>
      <GradeDistributionHistogram gradeViz={gradeViz} variant="default" />
    </div>,
  );

  await expect.element(page.getByText("D", { exact: true })).toBeInTheDocument();

  const shortColumn = getColumnGeometry("D");
  const snsColumn = getColumnGeometry("S/NS");

  expect(shortColumn.itemTop).toBeCloseTo(shortColumn.histogramTop, 0);
  expect(shortColumn.hitColumnText).toBe("D");
  expect(shortColumn.barTop).toBeGreaterThan(shortColumn.histogramTop + 20);

  expect(snsColumn.itemTop).toBeCloseTo(snsColumn.histogramTop, 0);
  expect(snsColumn.hitColumnText).toBe("S/NS");
  expect(snsColumn.barTop).toBeGreaterThan(snsColumn.histogramTop + 10);
});
