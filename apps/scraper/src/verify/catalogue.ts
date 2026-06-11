import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WEB_ASSETS_DATA_DIR } from "../shared/paths.ts";
import { extractCourseCodes } from "../shared/text.ts";

interface CoursePrereqNode {
  type: "course" | "or_group" | "and_group" | "non_course";
  code?: string;
  text?: string;
  children?: CoursePrereqNode[];
  disciplines?: string[];
  credits?: number;
}

interface Course {
  code: string;
  title: string;
  prereqText?: string;
  prerequisites?: CoursePrereqNode;
}

interface Catalogue {
  courses: Course[];
}

// Extract all course codes from the AST
function extractCourseCodesFromAst(node: CoursePrereqNode | undefined): string[] {
  if (!node) return [];

  const codes: string[] = [];

  function traverse(n: CoursePrereqNode) {
    if (n.type === "course" && n.code) {
      codes.push(n.code);
    }
    if (n.children) {
      for (const child of n.children) traverse(child);
    }
  }

  traverse(node);
  return Array.from(new Set(codes));
}

// Check for potentially problematic patterns
function analyzePrereqText(text: string): string[] {
  const issues: string[] = [];

  // French "et" without proper parsing
  if (/\bet\b/i.test(text) && !/\band\b/i.test(text)) {
    issues.push('contains French "et" without English "and"');
  }

  // French "ou" without proper handling
  if (/\bou\b/i.test(text) && !/\bor\b/i.test(text)) {
    issues.push('contains French "ou" without English "or"');
  }

  // Missing closing parenthesis
  const openCount = (text.match(/\(/g) || []).length;
  const closeCount = (text.match(/\)/g) || []).length;
  if (openCount !== closeCount) {
    issues.push(`parentheses mismatch: ${openCount} open, ${closeCount} close`);
  }

  // Complex nesting
  if (text.includes("((") || text.includes("))")) {
    issues.push("complex nested parentheses");
  }

  // Unusual separators
  if (text.includes(";") && !text.includes(".") && !text.includes(",")) {
    issues.push("uses semicolon separator");
  }

  // "for students enrolled in" pattern
  if (/for students enrolled in/i.test(text)) {
    issues.push('has "for students enrolled in" conditional');
  }

  // Grade requirements like (B+ or higher)
  if (/\([A-F][+-]?\s+or\s+higher\)/i.test(text)) {
    issues.push("has grade requirement");
  }

  // "reserved for" pattern
  if (/reserved for/i.test(text)) {
    issues.push('has "reserved for" restriction');
  }

  // Course codes without spaces (e.g., "MAT1341" instead of "MAT 1341")
  const noSpaceMatch = text.match(/\b[A-Z]{3,4}\d{4,5}[A-Z]?\b/);
  if (noSpaceMatch) {
    issues.push(`course code without space: ${noSpaceMatch[0]}`);
  }

  // Discipline abbreviations in parentheses like "(CSI)"
  const disciplineMatch = text.match(/\b([A-Z]{3,4})\s+or\s+([A-Z]{3,4})\b/g);
  if (disciplineMatch && text.includes("units")) {
    issues.push("discipline OR with credit units");
  }

  // "previously" or "antérieurement" (legacy aliases)
  if (/previously|antérieurement/i.test(text)) {
    issues.push("contains legacy alias reference");
  }

  return issues;
}

