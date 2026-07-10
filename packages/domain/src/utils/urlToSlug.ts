/** Strip the catalogue host/prefix from a program URL, leaving the path slug. */
export function urlToSlug(url: string): string {
  return url
    .replace(/^https?:\/\/catalogue\.uottawa\.ca(?:\/archive\/\d{4}-\d{4})?\/en\//, "")
    .replace(/\/$/, "");
}
