import {
  CoursePrereqNodeType,
  CoursePrereqKind as ProtoCoursePrereqKind,
  RequirementType,
} from "@uoplan/proto/data";
import type {
  CoursePrereqNode as ProtoCoursePrereqNode,
  DisciplineLevel as ProtoDisciplineLevel,
  ProgramRequirement as ProtoProgramRequirement,
} from "@uoplan/proto/data";
import type { CoursePrereqKind, CoursePrereqNode, ProgramRequirement } from "./domain";
import { normalizeCourseCode } from "../utils/courseUtils";

function disciplineLevelsFromProto(
  disciplineLevels: readonly ProtoDisciplineLevel[],
): Array<{ discipline: string; levels?: number[] }> {
  return disciplineLevels.map((d) => ({
    discipline: d.discipline,
    ...(d.levels.length > 0 ? { levels: d.levels.map((n) => Number(n)) } : {}),
  }));
}

function reqTypeFromProto(value: RequirementType): ProgramRequirement["type"] {
  switch (value) {
    case RequirementType.REQUIREMENT_TYPE_COURSE:
      return "course";
    case RequirementType.REQUIREMENT_TYPE_ELECTIVE:
      return "elective";
    case RequirementType.REQUIREMENT_TYPE_GROUP:
      return "group";
    case RequirementType.REQUIREMENT_TYPE_PICK:
      return "pick";
    case RequirementType.REQUIREMENT_TYPE_OPTIONS_GROUP:
      return "options_group";
    case RequirementType.REQUIREMENT_TYPE_DISCIPLINE_ELECTIVE:
      return "discipline_elective";
    case RequirementType.REQUIREMENT_TYPE_FREE_ELECTIVE:
      return "free_elective";
    case RequirementType.REQUIREMENT_TYPE_NON_DISCIPLINE_ELECTIVE:
      return "non_discipline_elective";
    case RequirementType.REQUIREMENT_TYPE_FACULTY_ELECTIVE:
      return "faculty_elective";
    case RequirementType.REQUIREMENT_TYPE_SECTION:
      return "section";
    case RequirementType.REQUIREMENT_TYPE_AND:
      return "and";
    case RequirementType.REQUIREMENT_TYPE_OR_GROUP:
      return "or_group";
    case RequirementType.REQUIREMENT_TYPE_OR_COURSE:
      return "or_course";
    default:
      return "course";
  }
}

function reqTypeToProto(value: ProgramRequirement["type"]): RequirementType {
  switch (value) {
    case "course":
      return RequirementType.REQUIREMENT_TYPE_COURSE;
    case "elective":
      return RequirementType.REQUIREMENT_TYPE_ELECTIVE;
    case "group":
      return RequirementType.REQUIREMENT_TYPE_GROUP;
    case "pick":
      return RequirementType.REQUIREMENT_TYPE_PICK;
    case "options_group":
      return RequirementType.REQUIREMENT_TYPE_OPTIONS_GROUP;
    case "discipline_elective":
      return RequirementType.REQUIREMENT_TYPE_DISCIPLINE_ELECTIVE;
    case "free_elective":
      return RequirementType.REQUIREMENT_TYPE_FREE_ELECTIVE;
    case "non_discipline_elective":
      return RequirementType.REQUIREMENT_TYPE_NON_DISCIPLINE_ELECTIVE;
    case "faculty_elective":
      return RequirementType.REQUIREMENT_TYPE_FACULTY_ELECTIVE;
    case "section":
      return RequirementType.REQUIREMENT_TYPE_SECTION;
    case "and":
      return RequirementType.REQUIREMENT_TYPE_AND;
    case "or_group":
      return RequirementType.REQUIREMENT_TYPE_OR_GROUP;
    case "or_course":
      return RequirementType.REQUIREMENT_TYPE_OR_COURSE;
  }
}

function prereqTypeFromProto(value: CoursePrereqNodeType): CoursePrereqNode["type"] {
  switch (value) {
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_COURSE:
      return "course";
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_OR_GROUP:
      return "or_group";
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_AND_GROUP:
      return "and_group";
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_NON_COURSE:
      return "non_course";
    default:
      return "non_course";
  }
}

function prereqTypeToProto(value: CoursePrereqNode["type"]): CoursePrereqNodeType {
  switch (value) {
    case "course":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_COURSE;
    case "or_group":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_OR_GROUP;
    case "and_group":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_AND_GROUP;
    case "non_course":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_NON_COURSE;
  }
}

