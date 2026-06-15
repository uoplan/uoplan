//! C-ABI binding over [`EngineCore`] for the native iOS/Android apps.
//!
//! The engine is the single source of truth for schedule generation. The web app
//! and OG-image worker run it as WASM (see the `Engine` `wasm_bindgen` wrapper in
//! `lib.rs`); the native apps link this crate as a **static library** and call the
//! functions below through a thin Swift/Kotlin Expo module. The whole surface is
//! bytes-in / bytes-out (protobuf), so the FFI boundary stays trivial and the
//! generated timetables are byte-for-byte identical to the web app.
//!
//! Excluded from the WASM build (`cfg(not(target_arch = "wasm32"))`) so it never
//! affects the web bundle.
#![cfg(not(target_arch = "wasm32"))]

use crate::EngineCore;
use std::os::raw::c_void;
use std::ptr;
use std::slice;

/// Construct an engine from the encoded `Catalogue` + `SchedulesData` protobufs.
///
/// Returns an opaque handle that must be released with [`uoplan_engine_free`], or
/// a null pointer if either dataset fails to decode.
///
/// # Safety
/// `catalogue_ptr`/`schedules_ptr` must point to at least `catalogue_len` /
/// `schedules_len` readable bytes (or be null, in which case null is returned).
#[no_mangle]
pub unsafe extern "C" fn uoplan_engine_new(
    catalogue_ptr: *const u8,
    catalogue_len: usize,
    schedules_ptr: *const u8,
    schedules_len: usize,
) -> *mut c_void {
    if catalogue_ptr.is_null() || schedules_ptr.is_null() {
        return ptr::null_mut();
    }
    let catalogue = slice::from_raw_parts(catalogue_ptr, catalogue_len);
    let schedules = slice::from_raw_parts(schedules_ptr, schedules_len);
    match EngineCore::new(catalogue, schedules) {
        Ok(core) => Box::into_raw(Box::new(core)).cast::<c_void>(),
        Err(_) => ptr::null_mut(),
    }
}

/// Generate a schedule for the serialized `GenerationRequest` at
/// `request_ptr`/`request_len`. On success, writes the response length to
/// `out_len` and returns a heap buffer (free with [`uoplan_engine_free_buf`]). On
/// any error returns null and sets `*out_len = 0`.
///
/// # Safety
/// `handle` must be a pointer returned by [`uoplan_engine_new`] that has not been
/// freed; `request_ptr` must be readable for `request_len` bytes; `out_len` must
/// be a valid writable pointer.
#[no_mangle]
pub unsafe extern "C" fn uoplan_engine_generate(
    handle: *mut c_void,
    request_ptr: *const u8,
    request_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    run(handle, request_ptr, request_len, out_len, |core, req| {
        core.generate(req)
    })
}

/// Re-timetable a FIXED set of courses (the UI swap feature) for the serialized
/// `TimetableRequest`. Same contract as [`uoplan_engine_generate`].
///
/// # Safety
/// See [`uoplan_engine_generate`].
#[no_mangle]
pub unsafe extern "C" fn uoplan_engine_timetable_fixed_set(
    handle: *mut c_void,
    request_ptr: *const u8,
    request_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    run(handle, request_ptr, request_len, out_len, |core, req| {
        core.timetable_fixed_set(req)
    })
}

/// Free a buffer returned by [`uoplan_engine_generate`] /
/// [`uoplan_engine_timetable_fixed_set`].
///
/// # Safety
/// `ptr`/`len` must be exactly the values returned by a previous call (or null).
#[no_mangle]
pub unsafe extern "C" fn uoplan_engine_free_buf(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 {
        // The buffer was handed out as a `Box<[u8]>` (see `run`), so reclaim it as
        // one rather than a `Vec`.
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
    }
}

/// Release an engine handle returned by [`uoplan_engine_new`].
///
/// # Safety
/// `handle` must be a pointer returned by [`uoplan_engine_new`] that has not
/// already been freed (or null).
#[no_mangle]
pub unsafe extern "C" fn uoplan_engine_free(handle: *mut c_void) {
    if !handle.is_null() {
        drop(Box::from_raw(handle.cast::<EngineCore>()));
    }
}

/// Shared body for the bytes-in/bytes-out engine calls.
unsafe fn run(
    handle: *mut c_void,
    request_ptr: *const u8,
    request_len: usize,
    out_len: *mut usize,
    op: impl FnOnce(&EngineCore, &[u8]) -> Result<Vec<u8>, crate::EngineError>,
) -> *mut u8 {
    if !out_len.is_null() {
        *out_len = 0;
    }
    if handle.is_null() || request_ptr.is_null() || out_len.is_null() {
        return ptr::null_mut();
    }
    let core = &*handle.cast::<EngineCore>();
    let request = slice::from_raw_parts(request_ptr, request_len);
    match op(core, request) {
        Ok(bytes) => {
            // Hand ownership of a tightly-sized allocation to the caller; it is
            // reclaimed via `uoplan_engine_free_buf(ptr, len)`.
            let boxed = bytes.into_boxed_slice();
            let len = boxed.len();
            *out_len = len;
            Box::into_raw(boxed).cast::<u8>()
        }
        Err(_) => ptr::null_mut(),
    }
}
