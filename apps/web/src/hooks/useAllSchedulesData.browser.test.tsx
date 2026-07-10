import { render } from "vitest-browser-react";
import { describe, expect, test, vi } from "vitest";
import type { SchedulesData } from "@uoplan/core";
import { useAllSchedulesData } from "./useAllSchedulesData";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  terms: null as Array<{ termId: number }> | null,
  fetchProtoBytes: vi.fn<(assetId: string) => Promise<string>>(),
  decode: vi.fn((bytes: string) => bytes),
  fromProtoSchedulesData: vi.fn<(decoded: string) => SchedulesData>(),
}));

vi.mock("../store/appStore", () => ({
  useAppStore: (selector: (state: { terms: Array<{ termId: number }> | null }) => unknown) =>
    selector({ terms: mocks.terms }),
}));

vi.mock("../lib/protoFetch", () => ({
  fetchProtoBytes: mocks.fetchProtoBytes,
}));

vi.mock("@uoplan/data", () => ({
  dataAssetIds: {
    schedules: (termId: number) => `schedules-${termId}`,
  },
}));

vi.mock("@uoplan/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@uoplan/core")>();
  return {
    ...actual,
    DataProto: {
      ...actual.DataProto,
      SchedulesData: {
        ...actual.DataProto.SchedulesData,
        decode: mocks.decode,
      },
    },
    fromProtoSchedulesData: mocks.fromProtoSchedulesData,
  };
});

let hookResult: ReturnType<typeof useAllSchedulesData>;
function Harness() {
  hookResult = useAllSchedulesData();
  return null;
}

function makeSchedulesData(termId: string): SchedulesData {
  return { termId, schedules: [] };
}

describe("useAllSchedulesData", () => {
  test("keeps schedule loading atomic across failures and retries the same terms", async () => {
    const scheduleByAsset = new Map<string, SchedulesData>([
      ["schedules-2269", makeSchedulesData("2269")],
      ["schedules-2271", makeSchedulesData("2271")],
    ]);
    const retryDeferreds = new Map<string, Deferred<string>>([
      ["schedules-2269", createDeferred<string>()],
      ["schedules-2271", createDeferred<string>()],
    ]);
    const calls = new Map<string, number>();

    mocks.terms = [{ termId: 2269 }, { termId: 2271 }];
    mocks.fetchProtoBytes.mockReset();
    mocks.decode.mockClear();
    mocks.fromProtoSchedulesData.mockReset();
    mocks.fromProtoSchedulesData.mockImplementation((decoded) => {
      const schedule = scheduleByAsset.get(decoded);
      if (!schedule) throw new Error(`Missing schedule for ${decoded}`);
      return schedule;
    });
    mocks.fetchProtoBytes.mockImplementation((assetId) => {
      const attempt = (calls.get(assetId) ?? 0) + 1;
      calls.set(assetId, attempt);
      if (assetId === "schedules-2271" && attempt === 1) {
        return Promise.reject(new Error("term 2271 failed"));
      }
      if (attempt >= 2) {
        const deferred = retryDeferreds.get(assetId);
        if (!deferred) throw new Error(`Missing retry deferred for ${assetId}`);
        return deferred.promise;
      }
      return Promise.resolve(assetId);
    });

    await render(<Harness />);

    await expect.poll(() => hookResult.loading).toBe(false);
    expect(hookResult.data).toEqual([]);
    expect((hookResult as { error?: string | null }).error).toContain("term 2271 failed");
    expect(typeof (hookResult as { retry?: unknown }).retry).toBe("function");

    (hookResult as { retry: () => void }).retry();

    await expect.poll(() => hookResult.loading).toBe(true);
    expect(hookResult.data).toEqual([]);
    expect((hookResult as { error?: string | null }).error).toBeNull();

    retryDeferreds.get("schedules-2269")?.resolve("schedules-2269");
    retryDeferreds.get("schedules-2271")?.resolve("schedules-2271");

    await expect.poll(() => hookResult.loading).toBe(false);
    expect(hookResult.data).toEqual([makeSchedulesData("2269"), makeSchedulesData("2271")]);
    expect((hookResult as { error?: string | null }).error).toBeNull();
  });
});
