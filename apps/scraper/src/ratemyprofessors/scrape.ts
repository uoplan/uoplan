import fs from "node:fs/promises";
import path from "node:path";
import got from "got";
import type { SchoolId } from "@uoplan/domain/school";
import { rateMyProfessorsFile } from "../shared/paths.ts";
import { CARLETON_RMP_SCHOOL_ID } from "../schools/carleton/rateMyProfessors.ts";
import { UOTTAWA_RMP_SCHOOL_ID } from "../schools/uottawa/rateMyProfessors.ts";

const GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql";
const PAGE_SIZE = 1000;
const RMP_SCHOOL_IDS: Record<SchoolId, number> = {
  carleton: CARLETON_RMP_SCHOOL_ID,
  uottawa: UOTTAWA_RMP_SCHOOL_ID,
};

/**
 * RateMyProfessors' GraphQL API identifies a school by a Relay global id, which
 * is just base64("School-<numeric id>") — the same number that appears in the
 * public `/school/<id>` URL. Deriving it keeps a single source of truth per
 * school instead of a magic base64 blob that has to be decoded to be reviewed.
 */
function rmpSchoolNodeId(schoolId: number): string {
  return Buffer.from(`School-${schoolId}`, "utf8").toString("base64");
}

const TEACHER_SEARCH_QUERY = `query TeacherSearchPaginationQuery(
  $count: Int!
  $cursor: String
  $query: TeacherSearchQuery!
) {
  search: newSearch {
    ...TeacherSearchPagination_search_1jWD3d
  }
}
fragment TeacherCard_teacher on Teacher {
  id
  legacyId
  avgRating
  numRatings
  firstName
  lastName
}
fragment TeacherSearchPagination_search_1jWD3d on newSearch {
  teachers(query: $query, first: $count, after: $cursor) {
    didFallback
    edges {
      node {
        ...TeacherCard_teacher
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    resultCount
    filters {
      field
      options {
        value
        id
      }
    }
  }
}`;

interface TeacherNode {
  id: string;
  legacyId: number;
  avgRating: number | null;
  numRatings: number;
  firstName: string;
  lastName: string;
}

interface FormattedTeacherNode {
  id: string;
  legacyId: number;
  name: string;
  rating: number | null;
  numRatings: number;
}

interface TeacherSearchResponse {
  data?: {
    search?: {
      teachers?: {
        edges: Array<{ node: TeacherNode }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        resultCount: number;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

async function fetchTeachersPage(
  cursor: string | null,
  schoolId: string | null,
): Promise<TeacherSearchResponse> {
  const variables = {
    count: PAGE_SIZE,
    cursor,
    query: {
      text: "",
      ...(schoolId ? { schoolID: schoolId } : {}),
      fallback: true,
    },
  };

  const res = await got.post(GRAPHQL_URL, {
    json: {
      query: TEACHER_SEARCH_QUERY,
      operationName: "TeacherSearchPaginationQuery",
      variables,
    },
    responseType: "json",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; uoplan-scraper/1.0)",
    },
  });

  return res.body as TeacherSearchResponse;
}

export async function main(school: SchoolId): Promise<void> {
  const schoolId = process.env.RMP_SCHOOL_ID || getRateMyProfessorsSchoolNodeId(school);

  const allTeachers: FormattedTeacherNode[] = [];
  let cursor: string | null = null;
  let page = 0;

  console.log("Fetching professors from RateMyProfessors (GraphQL)...");

  while (true) {
    page += 1;
    const data = await fetchTeachersPage(cursor, schoolId);

    if (data.errors?.length) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const teachers = data.data?.search?.teachers;
    if (!teachers) {
      throw new Error("Unexpected response: no data.search.teachers");
    }

    const nodes = teachers.edges.map((e) => ({
      id: e.node.id,
      legacyId: e.node.legacyId,
      name: `${e.node.firstName} ${e.node.lastName}`.trim().replaceAll(/\s+/g, " "),
      rating: e.node.avgRating,
      numRatings: e.node.numRatings,
    }));
    allTeachers.push(...nodes);

    const { pageInfo, resultCount } = teachers;
    console.log(
      `Page ${page}: got ${nodes.length} professors (total so far: ${allTeachers.length}, resultCount: ${resultCount})`,
    );

    if (!pageInfo.hasNextPage) {
      break;
    }
    cursor = pageInfo.endCursor ?? null;
    if (!cursor) {
      console.warn("hasNextPage was true but endCursor missing; stopping.");
      break;
    }

    // Be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Deduplicate by normalized name: weighted-average rating, summed numRatings, first entry wins
  const normalized = new Map<string, FormattedTeacherNode>();
  for (const prof of allTeachers) {
    const key = prof.name.toLowerCase().replaceAll(/\s+/g, " ").trim();
    const existing = normalized.get(key);
    if (!existing) {
      normalized.set(key, { ...prof });
    } else {
      const totalRatings = existing.numRatings + prof.numRatings;
      if (totalRatings > 0 && existing.rating !== null && prof.rating !== null) {
        existing.rating =
          (existing.rating * existing.numRatings + prof.rating * prof.numRatings) / totalRatings;
      } else if (prof.rating !== null && existing.rating === null) {
        existing.rating = prof.rating;
      }
      existing.numRatings = totalRatings;
    }
  }

  const dedupedTeachers = Array.from(normalized.values());
  const duplicatesRemoved = allTeachers.length - dedupedTeachers.length;
  if (duplicatesRemoved > 0) {
    console.log(`Deduplicated ${duplicatesRemoved} duplicate professor entries.`);
  }

  const outPath = rateMyProfessorsFile(school);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  dedupedTeachers.sort((a, b) => a.name.localeCompare(b.name) || a.legacyId - b.legacyId);

  const output = {
    resultCount: dedupedTeachers.length,
    professors: dedupedTeachers,
  };

  await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Saved ${dedupedTeachers.length} professors to ${outPath}`);
}

export function getRateMyProfessorsSchoolNodeId(school: SchoolId): string {
  return rmpSchoolNodeId(RMP_SCHOOL_IDS[school]);
}
