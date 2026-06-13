/**
 * Zero-runtime branded string types for values that carry a hidden normalization
 * invariant.
 *
 * Several functions in this package return a plain `string` that is only valid
 * after a specific normalization (a canonical course code, a URL slug, a
 * matching key, …). Because the return type is just `string`, callers can't tell
 * whether a value has already been normalized, so they either defensively re-run
 * the normalizer or — worse — use a raw string as a map key and silently miss.
 *
 * A {@link Brand} tags such a value at the type level. A branded value is still a
 * `string` (so `.length`, template literals, JSX rendering, and passing it where a
 * plain `string` is expected all keep working), but a raw `string` is **not**
 * assignable to a brand. The only way to obtain a branded value is to run the
 * matching producer (which casts internally) or, at trusted boundaries, the
 * {@link unsafeBrand} escape hatch.
 *
 * Brands are purely compile-time: `Brand<T, B>` erases to `T` at runtime, so there
 * is zero runtime cost and string equality / serialization are unaffected.
 */

declare const __brand: unique symbol;

/** Tag a base type `T` with a compile-time-only brand `B`. Erases to `T` at runtime. */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Assert that a raw value already satisfies a brand's invariant, without running
 * the normalizer. Use ONLY at trusted boundaries — proto-decode edges, data the
 * scraper guarantees is already normalized, and tests. Everywhere else, obtain
 * branded values from their producer so the invariant is actually enforced.
 */
export function unsafeBrand<B extends Brand<string, string>>(value: string): B {
  return value as B;
}

/** Canonical course code, e.g. `"CSI 2101"` — produced by `normalizeCourseCode`. */
export type NormalizedCourseCode = Brand<string, "NormalizedCourseCode">;

/** URL-safe professor id (kebab-case, no diacritics) — produced by `slugifyProfessor`. */
export type ProfessorSlug = Brand<string, "ProfessorSlug">;

/** First+last merge key (`"genevieve|tellier"`) — produced by `professorMatchKey`. */
export type ProfessorMatchKey = Brand<string, "ProfessorMatchKey">;

/** Ratings/feedback matching key (trim + collapse whitespace) — produced by `normalizeProfessorName`. */
export type ProfessorNameKey = Brand<string, "ProfessorNameKey">;

/** Grades matching key (accent-stripped, lowercased) — produced by `normalizeInstructorName`. */
export type InstructorNameKey = Brand<string, "InstructorNameKey">;

/** Canonical professor display name (fullest variant; the name rendered in the UI). */
export type CanonicalProfessorName = Brand<string, "CanonicalProfessorName">;

/** Stable faculty slug (kebab-case, no diacritics, role-prefix stripped) — produced by `facultyIdFromName`. */
export type FacultyId = Brand<string, "FacultyId">;
