export type BundledDataAssetModule =
  | number
  | string
  | { height?: number; uri: string; width?: number };

declare const require: (id: string) => BundledDataAssetModule;

export const BUNDLED_DATA_MODULES = {
  "catalogue.2017.pb": require("../../assets/data/catalogue.2017.pb"),
  "catalogue.2018.pb": require("../../assets/data/catalogue.2018.pb"),
  "catalogue.2019.pb": require("../../assets/data/catalogue.2019.pb"),
  "catalogue.2020.pb": require("../../assets/data/catalogue.2020.pb"),
  "catalogue.2021.pb": require("../../assets/data/catalogue.2021.pb"),
  "catalogue.2022.pb": require("../../assets/data/catalogue.2022.pb"),
  "catalogue.2023.pb": require("../../assets/data/catalogue.2023.pb"),
  "catalogue.2024.pb": require("../../assets/data/catalogue.2024.pb"),
  "catalogue.2025.pb": require("../../assets/data/catalogue.2025.pb"),
  "catalogue.2026.pb": require("../../assets/data/catalogue.2026.pb"),
  "catalogue.pb": require("../../assets/data/catalogue.pb"),
  "disciplines.pb": require("../../assets/data/disciplines.pb"),
  "feedback.pb": require("../../assets/data/feedback.pb"),
  "grades.pb": require("../../assets/data/grades.pb"),
  "indices.pb": require("../../assets/data/indices.pb"),
  "professors.pb": require("../../assets/data/professors.pb"),
  "ratemyprofessors.pb": require("../../assets/data/ratemyprofessors.pb"),
  "schedules.2261.pb": require("../../assets/data/schedules.2261.pb"),
  "schedules.2265.pb": require("../../assets/data/schedules.2265.pb"),
  "schedules.2269.pb": require("../../assets/data/schedules.2269.pb"),
  "schedules.2271.pb": require("../../assets/data/schedules.2271.pb"),
  "terms.pb": require("../../assets/data/terms.pb"),
} as const satisfies Record<string, BundledDataAssetModule>;
