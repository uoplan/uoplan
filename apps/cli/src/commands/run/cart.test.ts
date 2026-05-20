import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { decodePayload } from "./cart.ts";
import { SchedulePayload } from "@uoplan/schedule/src/proto/cli";

function encode(payload: SchedulePayload): string {
  const bytes = SchedulePayload.encode(payload).finish();
  return Buffer.from(bytes).toString("base64url");
}

function encodeGzipped(payload: SchedulePayload): string {
  const bytes = SchedulePayload.encode(payload).finish();
  const compressed = gzipSync(Buffer.from(bytes));
  return Buffer.from(compressed).toString("base64url");
}

const SAMPLE: SchedulePayload = {
  termId: 2251,
  courses: [{ courseCode: "CSI2110", sections: [{ component: "LEC", section: "A" }] }],
};

describe("decodePayload", () => {
  it("decodes a plain base64url payload", () => {
    const result = decodePayload(encode(SAMPLE));
    expect(result.termId).toBe(2251);
    expect(result.courses[0].courseCode).toBe("CSI2110");
  });

  it("decodes a gzip-compressed payload", () => {
    const result = decodePayload(encodeGzipped(SAMPLE));
    expect(result.termId).toBe(2251);
    expect(result.courses[0].sections[0].component).toBe("LEC");
  });

  it("strips whitespace before decoding", () => {
    const raw = encode(SAMPLE);
    const withSpaces = `  ${raw.slice(0, 10)} ${raw.slice(10)}  `;
    expect(() => decodePayload(withSpaces)).not.toThrow();
  });

  it("throws on invalid input", () => {
    expect(() => decodePayload("not-valid-base64!!!")).toThrow();
  });
});
