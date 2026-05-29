import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SchedulePayload } from "@uoplan/proto/cli";

/**
 * Cross-language wire contract for `cli.proto`'s `SchedulePayload`.
 *
 * The web app encodes a `SchedulePayload` into the `uoplan run` share string;
 * the Rust CLI decodes it. This test pins the TS encode/decode behaviour to a
 * shared fixture so the two languages can't silently drift. The Rust side
 * (`apps/cli/tests/schedule_payload.rs`) asserts decode of the same fixture.
 */
const fixturePath = fileURLToPath(
  new URL("../../../proto/fixtures/cli-schedule-payload.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  base64Std: string;
  payload: SchedulePayload;
};

describe("cli SchedulePayload wire contract", () => {
  it("encodes the fixture payload to the pinned base64", () => {
    const bytes = SchedulePayload.encode(fixture.payload).finish();
    expect(Buffer.from(bytes).toString("base64")).toBe(fixture.base64Std);
  });

  it("decodes the pinned base64 back to the fixture payload", () => {
    const bytes = Buffer.from(fixture.base64Std, "base64");
    const decoded = SchedulePayload.decode(bytes);
    expect(decoded).toStrictEqual(fixture.payload);
  });
});
