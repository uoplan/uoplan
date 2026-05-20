# uoplan CLI

A command-line interface for managing your University of Ottawa course cart and enrollment via uoCampus.

## What it is

`@uoplan/cli` lets you list your shopping cart, add courses, and submit enrollment without opening a browser. It authenticates via Microsoft's device code flow against uOttawa's Entra ID tenant.

## How to run

```bash
# From the repo root
node --experimental-transform-types apps/cli/src/index.ts <command>

# Or via pnpm filter
pnpm --filter @uoplan/cli run dev <command>
```

## Commands

| Command                         | Description                                      |
| ------------------------------- | ------------------------------------------------ |
| `uoplan login`                  | Authenticate with your uOttawa Microsoft account |
| `uoplan logout`                 | Clear stored credentials from the keychain       |
| `uoplan cart`                   | List courses in your shopping cart               |
| `uoplan cart add <classNumber>` | Add a course by PeopleSoft class number          |
| `uoplan checkout`               | Enroll in all courses in your cart               |

## Setup: getting a client ID

The CLI uses [Microsoft device code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code) to authenticate against uOttawa's Entra tenant (`d41fdab1-7e15-4cfd-b5fa-7200e54deb6b`).

You need a **client ID** registered in that tenant with device code flow enabled:

1. Sign in to [portal.azure.com](https://portal.azure.com) with your uOttawa account.
2. Go to **Entra ID → App registrations → New registration**.
3. Set redirect URI to `http://localhost` (public client / mobile & desktop app).
4. Under **Authentication**, enable "Allow public client flows".
5. Copy the **Application (client) ID**.

Set it before running:

```bash
export UOPLAN_CLIENT_ID=<your-client-id>
uoplan login
```

Or hardcode it in `apps/cli/src/auth/devicecode.ts` (the `CLIENT_ID` constant).

## Session storage

Credentials are stored in the **macOS Keychain** using the `security` CLI tool. Service: `uoplan`, account: `session`. Run `uoplan logout` to remove them.

## How authentication works

1. `uoplan login` calls Microsoft's device code endpoint for tenant `d41fdab1-7e15-4cfd-b5fa-7200e54deb6b`.
2. MSAL prints a URL and short code to the terminal.
3. You open the URL in any browser, enter the code, and complete MFA.
4. The CLI receives an access token and stores it in the keychain.
5. Subsequent commands load the token and attach it to PeopleSoft requests.

**Note on the PeopleSoft token bridge**: uoCampus uses SAML2 SSO (not OAuth) in the browser. The exact mechanism for using a Microsoft access token to establish a PeopleSoft session (via Integration Broker REST API or SAML assertion exchange) needs to be confirmed against the live environment. See `apps/cli/src/api/client.ts` for the current approach and `src/auth/devicecode.ts` for the `SCOPES` to adjust.

## How to change it

- **Auth scopes / resource**: Edit `SCOPES` in `apps/cli/src/auth/devicecode.ts`. Once the PeopleSoft resource ID is known, add it here.
- **PeopleSoft endpoints**: All form action names (`ICAction` values) are in `apps/cli/src/api/cart.ts` and `apps/cli/src/api/enrollment.ts`. Inspect the live pages with browser DevTools to confirm the correct names.
- **Adding commands**: Create a new file in `apps/cli/src/commands/`, export a `Command`, and register it in `apps/cli/src/index.ts`.

## Dependencies

| Package                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `@azure/msal-node`     | Microsoft device code flow                             |
| `commander`            | CLI argument parsing                                   |
| `got` + `tough-cookie` | HTTP client with cookie jar (same pattern as scrapers) |
| `cheerio`              | PeopleSoft HTML parsing                                |
| `chalk` + `ora`        | Terminal output                                        |
