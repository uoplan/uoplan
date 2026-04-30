# WebPush Notifications

Browser Web Push notifications that fire when a new University of Ottawa term becomes available on uoplan. Users opt in once via a toggle in the Term Selection step and receive a push notification after the new term's schedule data has fully deployed.

---

## How it works

Three components collaborate:

1. **Cloudflare Worker** (`apps/notifications/`) — stores push subscriptions in KV and sends Web Push messages
2. **Frontend toggle** (`apps/web/src/components/steps/NotificationToggle.tsx`) — subscribe/unsubscribe in the browser; state persisted in `localStorage`
3. **GitHub Action** (`.github/workflows/check-new-terms.yml`) — runs every 4 hours, detects new terms on uOttawa's site, triggers a full scrape, waits for the Cloudflare Pages deploy to go live, then calls the Worker's `/send` endpoint

### Subscription flow

1. User clicks the toggle in Step 1 (term selection)
2. Browser prompts for notification permission
3. Browser creates a `PushSubscription` using the VAPID public key
4. Frontend POSTs the subscription JSON to `https://notifications.uoplan.party/subscribe`
5. Worker stores it in KV under `sub:<sha256-hex-of-endpoint>`
6. Frontend saves `{ status: 'subscribed', subscription: ... }` to `localStorage` key `uoplan-notifications`

No Worker requests happen on page load — state is read entirely from `localStorage`.

### Notification delivery flow

1. GitHub Action runs `pnpm check:terms` (fetches uOttawa's class search page, compares term IDs to `apps/web/public/data/terms.json`)
2. If new terms are found, dispatches `daily-scrape.yml` and waits for it to finish
3. Polls `git ls-remote origin main` for the new HEAD SHA after the scrape commit
4. Polls the GitHub check-run API until the Cloudflare Pages build for that SHA shows `completed/success`
5. For each new term, POSTs to `https://notifications.uoplan.party/send` with `Authorization: Bearer $NOTIFY_SECRET`
6. Worker lists all `sub:*` KV entries and sends a Web Push message to each; stale subscriptions (HTTP 410/404) are cleaned up automatically

---

## How to change it

**Add new notification types** — extend the Worker's `/send` endpoint payload shape and update the GitHub Action's `PAYLOAD` construction in the `Send push notifications` step.

**Change the check frequency** — edit the `cron` in `.github/workflows/check-new-terms.yml`. Default is `0 */4 * * *` (every 4 hours).

**Change the notification content** — edit the `jq -n` payload block in the `Send push notifications` step of `check-new-terms.yml`.

**Change the uOttawa selector** — if the term dropdown selector changes, update `#CLASS_SRCH_WRK2_STRM\\$35\\$` in `apps/scrapers/src/check_terms.ts` and update the unit tests in `check_terms.test.ts`.

**Toggle UI** — edit `apps/web/src/components/steps/NotificationToggle.tsx`. The component hides itself entirely if `PushManager` is not available (non-HTTPS or unsupported browser).

---

## Configuration

### Cloudflare Worker secrets (set via `wrangler secret put`)

| Secret | Description |
|--------|-------------|
| `VAPID_PRIVATE_KEY` | VAPID private key (base64url); generated with `npx web-push generate-vapid-keys` |
| `NOTIFY_SECRET` | Shared bearer token for the `/send` endpoint; must match `NOTIFY_SECRET` in GitHub Actions |

### Cloudflare Worker vars (in `wrangler.json`)

| Var | Description |
|-----|-------------|
| `VAPID_PUBLIC_KEY` | VAPID public key (base64url); safe to expose |
| `VAPID_SUBJECT` | `mailto:` contact address for VAPID |

### Vite env vars

| Var | Where | Description |
|-----|-------|-------------|
| `VITE_VAPID_PUBLIC_KEY` | Cloudflare Pages env / `.env.local` | VAPID public key; used by the subscribe flow |
| `VITE_NOTIFICATIONS_URL` | `.env.local` only | Override Worker URL for local dev (default: `https://notifications.uoplan.party`) |

### GitHub Actions secrets

| Secret | Description |
|--------|-------------|
| `NOTIFY_SECRET` | Must match the Worker's `NOTIFY_SECRET` secret |

---

## One-time infrastructure setup

1. `pnpm add -g wrangler && wrangler login`
2. `npx web-push generate-vapid-keys` — save both keys
3. `cd apps/notifications && wrangler kv namespace create WEBPUSH_SUBSCRIPTIONS` — copy the `id`
4. Edit `apps/notifications/wrangler.json`: replace `REPLACE_WITH_KV_NAMESPACE_ID` and `REPLACE_AFTER_GENERATE` with real values
5. `wrangler secret put VAPID_PRIVATE_KEY` (paste private key)
6. `wrangler secret put NOTIFY_SECRET` (choose a random value, e.g. `openssl rand -hex 32`)
7. Add `NOTIFY_SECRET` to GitHub → Settings → Secrets → Actions
8. Add `VITE_VAPID_PUBLIC_KEY` to Cloudflare Pages → Settings → Environment variables
9. `cd apps/notifications && pnpm deploy`
10. Add custom domain `notifications.uoplan.party` in Cloudflare → Workers & Pages → `uoplan-notifications` → Settings → Triggers → Custom Domains

For local dev, create `apps/web/.env.local`:
```
VITE_VAPID_PUBLIC_KEY=<your_public_key>
VITE_NOTIFICATIONS_URL=http://localhost:8787
```

---

## Dependencies

- **`web-push`** (npm) — VAPID signing and Web Push encryption in the Worker; requires `nodejs_compat` flag in `wrangler.json`
- **`cheerio`** (already in `apps/scrapers`) — parses the term `<select>` dropdown from uOttawa's search page
- **Cloudflare KV** — persistent subscription store; binding name `WEBPUSH_SUBSCRIPTIONS`
- **Mantine `Switch`, `Tooltip`, `Group`** — toggle UI components (already in the web app)
- **`@tabler/icons-react`** — `IconBell` / `IconBellOff` for the toggle (already in the web app)
