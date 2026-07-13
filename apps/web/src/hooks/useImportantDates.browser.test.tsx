import { renderHook } from "vitest-browser-react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ImportantDatesData } from "@uoplan/core";
import { i18n } from "@uoplan/i18n";
import { useImportantDates } from "./useImportantDates";

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
  loadImportantDates: vi.fn<(fetchBytes: unknown, locale: string) => Promise<ImportantDatesData>>(),
  fetchProtoBytes: vi.fn<(id: string) => Promise<Uint8Array>>(),
}));

vi.mock("@uoplan/data", () => ({
  loadImportantDates: mocks.loadImportantDates,
}));

vi.mock("../lib/protoFetch", () => ({
  fetchProtoBytes: mocks.fetchProtoBytes,
}));

function makeData(locale: "en" | "fr-CA"): ImportantDatesData {
  return { locale, sourceUrl: "https://uottawa.ca/important-dates", terms: [] };
}

describe("useImportantDates", () => {
  beforeEach(() => {
    mocks.loadImportantDates.mockReset();
    mocks.fetchProtoBytes.mockReset();
    // Restore to default locale before each test (cleanup already unmounted components)
    i18n.activate("en");
  });

  afterEach(() => {
    // Ensure locale is restored for any subsequent test files
    i18n.activate("en");
  });

  test("initial en load: loading → success", async () => {
    // Use a deferred so renderHook's internal act doesn't flush the load before we observe it.
    const deferred = createDeferred<ImportantDatesData>();
    mocks.loadImportantDates.mockReturnValue(deferred.promise);

    const { result } = await renderHook(() => useImportantDates());

    // Immediately after mount, load is in-flight.
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    deferred.resolve(makeData("en"));

    await expect.poll(() => result.current.loading).toBe(false);
    expect(result.current.data).toEqual(makeData("en"));
    expect(result.current.error).toBeNull();
    expect(mocks.loadImportantDates).toHaveBeenCalledWith(expect.any(Function), "en");
  });

  test("active fr-CA locale loads fr-CA asset only", async () => {
    i18n.activate("fr-CA");
    mocks.loadImportantDates.mockResolvedValue(makeData("fr-CA"));

    const { result } = await renderHook(() => useImportantDates());

    await expect.poll(() => result.current.loading).toBe(false);
    expect(result.current.data?.locale).toBe("fr-CA");
    expect(result.current.error).toBeNull();
    // Must request fr-CA, not en
    expect(mocks.loadImportantDates).toHaveBeenCalledTimes(1);
    expect(mocks.loadImportantDates).toHaveBeenCalledWith(expect.any(Function), "fr-CA");
  });

  test("locale switch clears stale data and loads new asset", async () => {
    const frDeferred = createDeferred<ImportantDatesData>();

    mocks.loadImportantDates.mockImplementation((_fetchBytes, locale: string) => {
      if (locale === "en") return Promise.resolve(makeData("en"));
      if (locale === "fr-CA") return frDeferred.promise;
      return Promise.reject(new Error(`Unexpected locale: ${locale}`));
    });

    const { result } = await renderHook(() => useImportantDates());

    // Wait for the initial en load to complete.
    await expect.poll(() => result.current.loading).toBe(false);
    expect(result.current.data?.locale).toBe("en");

    // Switch locale — useSyncExternalStore will re-render and run the fr-CA effect.
    i18n.activate("fr-CA");

    // Poll: the effect must clear en data and enter loading state before fr-CA resolves.
    await expect.poll(() => result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    // Resolve fr-CA.
    frDeferred.resolve(makeData("fr-CA"));

    await expect.poll(() => result.current.loading).toBe(false);
    expect(result.current.data?.locale).toBe("fr-CA");
    expect(result.current.error).toBeNull();
  });

  test("stale earlier promise cannot overwrite later locale result", async () => {
    const enDeferred = createDeferred<ImportantDatesData>();
    const frDeferred = createDeferred<ImportantDatesData>();

    mocks.loadImportantDates.mockImplementation((_fetchBytes, locale: string) => {
      if (locale === "en") return enDeferred.promise;
      if (locale === "fr-CA") return frDeferred.promise;
      return Promise.reject(new Error(`Unexpected locale: ${locale}`));
    });

    const { result } = await renderHook(() => useImportantDates());

    // Switch to fr-CA before either resolves — en becomes stale.
    i18n.activate("fr-CA");

    // Wait for fr-CA effect to start.
    await expect.poll(() => mocks.loadImportantDates.mock.calls.length).toBe(2);

    // Resolve fr-CA (the current locale's request).
    frDeferred.resolve(makeData("fr-CA"));
    await expect.poll(() => result.current.data?.locale).toBe("fr-CA");

    // Now resolve the stale en promise — active=false, so it must not overwrite.
    enDeferred.resolve(makeData("en"));
    await enDeferred.promise;

    // fr-CA data must still be current.
    expect(result.current.data?.locale).toBe("fr-CA");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("failure surfaces as Error and retry succeeds", async () => {
    const loadError = new Error("Network request failed");
    const retryDeferred = createDeferred<ImportantDatesData>();

    mocks.loadImportantDates
      .mockRejectedValueOnce(loadError) // first attempt fails
      .mockReturnValueOnce(retryDeferred.promise); // retry is controlled

    const { result } = await renderHook(() => useImportantDates());

    await expect.poll(() => result.current.error).not.toBeNull();
    expect(result.current.error).toBe(loadError);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();

    // Trigger retry — the pending deferred keeps loading=true observable.
    result.current.retry();

    await expect.poll(() => result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    retryDeferred.resolve(makeData("en"));

    await expect.poll(() => result.current.loading).toBe(false);
    expect(result.current.data).toEqual(makeData("en"));
    expect(result.current.error).toBeNull();
  });

  test("non-Error rejection is normalized to an Error", async () => {
    mocks.loadImportantDates.mockRejectedValueOnce("plain string rejection");

    const { result } = await renderHook(() => useImportantDates());

    await expect.poll(() => result.current.error).not.toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("plain string rejection");
  });

  test("mismatched returned data locale is rejected with actionable Error", async () => {
    // Request fr-CA but returned data claims to be en
    i18n.activate("fr-CA");
    mocks.loadImportantDates.mockResolvedValue(makeData("en"));

    const { result } = await renderHook(() => useImportantDates());

    await expect.poll(() => result.current.error).not.toBeNull();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    // Error must identify both the expected and actual locale
    expect(result.current.error?.message).toContain("fr-CA");
    expect(result.current.error?.message).toContain("en");
  });

  test("subscribe function identity is stable: i18n.on called once per mount not per render", async () => {
    // Each retry() increments retryCount, triggering a re-render.  With an
    // inline arrow subscribe reference, React sees a new subscribe function on
    // every render and calls unsubscribe + i18n.on("change", ...) again —
    // observable churn.  With a module-scope subscribe the reference is
    // constant; React subscribes exactly once.
    const deferred = createDeferred<ImportantDatesData>();
    mocks.loadImportantDates.mockImplementation(() => deferred.promise);

    const onSpy = vi.spyOn(i18n, "on");

    const { result } = await renderHook(() => useImportantDates());

    const changeCallsAtMount = onSpy.mock.calls.filter(([ev]) => ev === "change").length;
    expect(changeCallsAtMount).toBe(1); // exactly one subscription on mount

    // Trigger a re-render by retrying (retryCount changes → new render).
    result.current.retry();
    await expect.poll(() => mocks.loadImportantDates.mock.calls.length).toBeGreaterThanOrEqual(2);

    // With a stable subscribe reference, i18n.on("change", ...) must still be
    // called exactly once — no churn from the re-render.
    const changeCallsAfterRetry = onSpy.mock.calls.filter(([ev]) => ev === "change").length;
    expect(changeCallsAfterRetry).toBe(1);

    onSpy.mockRestore();
  });

  test("unmount before resolution does not trigger post-unmount state update", async () => {
    const deferred = createDeferred<ImportantDatesData>();
    mocks.loadImportantDates.mockReturnValue(deferred.promise);

    const { result, unmount } = await renderHook(() => useImportantDates());
    expect(result.current.loading).toBe(true);

    await unmount();

    // Resolve after unmount — the active flag prevents setState; no errors thrown.
    deferred.resolve(makeData("en"));
    await deferred.promise;

    // Observable: result.current is frozen at unmount-time value (cannot update).
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });
});
