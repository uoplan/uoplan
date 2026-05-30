export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Not found (404): ${url}`);
    this.name = "NotFoundError";
  }
}
