import * as DataProto from "@uoplan/proto/data";
import { createExtraCodeAccumulator } from "@uoplan/core/dataTypes/codeRef";
import { CourseCodeIndexer, normalizeCode } from "./shared.ts";

interface DisciplineLevelInput {
  discipline?: string;
  levels?: number[];
}

interface PrereqInput {
  type?: string;
  code?: string;
  text?: string;
  credits?: number;
  disciplines?: string[];
  levels?: number[];
  disciplineLevels?: DisciplineLevelInput[];
  programs?: string[];
  children?: PrereqInput[];
  kind?: string;
}

interface RequirementInput {
  type?: string;
  title?: string;
  code?: string;
  credits?: number;
  disciplineLevels?: DisciplineLevelInput[];
  excluded_disciplines?: string[];
  faculty?: string;
  indented?: boolean;
  levels?: number[];
  options?: RequirementInput[];
}

interface CatalogueCourseInput {
  code?: string;
  title?: string;
  credits?: number;
  component?: string;
  aliases?: string[];
  prereqText?: string;
  prerequisites?: PrereqInput;
}

interface CatalogueProgramInput {
  title?: string;
  slug?: string;
  url?: string;
  requirements?: RequirementInput[];
}

export interface CatalogueJsonInput {
  courses?: CatalogueCourseInput[];
  programs?: CatalogueProgramInput[];
}

function prereqTypeToProto(type: string): number {
  switch (type) {
    case "course":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_COURSE;
    case "or_group":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_OR_GROUP;
    case "and_group":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_AND_GROUP;
    case "non_course":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_NON_COURSE;
    default:
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_UNSPECIFIED;
  }
}

function requirementTypeToProto(type: string): number {
  const t = DataProto.RequirementType;
  switch (type) {
    case "course":
      return t.REQUIREMENT_TYPE_COURSE;
    case "elective":
      return t.REQUIREMENT_TYPE_ELECTIVE;
    case "group":
      return t.REQUIREMENT_TYPE_GROUP;
    case "pick":
      return t.REQUIREMENT_TYPE_PICK;
    case "options_group":
      return t.REQUIREMENT_TYPE_OPTIONS_GROUP;
    case "discipline_elective":
      return t.REQUIREMENT_TYPE_DISCIPLINE_ELECTIVE;
    case "free_elective":
      return t.REQUIREMENT_TYPE_FREE_ELECTIVE;
    case "non_discipline_elective":
      return t.REQUIREMENT_TYPE_NON_DISCIPLINE_ELECTIVE;
    case "faculty_elective":
      return t.REQUIREMENT_TYPE_FACULTY_ELECTIVE;
    case "section":
      return t.REQUIREMENT_TYPE_SECTION;
    case "and":
      return t.REQUIREMENT_TYPE_AND;
    case "or_group":
      return t.REQUIREMENT_TYPE_OR_GROUP;
    case "or_course":
      return t.REQUIREMENT_TYPE_OR_COURSE;
    default:
      return t.REQUIREMENT_TYPE_UNSPECIFIED;
  }
}

function prereqKindToProto(kind: unknown): number | undefined {
  const k = DataProto.CoursePrereqKind;
  switch (kind) {
    case "permission":
      return k.COURSE_PREREQ_KIND_PERMISSION;
    case "audition":
      return k.COURSE_PREREQ_KIND_AUDITION;
    case "language":
      return k.COURSE_PREREQ_KIND_LANGUAGE;
    case "equivalent":
      return k.COURSE_PREREQ_KIND_EQUIVALENT;
    case "highschool":
      return k.COURSE_PREREQ_KIND_HIGHSCHOOL;
    case "standing":
      return k.COURSE_PREREQ_KIND_STANDING;
    case "topic":
      return k.COURSE_PREREQ_KIND_TOPIC;
    case "coursework":
      return k.COURSE_PREREQ_KIND_COURSEWORK;
    case "knowledge":
      return k.COURSE_PREREQ_KIND_KNOWLEDGE;
    case "recommended":
      return k.COURSE_PREREQ_KIND_RECOMMENDED;
    default:
      return undefined;
  }
}

function mapDisciplineLevels(items: DisciplineLevelInput[] = []) {
  return items.map((d) => ({
    discipline: d.discipline ?? "",
    levels: d.levels ?? [],
  }));
}

function mapPrereq(node: PrereqInput): DataProto.CoursePrereqNode {
  return {
    type: prereqTypeToProto(String(node.type ?? "")),
    code: node.code,
    text: node.text,
    credits: node.credits,
    disciplines: node.disciplines ?? [],
    levels: node.levels ?? [],
    disciplineLevels: mapDisciplineLevels(node.disciplineLevels),
    programs: node.programs ?? [],
    children: (node.children ?? []).map(mapPrereq),
    kind: prereqKindToProto(node.kind),
  };
}

type CodeRefEncoder = (code: string | undefined) => number | undefined;

function mapRequirement(
  req: RequirementInput,
  encodeCodeRef: CodeRefEncoder,
): DataProto.ProgramRequirement {
  return {
    type: requirementTypeToProto(String(req.type ?? "")),
    title: req.title,
    codeRef: encodeCodeRef(req.code),
    creditsX4: req.credits !== undefined ? Math.round(req.credits * 4) : undefined,
    disciplineLevels: mapDisciplineLevels(req.disciplineLevels),
    excludedDisciplines: req.excluded_disciplines ?? [],
    faculty: req.faculty,
    indented: req.indented,
    levels: req.levels ?? [],
    options: (req.options ?? []).map((option) => mapRequirement(option, encodeCodeRef)),
  };
}

export function mapCatalogue(input: CatalogueJsonInput) {
  const indexer = new CourseCodeIndexer();

  for (const course of input.courses ?? []) {
    indexer.add(String(course.code ?? ""));
    for (const alias of course.aliases ?? []) indexer.add(String(alias ?? ""));
  }

  // Program-requirement codes reference the course-code dictionary by 1-based
  // index; codes absent from it (cross-year refs) go into a small `extra_codes`
  // list referenced past `course_codes.length`.
  const codeRefs = createExtraCodeAccumulator();
  const encodeCodeRef: CodeRefEncoder = (code) => {
    const normalized = normalizeCode(code ?? "");
    if (!normalized) return;
    return codeRefs.resolve(normalized, indexer.indexOf(normalized), indexer.courseCodes.length);
  };

  const programs = (input.programs ?? []).map((program) => ({
    title: program.title ?? "",
    programKey: program.slug ?? program.url ?? program.title ?? "",
    requirements: (program.requirements ?? []).map((requirement) =>
      mapRequirement(requirement, encodeCodeRef),
    ),
  }));

  return {
    courseCodes: indexer.courseCodes,
    extraCodes: codeRefs.extraCodes,
    courses: (input.courses ?? []).map((course) => ({
      code: indexer.add(String(course.code ?? "")),
      title: course.title ?? "",
      credits: course.credits ?? 0,
      component: course.component,
      aliases: (course.aliases ?? []).map((alias) => indexer.add(String(alias ?? ""))),
      hasPrereqText: Boolean(course.prereqText),
      prerequisites: course.prerequisites ? mapPrereq(course.prerequisites) : undefined,
    })),
    programs,
  };
}