const PREREQ_KIND_TO_PROTO: Record<CoursePrereqKind, ProtoCoursePrereqKind> = {
  permission: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_PERMISSION,
  audition: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_AUDITION,
  language: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_LANGUAGE,
  equivalent: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_EQUIVALENT,
  highschool: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_HIGHSCHOOL,
  standing: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_STANDING,
  topic: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_TOPIC,
  coursework: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_COURSEWORK,
  knowledge: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_KNOWLEDGE,
  recommended: ProtoCoursePrereqKind.COURSE_PREREQ_KIND_RECOMMENDED,
};

function prereqKindFromProto(value: ProtoCoursePrereqKind): CoursePrereqNode["kind"] {
  switch (value) {
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_PERMISSION:
      return "permission";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_AUDITION:
      return "audition";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_LANGUAGE:
      return "language";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_EQUIVALENT:
      return "equivalent";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_HIGHSCHOOL:
      return "highschool";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_STANDING:
      return "standing";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_TOPIC:
      return "topic";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_COURSEWORK:
      return "coursework";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_KNOWLEDGE:
      return "knowledge";
    case ProtoCoursePrereqKind.COURSE_PREREQ_KIND_RECOMMENDED:
      return "recommended";
    default:
      return undefined;
  }
}

export function toProtoPrereq(node: CoursePrereqNode): ProtoCoursePrereqNode {
  return {
    type: prereqTypeToProto(node.type),
    code: node.code,
    text: node.text,
    credits: node.credits,
    disciplines: node.disciplines ?? [],
    levels: node.levels ?? [],
    disciplineLevels: (node.disciplineLevels ?? []).map((d) => ({
      discipline: d.discipline,
      levels: d.levels ?? [],
    })),
    programs: node.programs ?? [],
    children: (node.children ?? []).map(toProtoPrereq),
    kind: node.kind ? PREREQ_KIND_TO_PROTO[node.kind] : undefined,
  };
}

export function fromProtoPrereq(node: ProtoCoursePrereqNode): CoursePrereqNode {
  const kind = node.kind !== undefined ? prereqKindFromProto(node.kind) : undefined;
  return {
    type: prereqTypeFromProto(node.type),
    ...(node.code ? { code: normalizeCourseCode(node.code) } : {}),
    ...(node.text ? { text: node.text } : {}),
    ...(node.credits !== undefined ? { credits: node.credits } : {}),
    ...(node.disciplines.length > 0 ? { disciplines: node.disciplines } : {}),
    ...(node.levels.length > 0 ? { levels: node.levels.map((n) => Number(n)) } : {}),
    ...(node.disciplineLevels.length > 0
      ? { disciplineLevels: disciplineLevelsFromProto(node.disciplineLevels) }
      : {}),
    ...(node.programs.length > 0 ? { programs: node.programs } : {}),
    ...(kind ? { kind } : {}),
    ...(node.children.length > 0 ? { children: node.children.map(fromProtoPrereq) } : {}),
  };
}

export function toProtoProgramRequirement(
  requirement: ProgramRequirement,
): ProtoProgramRequirement {
  return {
    type: reqTypeToProto(requirement.type),
    title: requirement.title,
    code: requirement.code,
    credits: requirement.credits,
    disciplineLevels: (requirement.disciplineLevels ?? []).map(
      (d): ProtoDisciplineLevel => ({
        discipline: d.discipline,
        levels: d.levels ?? [],
      }),
    ),
    excludedDisciplines: requirement.excluded_disciplines ?? [],
    faculty: requirement.faculty,
    indented: requirement.indented,
    levels: requirement.levels ?? [],
    options: (requirement.options ?? []).map(toProtoProgramRequirement),
  };
}

export function fromProtoProgramRequirement(
  requirement: ProtoProgramRequirement,
): ProgramRequirement {
  return {
    type: reqTypeFromProto(requirement.type),
    ...(requirement.title ? { title: requirement.title } : {}),
    ...(requirement.code ? { code: normalizeCourseCode(requirement.code) } : {}),
    ...(requirement.credits !== undefined ? { credits: Number(requirement.credits) } : {}),
    ...(requirement.disciplineLevels.length > 0
      ? { disciplineLevels: disciplineLevelsFromProto(requirement.disciplineLevels) }
      : {}),
    ...(requirement.excludedDisciplines.length > 0
      ? { excluded_disciplines: requirement.excludedDisciplines }
      : {}),
    ...(requirement.faculty ? { faculty: requirement.faculty } : {}),
    ...(requirement.indented !== undefined ? { indented: requirement.indented } : {}),
    ...(requirement.levels.length > 0 ? { levels: requirement.levels.map((n) => Number(n)) } : {}),
    ...(requirement.options.length > 0
      ? { options: requirement.options.map(fromProtoProgramRequirement) }
      : {}),
  };
}
