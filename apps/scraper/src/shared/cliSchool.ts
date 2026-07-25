import { DEFAULT_SCHOOL_ID, isSchoolId, SCHOOL_IDS } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

const allowedSchools = SCHOOL_IDS.join(", ");

export function parseSchoolArg(argv: readonly string[]): SchoolId {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--school") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for --school. Expected one of: ${allowedSchools}.`);
      }
      if (!isSchoolId(value)) {
        throw new Error(
          `Invalid --school value ${JSON.stringify(value)}. Expected one of: ${allowedSchools}.`,
        );
      }
      return value;
    }
    if (arg.startsWith("--school=")) {
      const value = arg.slice("--school=".length);
      if (!isSchoolId(value)) {
        throw new Error(
          `Invalid --school value ${JSON.stringify(value)}. Expected one of: ${allowedSchools}.`,
        );
      }
      return value;
    }
  }
  return DEFAULT_SCHOOL_ID;
}

export function stripSchoolArgs(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--school") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--school=")) continue;
    out.push(arg);
  }
  return out;
}
