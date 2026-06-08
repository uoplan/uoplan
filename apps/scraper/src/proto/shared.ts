export function parseTermIdToNumber(termId: string): number {
  const parsed = Number.parseInt(termId, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCode(value: unknown): string {
  return (typeof value === "string" ? value : "").trim().replace(/\s+/g, " ");
}

export class CourseCodeIndexer {
  readonly courseCodes: string[] = [];
  private readonly indexByCode = new Map<string, number>();

  add(code: string): number {
    const normalized = normalizeCode(code);
    const existing = this.indexByCode.get(normalized);
    if (existing !== undefined) return existing;
    const idx = this.courseCodes.length;
    this.courseCodes.push(normalized);
    this.indexByCode.set(normalized, idx);
    return idx;
  }
}
