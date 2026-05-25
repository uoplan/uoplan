import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: ["apps/scrapers/data/**", "**/*.gen.ts", "CHANGELOG.md"],
});
