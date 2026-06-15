import type { GradeVizBucket, GradeVizData } from "@uoplan/core/gradeDistribution";

interface GradeVizItem {
  gradeViz?: GradeVizData | null;
}

function sumBuckets(items: GradeVizData[]): GradeVizBucket[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const bucket of item.buckets) {
      counts.set(bucket.id, (counts.get(bucket.id) ?? 0) + bucket.count);
    }
  }

  return items[0]!.buckets.map((bucket) => ({
    ...bucket,
    count: counts.get(bucket.id) ?? 0,
  }));
}

function sumHistogram(items: GradeVizData[]): GradeVizData["histogram"] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const entry of item.histogram) {
      counts.set(entry.grade, (counts.get(entry.grade) ?? 0) + entry.count);
    }
  }

  return items[0]!.histogram.map((entry) => ({
    ...entry,
    count: counts.get(entry.grade) ?? 0,
  }));
}

export function aggregateGradeViz(items: readonly GradeVizItem[]): GradeVizData | null {
  const gradeVizItems = items
    .map((item) => item.gradeViz)
    .filter((gradeViz): gradeViz is GradeVizData => Boolean(gradeViz && gradeViz.total > 0));

  if (gradeVizItems.length === 0) return null;

  const buckets = sumBuckets(gradeVizItems);
  const histogram = sumHistogram(gradeVizItems);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total <= 0) return null;

  const withdrewCount = buckets.find((bucket) => bucket.id === "grey")?.count ?? 0;
  const failingCount = buckets.find((bucket) => bucket.id === "red")?.count ?? 0;
  const gradedTotal = total - withdrewCount;
  const passingPercent = gradedTotal > 0 ? ((gradedTotal - failingCount) / gradedTotal) * 100 : 0;

  return {
    total,
    gradedTotal,
    passingPercent,
    buckets,
    histogram,
  };
}
