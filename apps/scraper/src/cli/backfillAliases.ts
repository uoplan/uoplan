import fs from "fs/promises";
import path from "path";
import { WEB_ASSETS_DATA_DIR } from "../shared/paths.ts";
import { extractPreviouslyAliases } from "../catalogue/aliases.ts";

const dataDir = WEB_ASSETS_DATA_DIR;

async function main(): Promise<void> {
  const entries = await fs.readdir(dataDir);
  const catalogueFiles = entries.filter((n) => /^catalogue\.\d{4}\.json$/.test(n));
  for (const name of catalogueFiles) {
    const p = path.join(dataDir, name);
    const raw = await fs.readFile(p, "utf-8");
    const data = JSON.parse(raw) as {
      courses: Array<{
        code: string;
        description?: string;
        component?: string;
        aliases?: string[];
      }>;
    };
    if (!Array.isArray(data.courses)) continue;
    for (const c of data.courses) {
      const aliasSource = [c.component, c.description].filter(Boolean).join(" ");
      const aliases = extractPreviouslyAliases(aliasSource, c.code);
      if (aliases.length > 0) c.aliases = aliases;
      else delete c.aliases;
    }
    await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
    console.log(`Updated ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
