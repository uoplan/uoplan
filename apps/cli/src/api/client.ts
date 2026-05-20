import { got } from "got";
import { CookieJar, Cookie } from "tough-cookie";
import type { StoredSession } from "../auth/keychain.ts";

export const BASE_URL = "https://www.uocampus.uottawa.ca/psp/csprpr9www/EMPLOYEE/SA/c/";

export class AuthExpiredError extends Error {
  constructor() {
    super("Session expired. Run `uoplan login` to authenticate.");
    this.name = "AuthExpiredError";
  }
}

export async function buildClient(session: StoredSession) {
  const jar = new CookieJar();

  for (const c of session.cookies) {
    const cookie = new Cookie({
      key: c.name,
      value: c.value,
      domain: c.domain.replace(/^\./, ""),
      path: c.path,
      expires: c.expires > 0 ? new Date(c.expires * 1000) : "Infinity",
      httpOnly: c.httpOnly,
      secure: c.secure,
    });
    await jar.setCookie(cookie, `https://${cookie.domain}/`);
  }

  const client = got.extend({
    cookieJar: jar,
    followRedirects: true,
    hooks: {
      afterResponse: [
        (response) => {
          const body = typeof response.body === "string" ? response.body : "";
          const lower = body.toLowerCase();
          const isLoginPage =
            lower.includes("sign in to peoplesoft") ||
            lower.includes("you must have cookies enabled") ||
            (/<meta[^>]+http-equiv=['"]refresh['"]/i.test(body) && body.includes("CAMPUS_URL=")) ||
            response.url.includes("login.microsoftonline.com");

          if (isLoginPage) throw new AuthExpiredError();

          return response;
        },
      ],
    },
  });

  return { client, jar };
}

export type PeopleSoftClient = Awaited<ReturnType<typeof buildClient>>["client"];
