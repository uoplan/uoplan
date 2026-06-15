//! JNI binding over [`EngineCore`] for the native Android app.
//!
//! The engine is the single source of truth for schedule generation. The web app
//! and OG-image worker run it as WASM; the iOS app links it through the C ABI in
//! [`crate::ffi`]. Android can't call an arbitrary C ABI from Kotlin, so this
//! module exports JNI-named entry points (`Java_party_uoplan_engine_…`) directly
//! from the crate's `cdylib` (`libuoplan_engine.so`). The Kotlin Expo module
//! (`UoplanEngineModule.kt`) loads that library and declares matching
//! `external fun`s, so there is no separate C++/JNI shim.
//!
//! Like the C ABI, the surface is bytes-in / bytes-out (protobuf `byte[]`), so
//! generated timetables are byte-for-byte identical to every other platform.
//!
//! Compiled only for Android (`cfg(target_os = "android")`) so the `jni` crate
//! never reaches the WASM or iOS builds.
#![cfg(target_os = "android")]

use crate::EngineCore;
use jni::objects::{JByteArray, JClass};
use jni::sys::{jbyteArray, jlong};
use jni::JNIEnv;

/// `nativeNew(byte[] catalogue, byte[] schedules) -> long`.
///
/// Builds an engine from the encoded `Catalogue` + `SchedulesData` protobufs and
/// returns an opaque handle (a leaked `Box<EngineCore>` as a `jlong`) that must be
/// released with `nativeFree`. Returns `0` if either dataset fails to decode.
#[no_mangle]
pub extern "system" fn Java_party_uoplan_engine_UoplanEngineModule_nativeNew<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    catalogue: JByteArray<'local>,
    schedules: JByteArray<'local>,
) -> jlong {
    let Ok(catalogue) = env.convert_byte_array(&catalogue) else {
        return 0;
    };
    let Ok(schedules) = env.convert_byte_array(&schedules) else {
        return 0;
    };
    match EngineCore::new(&catalogue, &schedules) {
        Ok(core) => Box::into_raw(Box::new(core)) as jlong,
        Err(_) => 0,
    }
}

/// `nativeGenerate(long handle, byte[] request) -> byte[]`.
///
/// Generates a schedule for a serialized `GenerationRequest`; returns the
/// serialized `GenerationResponse`, or `null` on any error.
#[no_mangle]
pub extern "system" fn Java_party_uoplan_engine_UoplanEngineModule_nativeGenerate<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    request: JByteArray<'local>,
) -> jbyteArray {
    run(&mut env, handle, request, |core, req| core.generate(req))
}

/// `nativeTimetableFixedSet(long handle, byte[] request) -> byte[]`.
///
/// Re-timetables a fixed set of courses for a serialized `TimetableRequest`. Same
/// contract as `nativeGenerate`.
#[no_mangle]
pub extern "system" fn Java_party_uoplan_engine_UoplanEngineModule_nativeTimetableFixedSet<
    'local,
>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    request: JByteArray<'local>,
) -> jbyteArray {
    run(&mut env, handle, request, |core, req| {
        core.timetable_fixed_set(req)
    })
}

/// `nativeFree(long handle)` — release a handle returned by `nativeNew`.
#[no_mangle]
pub extern "system" fn Java_party_uoplan_engine_UoplanEngineModule_nativeFree<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) {
    if handle != 0 {
        // SAFETY: `handle` is a pointer previously leaked by `nativeNew` and not
        // yet freed (the Kotlin side serialises access and nulls it after).
        unsafe { drop(Box::from_raw(handle as *mut EngineCore)) };
    }
}

/// Shared body for the bytes-in/bytes-out engine calls: borrow the handle, copy
/// the request out of the JVM, run `op`, and hand the result back as a new
/// `byte[]` (or `null` on error).
fn run<'local>(
    env: &mut JNIEnv<'local>,
    handle: jlong,
    request: JByteArray<'local>,
    op: impl FnOnce(&EngineCore, &[u8]) -> Result<Vec<u8>, crate::EngineError>,
) -> jbyteArray {
    if handle == 0 {
        return std::ptr::null_mut();
    }
    // SAFETY: a non-zero `handle` is a live `EngineCore` from `nativeNew`; the
    // Kotlin side guarantees it is not freed concurrently.
    let core = unsafe { &*(handle as *const EngineCore) };
    let Ok(request) = env.convert_byte_array(&request) else {
        return std::ptr::null_mut();
    };
    match op(core, &request) {
        Ok(bytes) => match env.byte_array_from_slice(&bytes) {
            Ok(array) => array.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}
