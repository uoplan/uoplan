/**
 * Shared accumulator for encoding program-requirement course-code references into
 * the protobuf `course_codes` / `extra_codes` layout.
 *
 * Requirement codes reference the primary course-code dictionary by a 1-based
 * index. Codes absent from that dictionary (e.g. cross-year references) are
 * appended to a small `extra_codes` list and referenced past `dictLength`.
 *
 * Both the typed-domain encoder (`toProtoCatalogue`) and the scraper's loose-JSON
 * encoder (`mapCatalogue`) share this exact logic; only the surrounding dictionary
 * lookup and normalization differ, so each caller normalizes with its own helper
 * and passes the result in.
 */
export type ExtraCodeAccumulator = {
  /** Codes absent from the primary dictionary, in append (reference) order. */
  readonly extraCodes: string[];
  /**
   * Resolve an already-normalized code to a 1-based proto code ref: `dictIndex + 1`
   * when present in the primary dictionary, otherwise an index past `dictLength`
   * into `extraCodes` (appending on first sight).
   */
  resolve: (normalized: string, dictIndex: number | undefined, dictLength: number) => number;
};

export function createExtraCodeAccumulator(): ExtraCodeAccumulator {
  const extraCodes: string[] = [];
  const extraIndexByCode = new Map<string, number>();
  return {
    extraCodes,
    resolve(normalized, dictIndex, dictLength) {
      if (dictIndex !== undefined) return dictIndex + 1;
      let extra = extraIndexByCode.get(normalized);
      if (extra === undefined) {
        extra = extraCodes.length;
        extraCodes.push(normalized);
        extraIndexByCode.set(normalized, extra);
      }
      return dictLength + extra + 1;
    },
  };
}
