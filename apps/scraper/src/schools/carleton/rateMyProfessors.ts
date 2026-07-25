/**
 * Carleton's RateMyProfessors school id, as seen in
 * https://www.ratemyprofessors.com/school/1420
 */
export const CARLETON_RMP_SCHOOL_ID = 1420;

/**
 * Normalize a Carleton Banner instructor name to "First Last" display form.
 *
 * Carleton's Banner system sometimes emits names in "Surname, First" order and
 * can produce lowercase first tokens as a data anomaly (e.g. "smith, John").
 * Both forms must be mapped to consistent "First Last" order so that schedule
 * instructor strings match the first-name-first strings from RateMyProfessors.
 *
 * Normalization steps:
 *  1. If the name contains a comma, treat it as "Surname, First[Middle]":
 *     split, reverse, join as space-separated.
 *  2. Title-case the first letter of each token that is entirely lowercase
 *     (preserves intentional caps like "O'Brien" or "MacNeil").
 *  3. Collapse extra whitespace.
 *
 * Names already in "First Last" format (no comma) pass through unchanged except
 * for whitespace normalisation.
 */
export function normalizeCarletonInstructorName(raw: string): string {
  const trimmed = raw.trim().replaceAll(/\s+/g, " ");
  if (!trimmed) return trimmed;

  let name = trimmed;

  // "Surname, First [Middle]" → "First [Middle] Surname"
  const commaIdx = name.indexOf(",");
  if (commaIdx !== -1) {
    const surname = name.slice(0, commaIdx).trim();
    const given = name.slice(commaIdx + 1).trim();
    name = given ? `${given} ${surname}` : surname;
  }

  // Title-case any token that is entirely lowercase (data anomaly: "smith" → "Smith")
  name = name
    .split(" ")
    .map((token) => {
      if (!token) return token;
      if (token === token.toLowerCase()) {
        return token.charAt(0).toUpperCase() + token.slice(1);
      }
      return token;
    })
    .join(" ");

  return name.replaceAll(/\s+/g, " ").trim();
}
