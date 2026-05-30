import * as cheerio from "cheerio";
import { fetchHtml } from "../shared/http.ts";
import { extractPreviouslyAliases } from "./aliases.ts";
import { extractPrereqSentence, parseCoursePrerequisites } from "./prerequisites.ts";
import { CourseSchema, type Course, type CoursePrereqNode } from "./schema.ts";

export async function scrapeCourses(url: string): Promise<Course[]> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const courses: Course[] = [];

  $(".courseblock").each((_, el) => {
    const titleBlock = $(el).find(".courseblocktitle").text().replace(/\s+/g, " ").trim();
    const descBlock = $(el).find(".courseblockdesc").text().replace(/\s+/g, " ").trim();
    const extraBlock = $(el).find(".courseblockextra").text().replace(/\s+/g, " ").trim();

    const prereqHighlight = $(el).find(".courseblockextra.highlight").first();
    let prereqText: string | undefined;
    let prerequisites: CoursePrereqNode | undefined;
    if (prereqHighlight.length > 0) {
      const rawPrereq = prereqHighlight.text();
      prereqText = extractPrereqSentence(rawPrereq);
      if (prereqText) {
        prerequisites = parseCoursePrerequisites(prereqText);
      }
    }

    const match = titleBlock.match(/^([A-Z]{3,4}\s*\d{4,5}[A-Z]?)\s+(.*)$/i);

    if (!match) {
      throw new Error(`Failed to parse course title block: "${titleBlock}" at ${url}`);
    }

    const code = match[1].replace(/\s+/, " ");
    let title = match[2];
    let credits = 0;

    const creditsMatch = title.match(/\(([^)]*?(?:units?|crédits?|crédit)[^)]*)\)$/i);
    if (creditsMatch) {
      title = title.substring(0, creditsMatch.index).trim();
      const numMatch = creditsMatch[1].match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        credits = parseFloat(numMatch[1]);
      }
    }

    const componentMatch = extraBlock.match(/(?:Course Component|Volet)\s*:\s*(.*)/i);
    const component = componentMatch ? componentMatch[1] : undefined;

    const aliasSource = [component, descBlock].filter(Boolean).join(" ");
    const aliases = extractPreviouslyAliases(aliasSource, code);

    courses.push(
      CourseSchema.parse({
        code,
        title,
        credits,
        description: descBlock,
        component,
        ...(aliases.length > 0 ? { aliases } : {}),
        prereqText,
        prerequisites,
      }),
    );
  });

  return courses;
}
