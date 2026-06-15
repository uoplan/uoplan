import ExpoModulesCore
import UoplanEngineFFI

/// Thrown when the native engine cannot be constructed or a generation call fails.
internal final class EngineException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}

/// Expo native module wrapping the Rust schedule-generation engine (linked from
/// the `UoplanEngine.xcframework` static library). The whole surface is
/// bytes-in / bytes-out (protobuf `Uint8Array`), matching the JS `EngineBridge`
/// contract; the same engine runs as WASM on the web, so results are identical.
public final class UoplanEngineModule: Module {
  /// Serialises access to the (non-thread-safe) engine handle.
  private let lock = NSLock()
  /// Opaque pointer to the Rust `EngineCore`.
  private var handle: UnsafeMutableRawPointer?
  /// The dataset (term) currently loaded, so repeated generations skip the
  /// expensive catalogue decode.
  private var loadedKey: String?

  public func definition() -> ModuleDefinition {
    Name("UoplanEngine")

    // Construct (or reuse) the engine for a dataset. Catalogue + schedules are
    // the encoded `Catalogue` / `SchedulesData` protobufs. No-op when the same
    // dataset is already loaded.
    AsyncFunction("loadDataset") { (key: String, catalogue: Data, schedules: Data) -> Bool in
      self.lock.lock()
      defer { self.lock.unlock() }

      if self.loadedKey == key, self.handle != nil {
        return true
      }
      self.freeHandleLocked()

      let newHandle: UnsafeMutableRawPointer? = catalogue.withUnsafeBytes { catRaw in
        schedules.withUnsafeBytes { schedRaw in
          uoplan_engine_new(
            catRaw.bindMemory(to: UInt8.self).baseAddress,
            catalogue.count,
            schedRaw.bindMemory(to: UInt8.self).baseAddress,
            schedules.count
          )
        }
      }
      guard let newHandle else {
        throw EngineException("failed to construct engine (dataset failed to decode)")
      }
      self.handle = newHandle
      self.loadedKey = key
      return true
    }

    // Generate a schedule for a serialized `GenerationRequest`; returns a
    // serialized `GenerationResponse`.
    AsyncFunction("generate") { (request: Data) -> Data in
      try self.runEngine(request) { handle, ptr, len, outLen in
        uoplan_engine_generate(handle, ptr, len, outLen)
      }
    }

    // Re-timetable a fixed set of courses for a serialized `TimetableRequest`.
    AsyncFunction("timetableFixedSet") { (request: Data) -> Data in
      try self.runEngine(request) { handle, ptr, len, outLen in
        uoplan_engine_timetable_fixed_set(handle, ptr, len, outLen)
      }
    }

    OnDestroy {
      self.lock.lock()
      defer { self.lock.unlock() }
      self.freeHandleLocked()
    }
  }

  /// Run a bytes-in/bytes-out engine call under the lock, copying the result out
  /// of the Rust-owned buffer and freeing it.
  private func runEngine(
    _ request: Data,
    _ op: (UnsafeMutableRawPointer?, UnsafePointer<UInt8>?, Int, UnsafeMutablePointer<Int>?) -> UnsafeMutablePointer<UInt8>?
  ) throws -> Data {
    self.lock.lock()
    defer { self.lock.unlock() }

    guard let handle = self.handle else {
      throw EngineException("engine not loaded; call loadDataset first")
    }
    var outLen = 0
    let resultPtr: UnsafeMutablePointer<UInt8>? = request.withUnsafeBytes { reqRaw in
      op(handle, reqRaw.bindMemory(to: UInt8.self).baseAddress, request.count, &outLen)
    }
    guard let resultPtr else {
      throw EngineException("engine call failed")
    }
    let data = Data(bytes: resultPtr, count: outLen)
    uoplan_engine_free_buf(resultPtr, outLen)
    return data
  }

  /// Release the current handle. Caller must hold `lock`.
  private func freeHandleLocked() {
    if let handle = self.handle {
      uoplan_engine_free(handle)
      self.handle = nil
    }
    self.loadedKey = nil
  }
}
