/**
 * One-time styled console greeting for the curious who open devtools — an ASCII
 * wordmark, a friendly bilingual line, and an invitation to contribute on
 * GitHub. Developer-facing, so the banner text is an inline literal rather than
 * routed through the i18n catalogs (`%c`-styled ASCII art doesn't fit the
 * `msgid/msgstr` model). Browser-only and printed at most once per page load.
 */

const REPO_URL = "https://github.com/uoplan/uoplan";

let printed = false;

export function printConsoleGreeting(): void {
  if (printed) return;
  if (typeof window === "undefined" || typeof console === "undefined") return;
  printed = true;

  const art = [
    "                    _             ",
    "  _   _  ___  _ __ | | __ _ _ __  ",
    " | | | |/ _ \\| '_ \\| |/ _` | '_ \\ ",
    " | |_| | (_) | |_) | | (_| | | | |",
    "  \\__,_|\\___/| .__/|_|\\__,_|_| |_|",
    "             |_|        .party     ",
  ].join("\n");

  const headingStyle = "color:#d11a3a;font-family:monospace;font-weight:bold;";
  const textStyle = "color:#9aa0a6;font-family:monospace;";
  const linkStyle = "color:#74c0fc;font-family:monospace;font-weight:bold;";

  console.log(`%c${art}`, headingStyle);
  console.log(
    "%cBuilt by students, for students — at the University of Ottawa. 🐺\n" +
      "Conçu par des étudiants, pour des étudiants — à l'Université d'Ottawa.",
    textStyle,
  );
  console.log("%cLike poking around? uoplan is open source — come say hi:", textStyle);
  console.log(`%c${REPO_URL}`, linkStyle);
  console.log("%cP.S. there are a few easter eggs hidden around here. Go Gee-Gees! 🎉", textStyle);
}
