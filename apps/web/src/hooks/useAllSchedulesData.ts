import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DataProto, fromProtoSchedulesData } from "@uoplan/core";
import type { SchedulesData } from "@uoplan/core";
import { dataAssetIds } from "@uoplan/data";
import { useAppStore } from "../store/appStore";
import { fetchProtoBytes } from "../lib/protoFetch";

export type UseAllSchedulesDataResult = {
  data: SchedulesData[];
  loading: boolean;
  error: string | null;
  retry: () => void;
};

type AllSchedulesLoadState = Omit<UseAllSchedulesDataResult, "retry">;

const LOADING_SCHEDULES_STATE: AllSchedulesLoadState = {
  data: [],
  loading: true,
  error: null,
};

const EMPTY_SCHEDULES_STATE: AllSchedulesLoadState = {
  data: [],
  loading: false,
  error: null,
};

function schedulesErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Failed to load schedules.";
}

export function useAllSchedulesData(): UseAllSchedulesDataResult {
  const terms = useAppStore(useShallow((s) => s.terms));
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<AllSchedulesLoadState>(LOADING_SCHEDULES_STATE);
  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!terms) {
      setResult(LOADING_SCHEDULES_STATE);
      return;
    }
    if (terms.length === 0) {
      setResult(EMPTY_SCHEDULES_STATE);
      return;
    }

    let cancelled = false;
    setResult(LOADING_SCHEDULES_STATE);

    const load = async () => {
      try {
        const data = await Promise.all(
          terms.map((t) =>
            fetchProtoBytes(dataAssetIds.schedules(t.termId)).then((bytes) =>
              fromProtoSchedulesData(DataProto.SchedulesData.decode(bytes)),
            ),
          ),
        );
        if (cancelled) return;
        setResult({ data, loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        setResult({ data: [], loading: false, error: schedulesErrorMessage(error) });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [terms, attempt]);

  return useMemo(
    () => ({
      ...result,
      retry,
    }),
    [result, retry],
  );
}
