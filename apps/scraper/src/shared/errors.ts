export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Not found (404): ${url}`);
    this.name = "NotFoundError";
  }
}

/**
 * The site answered with an anti-bot challenge (e.g. AWS WAF `202` + empty body)
 * instead of content. Not retryable, and must never be treated as "no data".
 */
export class BotChallengeError extends Error {
  constructor(url: string) {
    super(`Blocked by bot challenge (WAF): ${url}`);
    this.name = "BotChallengeError";
  }
}
