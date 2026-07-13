import {
  DayOfWeek as ProtoDayOfWeek,
  ImportantDateCategory as ProtoImportantDateCategory,
  ImportantDateEffect as ProtoImportantDateEffect,
  ImportantDateSeason as ProtoImportantDateSeason,
  ImportantDatesLocale as ProtoImportantDatesLocale,
} from "@uoplan/proto/data";
import type {
  ImportantDateGroup as ProtoImportantDateGroup,
  ImportantDateInterval as ProtoImportantDateInterval,
  ImportantDateItem as ProtoImportantDateItem,
  ImportantDatesData as ProtoImportantDatesData,
  ImportantDateSection as ProtoImportantDateSection,
  ImportantDateSession as ProtoImportantDateSession,
  ImportantDateTerm as ProtoImportantDateTerm,
  ScheduleReplacement as ProtoScheduleReplacement,
} from "@uoplan/proto/data";
import type { DayOfWeekCode } from "./domain";
import { dateStringToYyyymmdd, yyyymmddToDateString } from "@uoplan/domain/dataTypes/protoDates";

export type ImportantDateEffect =
  | "structural"
  | "no_classes"
  | "schedule_replacement"
  | "deadline"
  | "informational";

export type ImportantDateCategory =
  | "overview"
  | "breaks"
  | "schedule_changes"
  | "enrolment"
  | "grades_exams"
  | "tuition"
  | "student_services"
  | "graduate_reports"
  | "academic_integrity"
  | "program_changes"
  | "other";

export type ImportantDateSeason = "winter" | "spring-summer" | "fall";
export type ImportantDatesLocale = "en" | "fr-CA";

export type ImportantDateInterval = {
  startDate: string;
  endDate: string;
  startMinutes?: number;
  endMinutes?: number;
};

export type ScheduleReplacement = {
  cancelledDate: string;
  replacementDate: string;
  sourceDay: DayOfWeekCode;
};

export type ImportantDateItem = {
  id: string;
  topic: string;
  dateText: string;
  effect: ImportantDateEffect;
  interval?: ImportantDateInterval;
  replacement?: ScheduleReplacement;
  usedEnglishFallback?: boolean;
};

export type ImportantDateGroup = {
  id: string;
  label?: string;
  /** Canonical scoped session code (e.g. "A"), English-authoritative and
   * copied verbatim to French. Unscoped groups omit this field. */
  sessionCode?: string;
  items: ImportantDateItem[];
};

export type ImportantDateSession = {
  code: string;
  courseInterval: ImportantDateInterval;
};

export type ImportantDateSection = {
  id: string;
  label: string;
  category: ImportantDateCategory;
  groups: ImportantDateGroup[];
};

export type ImportantDateTerm = {
  sourceId: string;
  termId?: string;
  label: string;
  season: ImportantDateSeason;
  year: number;
  sourcePublished: string;
  termInterval: ImportantDateInterval;
  courseInterval: ImportantDateInterval;
  sections: ImportantDateSection[];
  sessions: ImportantDateSession[];
};

export type ImportantDatesData = {
  locale: ImportantDatesLocale;
  sourceUrl: string;
  reviewedText?: string;
  terms: ImportantDateTerm[];
};

function requireYyyymmdd(value: string, fieldLabel: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Important dates ${fieldLabel} must use YYYY-MM-DD: ${value}`);
  }
  const encoded = dateStringToYyyymmdd(value);
  if (encoded <= 0) {
    throw new Error(`Important dates ${fieldLabel} must be a valid date: ${value}`);
  }
  return encoded;
}

function encodeOptionalTermId(termId: string | undefined): number | undefined {
  if (termId === undefined) return undefined;
  if (!/^\d+$/.test(termId)) {
    throw new Error(`Important dates termId must be numeric when present: ${termId}`);
  }
  const parsed = Number.parseInt(termId, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Important dates termId is out of range: ${termId}`);
  }
  return parsed;
}

function localeToProto(locale: ImportantDatesLocale): ProtoImportantDatesLocale {
  switch (locale) {
    case "en":
      return ProtoImportantDatesLocale.IMPORTANT_DATES_LOCALE_EN;
    case "fr-CA":
      return ProtoImportantDatesLocale.IMPORTANT_DATES_LOCALE_FR_CA;
  }
}

