export type BundledDataAssetModule =
  | number
  | string
  | { height?: number; uri: string; width?: number };

declare const require: (id: string) => BundledDataAssetModule;

export const BUNDLED_DATA_MODULES = {
  "uottawa/catalogue.pb": require("../../assets/data/uottawa/catalogue.pb"),
  "uottawa/catalogue.search.pb": require("../../assets/data/uottawa/catalogue.search.pb"),
  "uottawa/catalogue.union.pb": require("../../assets/data/uottawa/catalogue.union.pb"),
  "uottawa/disciplines.pb": require("../../assets/data/uottawa/disciplines.pb"),
  "uottawa/feedback.pb": require("../../assets/data/uottawa/feedback.pb"),
  "uottawa/grades.pb": require("../../assets/data/uottawa/grades.pb"),
  "uottawa/indices.pb": require("../../assets/data/uottawa/indices.pb"),
  "uottawa/professors.pb": require("../../assets/data/uottawa/professors.pb"),
  "uottawa/ratemyprofessors.pb": require("../../assets/data/uottawa/ratemyprofessors.pb"),
  "uottawa/schedules.2265.pb": require("../../assets/data/uottawa/schedules.2265.pb"),
  "uottawa/schedules.2269.pb": require("../../assets/data/uottawa/schedules.2269.pb"),
  "uottawa/schedules.2271.pb": require("../../assets/data/uottawa/schedules.2271.pb"),
  "uottawa/terms.pb": require("../../assets/data/uottawa/terms.pb"),
} as const satisfies Record<string, BundledDataAssetModule>;
