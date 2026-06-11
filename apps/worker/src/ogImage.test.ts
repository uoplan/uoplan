import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulePreview } from "@uoplan/proto/state";
import type { Env } from "./index.js";

const initWasmMock = vi.hoisted(() => vi.fn(async () => {}));
const resvgSvgInputs = vi.hoisted((): string[] => []);
const resvgMock = vi.hoisted(() =>
  vi.fn(function (this: unknown, svg: string) {
    resvgSvgInputs.push(svg);
    return {
      render: () => ({ asPng: () => new Uint8Array([137, 80, 78, 71]) }),
    };
  }),
);
const optionalMock = vi.hoisted(() => vi.fn(async () => null));
const loadSchedulesMock = vi.hoisted(() => vi.fn(async () => ({ schedules: [] })));
const loadGradesMock = vi.hoisted(() => vi.fn(async () => null));
const createAssetsTransportMock = vi.hoisted(() => vi.fn(() => ({ kind: "assets-transport" })));
const reconstructMock = vi.hoisted(() => vi.fn());
const enrichMock = vi.hoisted(() => vi.fn((schedules: unknown) => schedules));
const getGradeLookupsMock = vi.hoisted(() => vi.fn(() => ({ byCourse: new Map() })));
const renderSchedulePreviewToSvgMock = vi.hoisted(() =>
  vi.fn(() => "<svg>rendered schedule</svg>"),
);

vi.mock("@resvg/resvg-wasm", () => ({
  initWasm: initWasmMock,
  Resvg: resvgMock,
}));
vi.mock("@resvg/resvg-wasm/index_bg.wasm", () => ({ default: {} }));
vi.mock("@uoplan/data", () => ({
  optional: optionalMock,
  loadSchedules: loadSchedulesMock,
  loadGrades: loadGradesMock,
}));
vi.mock("@uoplan/data/worker", () => ({
  createAssetsTransport: createAssetsTransportMock,
}));
vi.mock("@uoplan/core", () => ({
  enrichSchedulesDataWithGrades: enrichMock,
  getGradeLookups: getGradeLookupsMock,
  reconstructScheduleFromPreview: reconstructMock,
}));
vi.mock("@uoplan/calendar", () => ({
  renderSchedulePreviewToSvg: renderSchedulePreviewToSvgMock,
}));

function makeCache(matchResponse?: Response) {
  return {
    match: vi.fn(async () => matchResponse),
    put: vi.fn(async () => {}),
  };
}

async function importHandler(cache = makeCache()) {
  vi.resetModules();
  vi.stubGlobal("caches", { default: cache });
  const mod = await import("./ogImage.js");
  return { handleOgImage: mod.handleOgImage, cache };
}

function makeEnv(): Env {
  return { ASSETS: { fetch: vi.fn() } } as unknown as Env;
}

function encodePreview(preview: Parameters<typeof SchedulePreview.encode>[0]): string {
  const bytes = SchedulePreview.encode(preview).finish();
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

beforeEach(() => {
  initWasmMock.mockClear();
  resvgMock.mockClear();
  resvgSvgInputs.length = 0;
  optionalMock.mockClear();
  loadSchedulesMock.mockClear();
  loadGradesMock.mockClear();
  createAssetsTransportMock.mockClear();
  reconstructMock.mockReset();
  enrichMock.mockClear();
  getGradeLookupsMock.mockClear();
  renderSchedulePreviewToSvgMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleOgImage", () => {
  it("returns cached images without rendering", async () => {
    const cached = new Response("cached-png", { headers: { "Content-Type": "image/png" } });
    const { handleOgImage, cache } = await importHandler(makeCache(cached));

    const res = await handleOgImage("state123", undefined, makeEnv(), "https://uoplan.party");

    expect(await res.text()).toBe("cached-png");
    expect(cache.match).toHaveBeenCalledWith(
      new Request("https://og-cache.internal/v2/nopayload/state123"),
    );
    expect(cache.put).not.toHaveBeenCalled();
    expect(initWasmMock).not.toHaveBeenCalled();
  });

  it("renders and caches the fallback PNG when no schedule payload is provided", async () => {
    const { handleOgImage, cache } = await importHandler();

    const res = await handleOgImage("state123", undefined, makeEnv(), "https://uoplan.party");
    const png = new Uint8Array(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400, s-maxage=86400");
    expect(Array.from(png.slice(0, 4))).toEqual([137, 80, 78, 71]);
    expect(resvgSvgInputs[0]).toContain("uoplan");
    expect(cache.put).toHaveBeenCalledWith(
      new Request("https://og-cache.internal/v2/nopayload/state123"),
      expect.any(Response),
    );
  });

  it("falls back without loading schedules when the payload is not valid base64/protobuf data", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handleOgImage } = await importHandler();

    const res = await handleOgImage(
      "state123",
      "not%%%protobuf",
      makeEnv(),
      "https://uoplan.party",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(loadSchedulesMock).not.toHaveBeenCalled();
    expect(resvgSvgInputs[0]).toContain("uoplan");
    expect(consoleError).toHaveBeenCalledWith("[og-image] unexpected error:", expect.any(Error));
    consoleError.mockRestore();
  });

  it("falls back for a decoded preview with no courses", async () => {
    const payload = encodePreview({ termId: 2261, courses: [] });
    const { handleOgImage } = await importHandler();

    const res = await handleOgImage("state123", payload, makeEnv(), "https://uoplan.party");

    expect(res.status).toBe(200);
    expect(loadSchedulesMock).not.toHaveBeenCalled();
    expect(resvgSvgInputs[0]).toContain("uoplan");
  });

  it("loads term data and renders the reconstructed schedule for a valid preview", async () => {
    const payload = encodePreview({
      termId: 2261,
      courses: [{ courseIndex: 0, componentIndices: [0], sectionIndices: [0] }],
    });
    const reconstructed = {
      schedule: { enrollments: [{ courseCode: "CSI 1100" }] },
      colorMap: new Map(),
    };
    reconstructMock.mockReturnValueOnce(reconstructed);
    const { handleOgImage } = await importHandler();

    const res = await handleOgImage("state123", payload, makeEnv(), "https://uoplan.party");

    expect(res.status).toBe(200);
    expect(createAssetsTransportMock).toHaveBeenCalledWith(
      expect.any(Object),
      "https://uoplan.party",
    );
    expect(loadSchedulesMock).toHaveBeenCalledWith({ kind: "assets-transport" }, "2261");
    expect(reconstructMock).toHaveBeenCalledWith(
      expect.objectContaining({ termId: 2261, courses: expect.any(Array) }),
      { schedules: [] },
    );
    expect(renderSchedulePreviewToSvgMock).toHaveBeenCalledWith(
      reconstructed.schedule,
      reconstructed.colorMap,
    );
    expect(resvgSvgInputs[0]).toBe("<svg>rendered schedule</svg>");
  });
});
