import { z } from "zod";
import type { CoursePrereqKind, CoursePrereqNode } from "@uoplan/core";

export type { CoursePrereqKind, CoursePrereqNode };

const CoursePrereqKindSchema = z.enum([
  "permission",
  "audition",
  "language",
  "equivalent",
  "highschool",
  "standing",
  "topic",
  "coursework",
  "knowledge",
  "recommended",
]);

const CoursePrereqNodeSchema: z.ZodType<CoursePrereqNode> = z.lazy(() =>
  z.object({
    type: z.enum(["course", "or_group", "and_group", "non_course"]),
    code: z.string().optional(),
    text: z.string().optional(),
    credits: z.number().optional(),
    disciplines: z.array(z.string()).optional(),
    levels: z.array(z.number()).optional(),
    disciplineLevels: z
      .array(
        z.object({
          discipline: z.string(),
          levels: z.array(z.number()).optional(),
        }),
      )
      .optional(),
    programs: z.array(z.string()).optional(),
    kind: CoursePrereqKindSchema.optional(),
    children: z.array(CoursePrereqNodeSchema).optional(),
  }),
);

export const CourseSchema = z.object({
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  description: z.string(),
  component: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  prereqText: z.string().optional(),
  prerequisites: CoursePrereqNodeSchema.optional(),
});
export type Course = z.infer<typeof CourseSchema>;

const RequirementTypeSchema = z.enum([
  "course",
  "elective",
  "group",
  "pick",
  "options_group",
  "discipline_elective",
  "free_elective",
  "non_discipline_elective",
  "faculty_elective",
  "section",
  "and",
  "or_group",
  "or_course",
]);

const DisciplineLevelSchema = z.object({
  discipline: z.string(),
  levels: z.array(z.number()).optional(), // e.g. [3000, 4000]
});

const ProgramRequirementBaseSchema = z.object({
  type: RequirementTypeSchema,
  title: z.string().optional(),
  code: z.string().optional(),
  credits: z.number().optional(),
  disciplineLevels: z.array(DisciplineLevelSchema).optional(),
  // Course levels (e.g. [3000, 4000]) for a discipline-less elective requirement
  // such as "6 optional course units at the 3000 or 4000 level". Lets candidate
  // resolution constrain the elective pool by level.
  levels: z.array(z.number()).optional(),
  excluded_disciplines: z.array(z.string()).optional(),
  faculty: z.string().optional(),
  // Row was visually indented in the source table (e.g. via `commentindent`).
  // Used to correctly group option contents.
  indented: z.boolean().optional(),
});

export type ProgramRequirementType = z.infer<typeof ProgramRequirementBaseSchema> & {
  options?: ProgramRequirementType[];
};

export const ProgramRequirementSchema: z.ZodType<ProgramRequirementType> =
  ProgramRequirementBaseSchema.extend({
    options: z.lazy(() => z.array(ProgramRequirementSchema)).optional(),
  });
export type ProgramRequirement = ProgramRequirementType;

export const ProgramSchema = z.object({
  title: z.string(),
  url: z.string(),
  slug: z.string(),
  requirements: z.array(ProgramRequirementSchema),
});
export type Program = z.infer<typeof ProgramSchema>;

export const CatalogueSchema = z.object({
  courses: z.array(CourseSchema),
  programs: z.array(ProgramSchema),
});
export type Catalogue = z.infer<typeof CatalogueSchema>;
