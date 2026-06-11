import * as cheerio from "cheerio";
import { fetchHtml } from "../shared/http.ts";
import { urlToSlug } from "./links.ts";
import { parseElectiveRequirement, parseUnits } from "./requirements.ts";
import {
  ProgramRequirementSchema,
  ProgramSchema,
  type Program,
  type ProgramRequirement,
} from "./schema.ts";

export async function scrapeProgram(url: string): Promise<Program> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $("#page-title-area>h1, h1.page-title").first().text().replace(/\s+/g, " ").trim();

  const requirements: ProgramRequirement[] = [];
  let currentGroup: ProgramRequirement | null = null;

  function pushSectionHeader(title: string, isIndented: boolean): void {
    currentGroup = null;
    requirements.push(
      ProgramRequirementSchema.parse({
        type: "section",
        title,
        indented: isIndented || undefined,
      }),
    );
  }

  $("table.sc_courselist tr").each((_, el) => {
    const rowClass = $(el).attr("class") || "";
    if (rowClass.includes("listsum")) return;

    const isIndented =
      $(el).find('div[style*="margin-left"]').length > 0 ||
      $(el).find(".blockind").length > 0 ||
      $(el).find(".commentindent").length > 0;

    const isHeaderRow = $(el).find("th").length > 0;
    const isSectionHeader = $(el).find(".areaheader").length > 0;

    if (isHeaderRow) {
      if (isSectionHeader) {
        pushSectionHeader($(el).text().replace(/\s+/g, " ").trim(), isIndented);
      }
      return;
    }

    if (isSectionHeader) {
      pushSectionHeader($(el).text().replace(/\s+/g, " ").trim(), isIndented);
      return;
    }

    let code = $(el).find("td.codecol").text().replace(/\s+/g, " ").trim();
    const rowTitle = $(el).find("td.titlecol").text().replace(/\s+/g, " ").trim();
    const hours = $(el).find("td.hourscol").text().replace(/\s+/g, " ").trim();
    const credits = hours ? parseUnits(hours) : undefined;

    let isOr = false;
    if ($(el).find(".orclass").length > 0) isOr = true;
    if (code.startsWith("or ")) {
      isOr = true;
      code = code.substring(3).trim();
    }

    const isComment = $(el).find(".courselistcomment").length > 0;

    if (isComment) {
      const commentText = $(el).find(".courselistcomment").text().replace(/\s+/g, " ").trim();
      const parsedNode = parseElectiveRequirement(commentText, credits);
      const parsedWithIndent: ProgramRequirement = {
        ...parsedNode,
        indented: isIndented || undefined,
      };

      if (isIndented && currentGroup && currentGroup.options) {
        currentGroup.options.push(parsedWithIndent);
      } else {
        if (commentText.endsWith(":") || commentText.toLowerCase().includes("from:")) {
          currentGroup = {
            type: "group",
            title: commentText,
            credits,
            options: [],
            indented: isIndented || undefined,
          };
          requirements.push(currentGroup);
        } else {
          currentGroup = null;
          requirements.push(parsedWithIndent);
        }
      }
      return;
    }

    if (code) {
      const courseReq: ProgramRequirement = {
        type: isOr ? "or_course" : "course",
        code,
        title: rowTitle || undefined,
        credits,
        indented: isIndented || undefined,
      };

      if (isIndented && currentGroup && currentGroup.options) {
        currentGroup.options.push(courseReq);
      } else {
        currentGroup = null;
        requirements.push(courseReq);
      }
    } else if (rowTitle || hours) {
      const parsedNode = parseElectiveRequirement(rowTitle, credits);
      const parsedWithIndent: ProgramRequirement = {
        ...parsedNode,
        indented: isIndented || undefined,
      };
      if (isIndented && currentGroup && currentGroup.options) {
        currentGroup.options.push(parsedWithIndent);
      } else {
        currentGroup = null;
        requirements.push(parsedWithIndent);
      }
    }
  });

  return ProgramSchema.parse({
    title,
    url,
    slug: urlToSlug(url),
    requirements,
  });
}