function localeFromProto(locale: ProtoImportantDatesLocale): ImportantDatesLocale {
  switch (locale) {
    case ProtoImportantDatesLocale.IMPORTANT_DATES_LOCALE_EN:
      return "en";
    case ProtoImportantDatesLocale.IMPORTANT_DATES_LOCALE_FR_CA:
      return "fr-CA";
    case ProtoImportantDatesLocale.IMPORTANT_DATES_LOCALE_UNSPECIFIED:
    default:
      throw new Error(`Important dates locale must not be unspecified: ${locale}`);
  }
}

function effectToProto(effect: ImportantDateEffect): ProtoImportantDateEffect {
  switch (effect) {
    case "structural":
      return ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_STRUCTURAL;
    case "no_classes":
      return ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_NO_CLASSES;
    case "schedule_replacement":
      return ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_SCHEDULE_REPLACEMENT;
    case "deadline":
      return ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_DEADLINE;
    case "informational":
      return ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_INFORMATIONAL;
  }
}

function effectFromProto(effect: ProtoImportantDateEffect): ImportantDateEffect {
  switch (effect) {
    case ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_STRUCTURAL:
      return "structural";
    case ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_NO_CLASSES:
      return "no_classes";
    case ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_SCHEDULE_REPLACEMENT:
      return "schedule_replacement";
    case ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_DEADLINE:
      return "deadline";
    case ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_INFORMATIONAL:
      return "informational";
    case ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_UNSPECIFIED:
    default:
      throw new Error(`Important dates effect must not be unspecified: ${effect}`);
  }
}

function categoryToProto(category: ImportantDateCategory): ProtoImportantDateCategory {
  switch (category) {
    case "overview":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_OVERVIEW;
    case "breaks":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_BREAKS;
    case "schedule_changes":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_SCHEDULE_CHANGES;
    case "enrolment":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_ENROLMENT;
    case "grades_exams":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_GRADES_EXAMS;
    case "tuition":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_TUITION;
    case "student_services":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_STUDENT_SERVICES;
    case "graduate_reports":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_GRADUATE_REPORTS;
    case "academic_integrity":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_ACADEMIC_INTEGRITY;
    case "program_changes":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_PROGRAM_CHANGES;
    case "other":
      return ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_OTHER;
  }
}

function categoryFromProto(category: ProtoImportantDateCategory): ImportantDateCategory {
  switch (category) {
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_OVERVIEW:
      return "overview";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_BREAKS:
      return "breaks";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_SCHEDULE_CHANGES:
      return "schedule_changes";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_ENROLMENT:
      return "enrolment";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_GRADES_EXAMS:
      return "grades_exams";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_TUITION:
      return "tuition";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_STUDENT_SERVICES:
      return "student_services";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_GRADUATE_REPORTS:
      return "graduate_reports";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_ACADEMIC_INTEGRITY:
      return "academic_integrity";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_PROGRAM_CHANGES:
      return "program_changes";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_OTHER:
      return "other";
    case ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_UNSPECIFIED:
    default:
      throw new Error(`Important dates category must not be unspecified: ${category}`);
  }
}

function seasonToProto(season: ImportantDateSeason): ProtoImportantDateSeason {
  switch (season) {
    case "winter":
      return ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_WINTER;
    case "spring-summer":
      return ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_SPRING_SUMMER;
    case "fall":
      return ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_FALL;
  }
}

function seasonFromProto(season: ProtoImportantDateSeason): ImportantDateSeason {
  switch (season) {
    case ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_WINTER:
      return "winter";
    case ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_SPRING_SUMMER:
      return "spring-summer";
    case ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_FALL:
      return "fall";
    case ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_UNSPECIFIED:
    default:
      throw new Error(`Important dates season must not be unspecified: ${season}`);
  }
}

