import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { got } from 'got';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TERMS_JSON = path.join(__dirname, '../../web/public/data/terms.json');
const SEARCH_URL =
  'https://uocampus.public.uottawa.ca/psc/csprpr9pub/EMPLOYEE/SA/c/UO_SR_AA_MODS.UO_PUB_CLSSRCH.GBL';

type Term = { termId: string; name: string };

export function parseTermDropdown(html: string): Term[] {
  const $ = cheerio.load(html);
  const select = $('#CLASS_SRCH_WRK2_STRM\\$35\\$');
  const terms: Term[] = [];
  select.find('option').each((_, opt) => {
    const termId = ($(opt).attr('value') ?? '').trim();
    const name = $(opt).text().replace(/\s+/g, ' ').trim();
    if (termId && name) terms.push({ termId, name });
  });
  const seen = new Set<string>();
  return terms.filter((t) => {
    if (seen.has(t.termId)) return false;
    seen.add(t.termId);
    return true;
  });
}

async function main() {
  const res = await got.get(SEARCH_URL);
  const currentTerms = parseTermDropdown(res.body);

  if (currentTerms.length === 0) {
    const preview = res.body.slice(0, 400).replace(/\s+/g, ' ');
    throw new Error(`Term dropdown not found in response. First 400 chars: ${preview}`);
  }

  const raw = await fs.readFile(TERMS_JSON, 'utf8');
  const { terms: knownTerms } = JSON.parse(raw) as { terms: Term[] };
  const knownIds = new Set(knownTerms.map((t) => t.termId));

  const newTerms = currentTerms.filter((t) => !knownIds.has(t.termId));
  console.log(JSON.stringify(newTerms));
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
