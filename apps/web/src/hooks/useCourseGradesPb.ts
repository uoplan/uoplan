import { useEffect, useState } from "react";
import type { CourseGradesData } from "schedule";
import { DataProto, fromProtoCourseGradesData } from "schedule";

export function useCourseGradesPb() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CourseGradesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/grades.pb");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const decoded = DataProto.GradesData.decode(bytes);
        const next = fromProtoCourseGradesData(decoded);
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "Failed to load grades");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, data, error };
}
