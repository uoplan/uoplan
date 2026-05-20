import { got, type HandlerFunction } from "got";
import { CookieJar, Cookie } from "tough-cookie";
import { select, isCancel } from "@clack/prompts";
import type { StoredSession } from "../auth/keychain.ts";
import { setTerm } from "../auth/keychain.ts";
import { ENDPOINTS } from "./endpoints.ts";
import {
  extractPageState,
  buildTermSelectBody,
  isTermSelectionPage,
  parseTermsFromHtml,
  parseStrmFromHtml,
} from "./peoplesoft.ts";

export class AuthExpiredError extends Error {
  constructor() {
    super("Session expired. Run `uoplan login` to authenticate.");
    this.name = "AuthExpiredError";
  }
}

export class NoTermSelectedError extends Error {
  constructor() {
    super("No term selected. Run `uoplan term` to select one.");
    this.name = "NoTermSelectedError";
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

  // Raw client: auth detection only. Used internally to avoid handler recursion.
  const rawClient = got.extend({
    cookieJar: jar,
    followRedirect: true,
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

  // Smart client: if PeopleSoft drops back to the term-selection page, re-select
  // the saved term automatically, or prompt the user if none is saved yet.
  // Requests to ENDPOINTS.termList are whitelisted — the term command handles those itself.
  const termSelectHandler = (async (options: any, next: any) => {
    const ctx = (options.context ?? {}) as Record<string, unknown>;
    const response = await next(options);
    const body =
      typeof (response as { body?: unknown }).body === "string"
        ? (response as { body: string }).body
        : "";

    const requestUrl: string =
      typeof options.url === "string" ? options.url : (options.url as URL).href;

    if (
      !ctx.termSelectRetry &&
      isTermSelectionPage(body) &&
      !requestUrl.startsWith(ENDPOINTS.termList)
    ) {
      let termIndex = session.termIndex;

      if (termIndex === undefined) {
        const terms = parseTermsFromHtml(body);
        if (terms.length === 0) throw new NoTermSelectedError();

        const chosen = await select({
          message: "Select a term to continue",
          options: terms.map((t) => ({ value: t.index, label: t.name, hint: t.career })),
        });

        if (isCancel(chosen)) throw new NoTermSelectedError();
        termIndex = chosen as number;
      }

      const state = extractPageState(body);
      const postRes = await rawClient.post(requestUrl, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: buildTermSelectBody(state, termIndex),
        followRedirect: false,
        throwHttpErrors: false,
      });

      const postBody = (postRes as { body: string }).body;
      const postLocation: string | undefined = (postRes as { headers: Record<string, string> })
        .headers?.location;
      const strm = parseStrmFromHtml(postLocation ?? "") ?? parseStrmFromHtml(postBody);
      if (strm) {
        const isCartUrl = requestUrl.includes("SSR_SSENRL_CART");
        setTerm(strm, termIndex, isCartUrl ? postLocation : undefined);
        session.strm = strm;
        session.termIndex = termIndex;
        if (isCartUrl && postLocation) session.cartUrl = postLocation;
      }

      // Use the redirect Location as the replay URL — it has the full PS params
      // (Page, Action, ACAD_CAREER, INSTITUTION, STRM) that PS needs to load the
      // right component. Fall back to appending STRM to the original URL.
      const baseReplayUrl =
        typeof options.url === "string" ? options.url : (options.url as URL).href;
      const replayUrl =
        postLocation ??
        (strm && !baseReplayUrl.includes("STRM=")
          ? `${baseReplayUrl}${baseReplayUrl.includes("?") ? "&" : "?"}STRM=${strm}`
          : baseReplayUrl);
      const method = ((options.method as string) ?? "GET").toUpperCase();

      if (method === "POST") {
        return rawClient.post(replayUrl, {
          body: options.body as string,
          headers: options.headers as Record<string, string>,
        });
      }
      return rawClient.get(replayUrl);
    }

    return response;
  }) as unknown as HandlerFunction;

  const client = rawClient.extend({ handlers: [termSelectHandler] });

  return { client, jar };
}

export type PeopleSoftClient = Awaited<ReturnType<typeof buildClient>>["client"];