function sourceDayToProto(sourceDay: DayOfWeekCode): ProtoDayOfWeek {
  switch (sourceDay) {
    case "Mo":
      return ProtoDayOfWeek.DAY_OF_WEEK_MO;
    case "Tu":
      return ProtoDayOfWeek.DAY_OF_WEEK_TU;
    case "We":
      return ProtoDayOfWeek.DAY_OF_WEEK_WE;
    case "Th":
      return ProtoDayOfWeek.DAY_OF_WEEK_TH;
    case "Fr":
      return ProtoDayOfWeek.DAY_OF_WEEK_FR;
    case "Sa":
      return ProtoDayOfWeek.DAY_OF_WEEK_SA;
    case "Su":
      return ProtoDayOfWeek.DAY_OF_WEEK_SU;
  }
}

function sourceDayFromProto(sourceDay: ProtoDayOfWeek): DayOfWeekCode {
  switch (sourceDay) {
    case ProtoDayOfWeek.DAY_OF_WEEK_MO:
      return "Mo";
    case ProtoDayOfWeek.DAY_OF_WEEK_TU:
      return "Tu";
    case ProtoDayOfWeek.DAY_OF_WEEK_WE:
      return "We";
    case ProtoDayOfWeek.DAY_OF_WEEK_TH:
      return "Th";
    case ProtoDayOfWeek.DAY_OF_WEEK_FR:
      return "Fr";
    case ProtoDayOfWeek.DAY_OF_WEEK_SA:
      return "Sa";
    case ProtoDayOfWeek.DAY_OF_WEEK_SU:
      return "Su";
    case ProtoDayOfWeek.DAY_OF_WEEK_UNSPECIFIED:
    default:
      throw new Error(
        `Important dates replacement source day must not be unspecified: ${sourceDay}`,
      );
  }
}

function toProtoInterval(interval: ImportantDateInterval): ProtoImportantDateInterval {
  return {
    startYyyymmdd: requireYyyymmdd(interval.startDate, "interval startDate"),
    endYyyymmdd: requireYyyymmdd(interval.endDate, "interval endDate"),
    ...(interval.startMinutes !== undefined ? { startMinutes: interval.startMinutes } : {}),
    ...(interval.endMinutes !== undefined ? { endMinutes: interval.endMinutes } : {}),
  };
}

function fromProtoInterval(interval: ProtoImportantDateInterval): ImportantDateInterval {
  return {
    startDate: yyyymmddToDateString(interval.startYyyymmdd),
    endDate: yyyymmddToDateString(interval.endYyyymmdd),
    ...(interval.startMinutes !== undefined ? { startMinutes: Number(interval.startMinutes) } : {}),
    ...(interval.endMinutes !== undefined ? { endMinutes: Number(interval.endMinutes) } : {}),
  };
}

function toProtoReplacement(replacement: ScheduleReplacement): ProtoScheduleReplacement {
  return {
    cancelledYyyymmdd: requireYyyymmdd(replacement.cancelledDate, "replacement cancelledDate"),
    replacementYyyymmdd: requireYyyymmdd(
      replacement.replacementDate,
      "replacement replacementDate",
    ),
    sourceDay: sourceDayToProto(replacement.sourceDay),
  };
}

function fromProtoReplacement(replacement: ProtoScheduleReplacement): ScheduleReplacement {
  return {
    cancelledDate: yyyymmddToDateString(replacement.cancelledYyyymmdd),
    replacementDate: yyyymmddToDateString(replacement.replacementYyyymmdd),
    sourceDay: sourceDayFromProto(replacement.sourceDay),
  };
}

function requireProtoInterval(
  interval: ProtoImportantDateInterval | undefined,
  fieldLabel: string,
): ProtoImportantDateInterval {
  if (!interval) {
    throw new Error(`Important dates ${fieldLabel} is required`);
  }
  return interval;
}

function toProtoItem(item: ImportantDateItem): ProtoImportantDateItem {
  return {
    id: item.id,
    topic: item.topic,
    dateText: item.dateText,
    effect: effectToProto(item.effect),
    ...(item.interval ? { interval: toProtoInterval(item.interval) } : {}),
    ...(item.replacement ? { replacement: toProtoReplacement(item.replacement) } : {}),
    ...(item.usedEnglishFallback !== undefined
      ? { usedEnglishFallback: item.usedEnglishFallback }
      : {}),
  };
}

