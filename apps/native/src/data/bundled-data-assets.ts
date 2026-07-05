export type BundledDataAssetModule =
  | number
  | string
  | { height?: number; uri: string; width?: number };

declare const require: (id: string) => BundledDataAssetModule;

export const BUNDLED_DATA_MODULES = {
  "catalogue.pb": require("../../assets/data/catalogue.pb"),
  "catalogue.union.pb": require("../../assets/data/catalogue.union.pb"),
  "disciplines.pb": require("../../assets/data/disciplines.pb"),
  "feedback.pb": require("../../assets/data/feedback.pb"),
  "grades.pb": require("../../assets/data/grades.pb"),
  "indices.pb": require("../../assets/data/indices.pb"),
  "professors.pb": require("../../assets/data/professors.pb"),
  "ratemyprofessors.pb": require("../../assets/data/ratemyprofessors.pb"),
  "schedules.2265.pb": require("../../assets/data/schedules.2265.pb"),
  "schedules.2269.pb": require("../../assets/data/schedules.2269.pb"),
  "schedules.2271.pb": require("../../assets/data/schedules.2271.pb"),
  "terms.pb": require("../../assets/data/terms.pb"),
} as const satisfies Record<string, BundledDataAssetModule>;
