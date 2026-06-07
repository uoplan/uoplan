import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DataProto, fromProtoSchedulesData, type SchedulesData } from "@uoplan/core";
import { dataAssetIds } from "@uoplan/data";
import { useAppStore } from "../store/appStore";
import { fetchProtoBytes } from "../lib/protoFetch";

export function useAllSchedulesData(): SchedulesData[] {
  const terms = useAppStore(useShallow((s) => s.terms));
  const [allSchedules, setAllSchedules] = useState<SchedulesData[]>([]);

  useEffect(() => {
    if (!terms || terms.length === 0) return;

    let cancelled = false;
    const load = async () => {
      const results = await Promise.allSettled(
        terms.map((t) =>
          fetchProtoBytes(dataAssetIds.schedules(t.termId)).then((bytes) =>
            fromProtoSchedulesData(DataProto.SchedulesData.decode(bytes)),
          ),
        ),
      );
      if (cancelled) return;
      setAllSchedules(
        results
          .filter((r): r is PromiseFulfilledResult<SchedulesData> => r.status === "fulfilled")
          .map((r) => r.value),
      );
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [terms]);

  return allSchedules;
}
