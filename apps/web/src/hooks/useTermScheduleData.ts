import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  DataProto,
  enrichSchedulesDataWithGrades,
  fromProtoSchedulesData,
  getGradeLookups,
  type CourseGradesData,
  type SchedulesData,
} from "@uoplan/core";
import { dataAssetIds } from "@uoplan/data";
import { useAppStore } from "../store/appStore";
import { fetchProtoBytes } from "../lib/protoFetch";

type TermScheduleState = {
  data: SchedulesData | null;
  loading: boolean;
};

/** Memoize the raw (ungraded) decode per term so revisiting a term is instant. */
const rawByTerm = new Map<number, Promise<SchedulesData>>();

function loadRawTermSchedules(termId: number): Promise<SchedulesData> {
  let promise = rawByTerm.get(termId);
  if (!promise) {
    promise = fetchProtoBytes(dataAssetIds.schedules(String(termId)))
      .then((bytes) => fromProtoSchedulesData(DataProto.SchedulesData.decode(bytes)))
      .catch((err) => {
        rawByTerm.delete(termId);
        throw err;
      });
    rawByTerm.set(termId, promise);
  }
  return promise;
}

function enrich(
  raw: SchedulesData,
  termId: number,
  courseGrades: CourseGradesData | null,
): SchedulesData {
  if (!courseGrades) return raw;
  return enrichSchedulesDataWithGrades(raw, getGradeLookups(courseGrades), termId);
}

/**
 * Lazily load a single term's schedule dataset, enriched with per-section grade
 * distributions when grade history is available (falls back to the raw decode).
 *
 * Reuses the store's already-loaded `schedulesData` when it matches the requested
 * term, and memoizes the raw decode per term to avoid refetching the `.pb`.
 */
export function useTermScheduleData(termId: number | null): TermScheduleState {
  const { courseGrades, storeSchedules, selectedTermId } = useAppStore(
    useShallow((s) => ({
      courseGrades: s.courseGrades,
      storeSchedules: s.schedulesData,
      selectedTermId: s.selectedTermId,
    })),
  );

  const storeMatch =
    termId !== null && storeSchedules != null && Number(selectedTermId) === termId
      ? storeSchedules
      : null;

  const [state, setState] = useState<TermScheduleState>(() => ({
    data: storeMatch,
    loading: termId !== null && storeMatch === null,
  }));

  useEffect(() => {
    if (termId === null) {
      setState({ data: null, loading: false });
      return;
    }
    // The store already holds the requested term (enriched there too) — reuse it.
    if (storeMatch) {
      setState({ data: storeMatch, loading: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ data: prev.data, loading: true }));
    loadRawTermSchedules(termId)
      .then((raw) => {
        if (cancelled) return;
        setState({ data: enrich(raw, termId, courseGrades), loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ data: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [termId, storeMatch, courseGrades]);

  return state;
}
