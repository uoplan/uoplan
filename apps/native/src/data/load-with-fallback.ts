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
  /**
   * Builds the app from protobuf bytes bundled inside the native binary. Returning
   * `null` means the bundle does not contain enough assets for this request.
   */
  buildBundled?(this: void): Promise<TData | null>;
  /** Equality used to skip a guaranteed-identical fallback rebuild. Defaults to `Object.is`. */
  sameManifest?(this: void, a: TManifest, b: TManifest): boolean;
  /** Invoked when fresh data fails to decode and the known-good snapshot is served instead. */
  onFallback?(this: void, error: unknown): void;
  /** Invoked when the final bundled-data safety net is served instead. */
  onBundledFallback?(this: void, error: unknown): void;
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
 *    fresh manifest (so the rebuild would fail the same way), try the bundled
 *    protobuf assets baked into the app binary.
 * 4. If the bundle is incomplete/unavailable too, rethrow the original failure —
 *    it best describes the live/cache path that broke.
 */
export async function loadAppDataWithFallback<TManifest, TData>(
  deps: LoadWithFallbackDeps<TManifest, TData>,
): Promise<TData> {
  const {
    loadManifest,
    build,
    readKnownGood,
    writeKnownGood,
    buildBundled,
    sameManifest,
    onFallback,
    onBundledFallback,
  } = deps;
  const same = sameManifest ?? ((a: TManifest, b: TManifest) => Object.is(a, b));

  const tryBundled = async (primaryError: unknown): Promise<TData> => {
    let bundled: TData | null;
    try {
      bundled = buildBundled ? await buildBundled() : null;
    } catch {
      throw primaryError;
    }
    if (bundled === null) throw primaryError;
    onBundledFallback?.(primaryError);
    return bundled;
  };

  let fresh: TManifest;
  try {
    fresh = await loadManifest();
  } catch (manifestError) {
    const knownGood = await readKnownGood();
    if (knownGood !== null) {
      try {
        const data = await build(knownGood);
        onFallback?.(manifestError);
        return data;
      } catch {
        // Fall through to the bundled safety net below.
      }
    }
    return tryBundled(manifestError);
  }

  try {
    const data = await build(fresh);
    await writeKnownGood(fresh);
    return data;
  } catch (freshError) {
    const knownGood = await readKnownGood();
    if (knownGood === null || same(knownGood, fresh)) return tryBundled(freshError);
    try {
      const data = await build(knownGood);
      onFallback?.(freshError);
      return data;
    } catch {
      // Fall through to the bundled safety net below.
    }
    return tryBundled(freshError);
  }
}