// Compare raw text with AST
function verifyCourse(course: Course): string[] {
  const issues: string[] = [];

  if (!course.prereqText || !course.prerequisites) {
    // Skip if no prereqs or no parsing
    return issues;
  }

  const textCodes = extractCourseCodes(course.prereqText);
  const astCodes = extractCourseCodesFromAst(course.prerequisites);

  // Check for missing codes
  const missingInAst = textCodes.filter((c) => !astCodes.includes(c));
  if (missingInAst.length > 0) {
    issues.push(`[${course.code}] Missing codes in AST: ${missingInAst.join(", ")}`);
    issues.push(`  Raw text: "${course.prereqText}"`);
  }

  // Check for codes in AST not in text (shouldn't happen)
  const extraInAst = astCodes.filter((c) => !textCodes.includes(c));
  if (extraInAst.length > 0) {
    issues.push(`[${course.code}] Extra codes in AST: ${extraInAst.join(", ")}`);
  }

  // Analyze patterns
  const patternIssues = analyzePrereqText(course.prereqText);
  for (const pi of patternIssues) {
    issues.push(`[${course.code}] Pattern: ${pi}`);
    issues.push(
      `  Text: "${course.prereqText.slice(0, 100)}${course.prereqText.length > 100 ? "..." : ""}"`,
    );
  }

  return issues;
}

async function loadCatalogue(filePath: string): Promise<Catalogue> {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as Catalogue;
}

export async function main() {
  const dataDir = WEB_ASSETS_DATA_DIR;

  // Find all catalogue files
  const files = await fs.readdir(dataDir);
  const catalogueFiles = files
    .filter((f) => f.startsWith("catalogue.") && f.endsWith(".json") && !f.includes("missing"))
    .sort();

  console.log("Catalogue files found:", catalogueFiles);
  console.log("=".repeat(80));

  const allIssues: string[] = [];
  const stats = {
    totalCourses: 0,
    coursesWithPrereqs: 0,
    coursesWithParsedPrereqs: 0,
  };

  for (const file of catalogueFiles) {
    const filePath = path.join(dataDir, file);
    console.log(`\nProcessing ${file}...`);

    try {
      const catalogue = await loadCatalogue(filePath);

      for (const course of catalogue.courses) {
        stats.totalCourses++;

        if (course.prereqText) {
          stats.coursesWithPrereqs++;
        }

        if (course.prerequisites) {
          stats.coursesWithParsedPrereqs++;
        }

        const issues = verifyCourse(course);
        allIssues.push(...issues);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("STATISTICS:");
  console.log(`  Total courses: ${stats.totalCourses}`);
  console.log(`  Courses with prereqText: ${stats.coursesWithPrereqs}`);
  console.log(`  Courses with parsed prerequisites: ${stats.coursesWithParsedPrereqs}`);
  console.log(
    `  Parsing coverage: ${((stats.coursesWithParsedPrereqs / stats.coursesWithPrereqs) * 100).toFixed(1)}%`,
  );

  console.log(`\n${"=".repeat(80)}`);
  console.log("ISSUES FOUND:");

  if (allIssues.length === 0) {
    console.log("  No issues found!");
  } else {
    // Group by type
    const missingCodes = allIssues.filter((i) => i.includes("Missing codes"));
    const extraCodes = allIssues.filter((i) => i.includes("Extra codes"));
    const patterns = allIssues.filter((i) => i.includes("Pattern:"));

    if (missingCodes.length > 0) {
      console.log(`\n--- Missing Course Codes (${missingCodes.length} issues) ---`);
      for (const i of missingCodes) console.log(i);
    }

    if (extraCodes.length > 0) {
      console.log(`\n--- Extra Course Codes in AST (${extraCodes.length} issues) ---`);
      for (const i of extraCodes) console.log(i);
    }

    if (patterns.length > 0) {
      console.log(`\n--- Pattern Analysis (${patterns.length} patterns) ---`);
      // Group by pattern type
      const patternGroups = new Map<string, number>();
      for (const p of patterns) {
        const match = p.match(/Pattern: (.+)/);
        if (match) {
          const type = match[1];
          patternGroups.set(type, (patternGroups.get(type) || 0) + 1);
        }
      }

      // Show counts
      const sortedPatterns = Array.from(patternGroups.entries()).sort((a, b) => b[1] - a[1]);
      for (const [type, count] of sortedPatterns) {
        console.log(`  ${type}: ${count} occurrences`);
      }
    }
  }
}
