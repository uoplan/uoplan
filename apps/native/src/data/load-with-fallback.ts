/**
 * Dependencies for {@link loadAppDataWithFallback}. All I/O is injected so the
 * orchestration logic is pure and unit-testable without the filesystem or network.
 *
 * @typeParam TManifest - the data-asset manifest shape (id → content-hashed URL).
 * @typeParam TData - the fully-built, decoded app data.
 */
export interface LoadWithFallbackDeps<TManifest, TData> {
  /** Fetches the freshest manifest (already falling back to the cached text offline). */
  loadManifest(this: void): Promise<TManifest>;
  /**
   * Downloads + decodes every asset the manifest points at into the runtime app
   * data. Rejects if any asset fails to decode (e.g. an incompatible proto format).
   */
  build(this: void, manifest: TManifest): Promise<TData>;
  /** Reads the last manifest that built successfully, or `null` if there is none yet. */
  readKnownGood(this: void): Promise<TManifest | null>;
  /** Persists a manifest as the new known-good snapshot (called only after a full build). */
  writeKnownGood(this: void, manifest: TManifest): Promise<void>;
  /** Equality used to skip a guaranteed-identical fallback rebuild. Defaults to `Object.is`. */
  sameManifest?(this: void, a: TManifest, b: TManifest): boolean;
  /** Invoked when fresh data fails to decode and the known-good snapshot is served instead. */
  onFallback?(this: void, error: unknown): void;
}

/**
 * Loads the app's data, preferring the freshest published dataset but **never
 * leaving the user with nothing** when a fresh fetch decodes into something the
 * installed app can't read (typically a proto-format change shipped ahead of an
 * app update).
 *
 * Flow:
 * 1. Load the freshest manifest and build the app data from it.
 *    - On success, record that manifest as the new known-good snapshot and return.
 * 2. If the build fails to decode, fall back to the last **known-good** manifest
 *    (whose content-hashed assets are already cached on disk, so this works
 *    offline) and build from that instead — "something rather than nothing".
 *    The failed manifest is deliberately *not* promoted to known-good.
 * 3. If there is no known-good snapshot (first launch) or it is identical to the
 *    fresh manifest (so the rebuild would fail the same way), the original decode
 *    error is rethrown — there is genuinely no data to show.
 */
export async function loadAppDataWithFallback<TManifest, TData>(
  deps: LoadWithFallbackDeps<TManifest, TData>,
): Promise<TData> {
  const { loadManifest, build, readKnownGood, writeKnownGood, sameManifest, onFallback } = deps;
  const same = sameManifest ?? ((a: TManifest, b: TManifest) => Object.is(a, b));

  const fresh = await loadManifest();
  try {
    const data = await build(fresh);
    await writeKnownGood(fresh);
    return data;
  } catch (freshError) {
    const knownGood = await readKnownGood();
    if (knownGood === null || same(knownGood, fresh)) throw freshError;
    try {
      const data = await build(knownGood);
      onFallback?.(freshError);
      return data;
    } catch {
      // Even the last-good snapshot is unreadable (e.g. its cache was evicted) —
      // surface the primary failure, which describes what actually broke.
      throw freshError;
    }
  }
}
