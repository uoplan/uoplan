import { describe, expect, it } from "vitest";

import { parseSearchForm, parseSearchPostFields } from "./parseSearchFields.ts";
import { readFixture } from "./testUtils.ts";

describe("parseSearchForm", () => {
  it("extracts the POST action and every hidden field in form order", () => {
    const result = parseSearchForm(readFixture("search-fields.202630.html"));

    expect(result.action).toBe("bwysched.p_course_search");
    expect(result.hiddenFields.slice(0, 4)).toEqual([
      ["wsea_code", "EXT"],
      ["term_code", "202630"],
      ["session_id", "26061541"],
      ["ws_numb", ""],
    ]);
    expect(result.hiddenFields).toContainEqual(["sel_subj", "dummy"]);
    expect(result.hiddenFields).toContainEqual(["sel_begin_am_pm", "dummy"]);
    expect(result.hiddenFields).toContainEqual(["block_button", ""]);
    expect(result.hiddenFields.map(([name]) => name)).toHaveLength(26);
  });
});

describe("parseSearchPostFields", () => {
  it("extracts browser-successful controls in form submission order", () => {
    const fields = parseSearchPostFields(readFixture("search-fields.202630.html"));

    expect(fields.slice(0, 24)).toEqual([
      ["wsea_code", "EXT"],
      ["term_code", "202630"],
      ["session_id", "26061541"],
      ["ws_numb", ""],
      ["sel_aud", "dummy"],
      ["sel_subj", "dummy"],
      ["sel_camp", "dummy"],
      ["sel_sess", "dummy"],
      ["sel_attr", "dummy"],
      ["sel_levl", "dummy"],
      ["sel_schd", "dummy"],
      ["sel_insm", "dummy"],
      ["sel_link", "dummy"],
      ["sel_wait", "dummy"],
      ["sel_day", "dummy"],
      ["sel_begin_hh", "dummy"],
      ["sel_begin_mi", "dummy"],
      ["sel_begin_am_pm", "dummy"],
      ["sel_end_hh", "dummy"],
      ["sel_end_mi", "dummy"],
      ["sel_end_am_pm", "dummy"],
      ["sel_instruct", "dummy"],
      ["sel_special", "dummy"],
      ["sel_resd", "dummy"],
    ]);
    expect(fields).toContainEqual(["sel_levl", ""]);
    expect(fields).toContainEqual(["sel_subj", ""]);
    expect(fields).toContainEqual(["sel_special", "N"]);
    expect(fields.filter(([name]) => name === "sel_day").map(([, value]) => value)).toEqual([
      "dummy",
      "m",
      "t",
      "w",
      "r",
      "f",
      "s",
      "u",
    ]);
    expect(fields.at(-1)).toEqual(["block_button", ""]);
  });
});
