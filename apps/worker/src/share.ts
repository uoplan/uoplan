import { peekSchoolFromBase64, SCHOOLS } from "@uoplan/core";

/**
 * Share-link landing page: a tiny HTML document that carries Open Graph / Twitter
 * card metadata (so the schedule preview unfurls in chats) and then immediately
 * redirects the visitor to the in-app calendar view.
 */
export function buildShareHtml(stateBase64url: string, schedulePayload?: string | null): string {
  const base64 = stateBase64url.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  // The state blob names its own school, so the redirect lands on that school's
  // path prefix. uOttawa's slug is empty, keeping every pre-existing share link
  // pointing at exactly the same `/schedule/` URL as before.
  const school = SCHOOLS[peekSchoolFromBase64(stateBase64url)];
  const prefix = school.pathSlug === "" ? "" : `/${school.pathSlug}`;
  const appUrl = `${prefix}/schedule/?s=${encodeURIComponent(padded)}`;
  // The `p` payload (courses + sections of the already-generated schedule) lets
  // the OG-image worker render without re-running schedule generation. It is
  // only forwarded to the OG image; the redirect above uses the primary state.
  const ogQuery = schedulePayload ? `?p=${encodeURIComponent(schedulePayload)}` : "";
  const ogImage = `https://uoplan.party/api/og-image/${stateBase64url}${ogQuery}`;
  const ogUrl = `https://uoplan.party/api/share/${stateBase64url}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>uoplan – My Schedule</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="uoplan – My Schedule">
  <meta property="og:description" content="View my generated course schedule on uoplan.">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${ogUrl}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ogImage}">
</head>
<body>
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;
}
