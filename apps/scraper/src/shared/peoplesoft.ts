import { type Got, got } from "got";
import { CookieJar } from "tough-cookie";

export const PEOPLESOFT_CLASS_SEARCH_URL =
  "https://uocampus.public.uottawa.ca/psc/csprpr9pub/EMPLOYEE/SA/c/UO_SR_AA_MODS.UO_PUB_CLSSRCH.GBL";

function createPeopleSoftHttpClient(): Got {
  const jar = new CookieJar();
  return got.extend({
    cookieJar: jar,
    followRedirect: true,
    https: { rejectUnauthorized: true },
  });
}

export async function bootstrapPeopleSoft<T>(
  url: string,
  extract: (html: string, client: Got) => T | null | undefined,
  buildError: (preview: string) => Error,
): Promise<{ client: Got; value: T; lastHtml: string }> {
  const client = createPeopleSoftHttpClient();

  let lastHtml = "";
  for (let attempt = 1; attempt <= 10; attempt++) {
    const res = await client.get(url);
    const html = res.body;
    lastHtml = html;
    const value = extract(html, client);
    if (value) return { client, value, lastHtml };
  }

  const preview = lastHtml.slice(0, 400).replace(/\s+/g, " ");
  throw buildError(preview);
}
