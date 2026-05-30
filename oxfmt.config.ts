import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: ["apps/scraper/data/**", "**/__fixtures__/**", "**/*.gen.ts", "CHANGELOG.md"],
});
