/*
 * C-ABI for the uoplan schedule-generation engine (see src/ffi.rs).
 *
 * The native iOS/Android apps link the engine as a static library and call these
 * functions through a thin Expo module. Everything is bytes-in / bytes-out
 * (protobuf), so generated timetables are byte-for-byte identical to the web app,
 * which runs the same engine compiled to WASM.
 */
#ifndef UOPLAN_ENGINE_H
#define UOPLAN_ENGINE_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Construct an engine from the encoded `Catalogue` + `SchedulesData` protobufs.
 * Returns an opaque handle (free with uoplan_engine_free), or NULL on decode
 * failure.
 */
void *uoplan_engine_new(const uint8_t *catalogue_ptr, size_t catalogue_len,
                        const uint8_t *schedules_ptr, size_t schedules_len);

/*
 * Generate a schedule for the serialized `GenerationRequest`. On success writes
 * the response length to *out_len and returns a heap buffer (free with
 * uoplan_engine_free_buf). On error returns NULL and sets *out_len = 0.
 */
uint8_t *uoplan_engine_generate(void *handle, const uint8_t *request_ptr,
                                size_t request_len, size_t *out_len);

/* Re-timetable a fixed set of courses for the serialized `TimetableRequest`. */
uint8_t *uoplan_engine_timetable_fixed_set(void *handle,
                                           const uint8_t *request_ptr,
                                           size_t request_len, size_t *out_len);

/* Free a buffer returned by generate / timetable_fixed_set. */
void uoplan_engine_free_buf(uint8_t *ptr, size_t len);

/* Release an engine handle returned by uoplan_engine_new. */
void uoplan_engine_free(void *handle);

#ifdef __cplusplus
}
#endif

#endif /* UOPLAN_ENGINE_H */
