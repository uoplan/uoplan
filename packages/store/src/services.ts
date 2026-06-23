import type {
  Catalogue,
  Course,
  DataCache,
  GeneratedSchedule,
  GenerationConstraints,
  OptimizationPriority,
  SchedulesData,
} from "@uoplan/core";
import type { AppState, GenerationErrorState } from "./types";

export type WizardStepLike = 0 | 1 | 2 | 3 | 4;

export interface NavigationService {
  toWizardStep(step: WizardStepLike, options?: { replace?: boolean }): void;
  toCalendar(options?: { replace?: boolean }): void;
}

export interface PersistenceService {
  readEncodedState(): string | null | Promise<string | null>;
  writeEncodedState(base64: string): void | Promise<void>;
  removeEncodedState(): void | Promise<void>;
  flushEncodedState?(): void | Promise<void>;
  now(): number;
}

export interface LocationService {
  getSearch(): string;
  getHref(): string;
  getOrigin(): string;
  replaceHref(nextHref: string): void;
  clearSearch(): void;
}

export interface NotificationMessage {
  color?: "red" | "yellow" | "green";
  title: string;
  message: string;
}

export interface NotificationService {
  show(message: NotificationMessage): void;
}

export type TranslateFn = (id: string, values?: Record<string, unknown>) => string;

export interface DataService {
  fetchBytes(id: string): Promise<Uint8Array>;
  optionalBytes(id: string): Promise<Uint8Array | null>;
}

export type GenerateSchedulesMode = "basic" | "advanced";

export interface ScheduleGenerationResult {
  currentSchedule: GeneratedSchedule | null;
  swapPool: string[];
  chosenCourseToRequirementId: Record<string, string>;
  currentPoolMap: Record<string, string>;
  currentColorMap: Record<string, number>;
  generationError: GenerationErrorState | null;
}

export interface ScheduleRunnerService {
  run(state: AppState, mode: GenerateSchedulesMode): Promise<ScheduleGenerationResult | null>;
  cancel(): void;
  prewarm(state: AppState): Promise<void>;
}

export interface RetimetableFixedSetInput {
  catalogue: Catalogue;
  yearCatalogueCourses?: Course[] | null;
  completedCourses?: readonly string[];
  schedulesData: SchedulesData;
  cache: DataCache;
  courseCodes: readonly string[];
  constraints: GenerationConstraints;
  seed: number;
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  virtualExemptCourses?: readonly string[];
  applyBlacklist?: boolean;
  blacklistedCourses?: readonly string[];
  /** Ordered optimization objectives — shape + professor objectives apply to swaps. */
  optimizationPriorities: OptimizationPriority[];
}

export interface EngineService {
  retimetableFixedSet(input: RetimetableFixedSetInput): Promise<GeneratedSchedule | null>;
}

export interface ShareUrlInput {
  origin: string;
  encodedStateBase64: string;
  currentSchedule: GeneratedSchedule | null;
  schedulesData: SchedulesData | null;
  selectedTermId: string | null;
}

export interface ShareClipboardService {
  getOrigin(): string;
  copyText(text: string): Promise<void> | void;
  /**
   * Build the canonical share URL for the current schedule. Kept in the platform
   * adapter because it encodes a proto {@link GeneratedSchedule} preview into the
   * `?p=` query param (browser base64url) — logic the package stays free of.
   */
  buildShareUrl(input: ShareUrlInput): string;
}

export interface DiagnosticsService {
  assignmentDebugEnabled(): boolean;
  debugAssignments(payload: unknown): void;
}

export interface AppServices {
  navigation: NavigationService;
  persistence: PersistenceService;
  location: LocationService;
  notifications: NotificationService;
  data: DataService;
  scheduleRunner: ScheduleRunnerService;
  engine: EngineService;
  share: ShareClipboardService;
  tr: TranslateFn;
  diagnostics: DiagnosticsService;
}

export interface AppServiceOverrides {
  navigation?: Partial<NavigationService>;
  persistence?: Partial<PersistenceService>;
  location?: Partial<LocationService>;
  notifications?: Partial<NotificationService>;
  data?: Partial<DataService>;
  scheduleRunner?: Partial<ScheduleRunnerService>;
  engine?: Partial<EngineService>;
  share?: Partial<ShareClipboardService>;
  tr?: TranslateFn;
  diagnostics?: Partial<DiagnosticsService>;
}