function fromProtoItem(item: ProtoImportantDateItem): ImportantDateItem {
  return {
    id: item.id,
    topic: item.topic,
    dateText: item.dateText,
    effect: effectFromProto(item.effect),
    ...(item.interval ? { interval: fromProtoInterval(item.interval) } : {}),
    ...(item.replacement ? { replacement: fromProtoReplacement(item.replacement) } : {}),
    ...(item.usedEnglishFallback !== undefined
      ? { usedEnglishFallback: item.usedEnglishFallback }
      : {}),
  };
}

function toProtoGroup(group: ImportantDateGroup): ProtoImportantDateGroup {
  return {
    id: group.id,
    ...(group.label !== undefined ? { label: group.label } : {}),
    ...(group.sessionCode !== undefined ? { sessionCode: group.sessionCode } : {}),
    items: group.items.map(toProtoItem),
  };
}

function fromProtoGroup(group: ProtoImportantDateGroup): ImportantDateGroup {
  return {
    id: group.id,
    ...(group.label !== undefined ? { label: group.label } : {}),
    ...(group.sessionCode !== undefined ? { sessionCode: group.sessionCode } : {}),
    items: group.items.map(fromProtoItem),
  };
}

function toProtoSession(session: ImportantDateSession): ProtoImportantDateSession {
  if (!session.code) {
    throw new Error("Important dates session code must not be empty");
  }
  return {
    code: session.code,
    courseInterval: toProtoInterval(session.courseInterval),
  };
}

function fromProtoSession(session: ProtoImportantDateSession): ImportantDateSession {
  if (!session.code) {
    throw new Error("Important dates session code must not be empty");
  }
  return {
    code: session.code,
    courseInterval: fromProtoInterval(
      requireProtoInterval(session.courseInterval, "session courseInterval"),
    ),
  };
}

function toProtoSection(section: ImportantDateSection): ProtoImportantDateSection {
  return {
    id: section.id,
    label: section.label,
    category: categoryToProto(section.category),
    groups: section.groups.map(toProtoGroup),
  };
}

function fromProtoSection(section: ProtoImportantDateSection): ImportantDateSection {
  return {
    id: section.id,
    label: section.label,
    category: categoryFromProto(section.category),
    groups: section.groups.map(fromProtoGroup),
  };
}

function toProtoTerm(term: ImportantDateTerm): ProtoImportantDateTerm {
  return {
    sourceId: term.sourceId,
    ...(term.termId !== undefined ? { termId: encodeOptionalTermId(term.termId) } : {}),
    label: term.label,
    season: seasonToProto(term.season),
    year: term.year,
    sourcePublished: term.sourcePublished,
    termInterval: toProtoInterval(term.termInterval),
    courseInterval: toProtoInterval(term.courseInterval),
    sections: term.sections.map(toProtoSection),
    sessions: term.sessions.map(toProtoSession),
  };
}

function fromProtoTerm(term: ProtoImportantDateTerm): ImportantDateTerm {
  return {
    sourceId: term.sourceId,
    ...(term.termId !== undefined ? { termId: String(term.termId) } : {}),
    label: term.label,
    season: seasonFromProto(term.season),
    year: Number(term.year),
    sourcePublished: term.sourcePublished,
    termInterval: fromProtoInterval(requireProtoInterval(term.termInterval, "termInterval")),
    courseInterval: fromProtoInterval(requireProtoInterval(term.courseInterval, "courseInterval")),
    sections: term.sections.map(fromProtoSection),
    sessions: term.sessions.map(fromProtoSession),
  };
}

export function toProtoImportantDatesData(input: ImportantDatesData): ProtoImportantDatesData {
  return {
    locale: localeToProto(input.locale),
    sourceUrl: input.sourceUrl,
    ...(input.reviewedText !== undefined ? { reviewedText: input.reviewedText } : {}),
    terms: input.terms.map(toProtoTerm),
  };
}

export function fromProtoImportantDatesData(input: ProtoImportantDatesData): ImportantDatesData {
  return {
    locale: localeFromProto(input.locale),
    sourceUrl: input.sourceUrl,
    ...(input.reviewedText !== undefined ? { reviewedText: input.reviewedText } : {}),
    terms: input.terms.map(fromProtoTerm),
  };
}
