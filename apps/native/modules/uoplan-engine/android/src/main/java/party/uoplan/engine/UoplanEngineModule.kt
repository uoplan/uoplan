package party.uoplan.engine

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Thrown when the native engine cannot be constructed or a generation call fails. */
internal class EngineException(message: String) : CodedException(message)

/**
 * Expo native module wrapping the Rust schedule-generation engine, linked from
 * `libuoplan_engine.so` (built per-ABI by `pnpm build:engine-native-ffi-android`).
 * The whole surface is bytes-in / bytes-out (protobuf `ByteArray` ↔ `Uint8Array`),
 * matching the JS `EngineBridge` contract; the same engine runs as WASM on the web
 * and through the C ABI on iOS, so generated timetables are identical.
 *
 * The `external fun`s map to the `Java_party_uoplan_engine_UoplanEngineModule_*`
 * JNI exports in `packages/engine/src/jni_android.rs`.
 */
class UoplanEngineModule : Module() {
  /** Serialises access to the (non-thread-safe) engine handle. */
  private val lock = Any()

  /** Opaque pointer to the Rust `EngineCore` (0 = none). */
  private var handle: Long = 0L

  /** The dataset (term) currently loaded, so repeated generations skip decode. */
  private var loadedKey: String? = null

  companion object {
    init {
      System.loadLibrary("uoplan_engine")
    }

    @JvmStatic external fun nativeNew(catalogue: ByteArray, schedules: ByteArray): Long

    @JvmStatic external fun nativeGenerate(handle: Long, request: ByteArray): ByteArray?

    @JvmStatic external fun nativeTimetableFixedSet(handle: Long, request: ByteArray): ByteArray?

    @JvmStatic external fun nativeFree(handle: Long)
  }

  override fun definition() = ModuleDefinition {
    Name("UoplanEngine")

    // Construct (or reuse) the engine for a dataset. Catalogue + schedules are the
    // encoded `Catalogue` / `SchedulesData` protobufs. No-op when already loaded.
    AsyncFunction("loadDataset") { key: String, catalogue: ByteArray, schedules: ByteArray ->
      synchronized(lock) {
        if (loadedKey == key && handle != 0L) {
          return@synchronized true
        }
        freeHandleLocked()
        val newHandle = nativeNew(catalogue, schedules)
        if (newHandle == 0L) {
          throw EngineException("failed to construct engine (dataset failed to decode)")
        }
        handle = newHandle
        loadedKey = key
        true
      }
    }

    // Generate a schedule for a serialized `GenerationRequest` → `GenerationResponse`.
    AsyncFunction("generate") { request: ByteArray ->
      runEngine(request) { h, req -> nativeGenerate(h, req) }
    }

    // Re-timetable a fixed set of courses for a serialized `TimetableRequest`.
    AsyncFunction("timetableFixedSet") { request: ByteArray ->
      runEngine(request) { h, req -> nativeTimetableFixedSet(h, req) }
    }

    OnDestroy {
      synchronized(lock) { freeHandleLocked() }
    }
  }

  /** Run a bytes-in/bytes-out engine call under the lock. */
  private fun runEngine(request: ByteArray, op: (Long, ByteArray) -> ByteArray?): ByteArray {
    synchronized(lock) {
      val h = handle
      if (h == 0L) {
        throw EngineException("engine not loaded; call loadDataset first")
      }
      return op(h, request) ?: throw EngineException("engine call failed")
    }
  }

  /** Release the current handle. Caller must hold `lock`. */
  private fun freeHandleLocked() {
    if (handle != 0L) {
      nativeFree(handle)
      handle = 0L
    }
    loadedKey = null
  }
}
