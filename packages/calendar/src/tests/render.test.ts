import { describe, expect, it } from "vitest";
import { renderCalendarToSvg } from "../render";
import { makeEvent, professorName } from "./fixtures";

describe("renderCalendarToSvg", () => {
  it("renders structural SVG for events with escaped text, timing, and lanes", () => {
    const svg = renderCalendarToSvg(
      [
        makeEvent({
          id: "first",
          courseCode: "CSI <2101>&",
          componentSection: "LEC - A",
          professor: professorName('Ada "Countess" & Co.'),
          startMinutes: 540,
          endMinutes: 720,
        }),
        makeEvent({
          id: "second",
          courseCode: "MAT 1320",
          componentSection: "DGD - B",
          professor: professorName("Grace Hopper"),
          startMinutes: 570,
          endMinutes: 690,
        }),
      ],
      { "CSI <2101>&": 0, "MAT 1320": 1 },
      { width: 500, height: 900 },
    );

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="900"');
    expect(svg).toContain('<rect width="500" height="900" fill="#111113"/>');
    expect(svg).toContain('width="250"');
    expect(svg).toContain("CSI &lt;2101&gt;&amp;");
    expect(svg).toContain("MAT 1320");
    expect(svg).toContain(">LEC</text>");
    expect(svg).toContain(">09:00–12:00</text>");
    expect(svg).toContain("Ada &quot;Countess&quot; &amp; Co.");
  });

  it("uses weekday columns when there are no events", () => {
    const svg = renderCalendarToSvg([], {}, { width: 1000, height: 500 });

    expect(svg).toContain('width="1000" height="500"');
    expect(svg.match(/stroke="#2c2e33"/g)?.length).toBeGreaterThan(4);
    expect(svg).not.toContain("font-size");
  });

  it("omits event blocks that would be too short to render legibly", () => {
    const svg = renderCalendarToSvg(
      [makeEvent({ courseCode: "CSI 2101", startMinutes: 480, endMinutes: 482 })],
      { "CSI 2101": 0 },
      { width: 500, height: 900 },
    );

    expect(svg).not.toContain("CSI 2101");
  });
});
