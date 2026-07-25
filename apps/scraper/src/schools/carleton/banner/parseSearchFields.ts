import * as cheerio from "cheerio";

export interface CarletonSearchForm {
  action: string;
  hiddenFields: Array<[string, string]>;
}

export function parseSearchForm(html: string): CarletonSearchForm {
  const $ = cheerio.load(html);
  const form = $('form[action*="p_course_search"]').first();
  const hiddenFields: Array<[string, string]> = [];

  form.find('input[type="hidden"]').each((_, input) => {
    const name = $(input).attr("name")?.trim();
    if (!name) return;
    hiddenFields.push([name, $(input).attr("value") ?? ""]);
  });

  return { action: form.attr("action")?.trim() ?? "", hiddenFields };
}

export function parseSearchPostFields(html: string): Array<[string, string]> {
  const $ = cheerio.load(html);
  const form = $('form[action*="p_course_search"]').first();
  const fields: Array<[string, string]> = [];

  form.find("input, select, textarea").each((_, element) => {
    const control = $(element);
    const name = control.attr("name")?.trim();
    if (!name || control.is(":disabled")) return;

    if (control.is("select")) {
      const selected = control.find("option[selected]");
      const options = selected.length > 0 ? selected : control.find("option").first();
      options.each((__, option) => {
        fields.push([name, $(option).attr("value") ?? $(option).text()]);
      });
      return;
    }

    const type = (control.attr("type") ?? "text").toLowerCase();
    if (["submit", "button", "reset", "image", "file"].includes(type)) return;
    if ((type === "checkbox" || type === "radio") && control.attr("checked") == null) return;
    fields.push([name, control.attr("value") ?? ""]);
  });

  return fields;
}
