# WebPush Notification System — Design Spec

**Date:** 2026-04-29  
**Status:** Approved

## Context

uoplan users currently have no way to know when a new University of Ottawa term becomes available on the site. They must manually check every day. This feature adds browser-native Web Push notifications so users can opt in once and get notified automatically when a new term (e.g. "2026 Fall Term") is live on uoplan.

---

## Architecture Overview

Three moving parts:

1. **Cloudflare Worker** (`apps/notifications/`) — stores push subscriptions in KV, sends push notifications
2. **Frontend toggle** (in Step 1 of the wizard) — subscribe/unsubscribe, state in `localStorage`
3. **GitHub Action** (`check-new-terms.yml`) — detects new terms on uOttawa's site, triggers scrape, waits for CF Pages deploy, fires notifications

---

## Part 1: Cloudflare Worker

**Location:** `apps/notifications/`  
**URL:** `https://notifications.uoplan.party`

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/subscribe` | none | Store a Web Push subscription |
| POST | `/unsubscribe` | none | Delete a subscription |
| POST | `/send` | Bearer token | Send notification to all subscribers |

**`POST /subscribe`**  
Body: standard `PushSubscription` JSON (`{ endpoint, keys: { p256dh, auth } }`)  
Stores under KV key `sub:<sha256-hex-of-endpoint>`. Returns 201.

**`POST /unsubscribe`**  
Body: `{ endpoint }` or full `PushSubscription`.  
Deletes `sub:<sha256-hex-of-endpoint>`. Returns 200.

**`POST /send`**  
Header: `Authorization: Bearer <NOTIFY_SECRET>`  
Body: `{ title: string, body: string, url: string }`  
Lists all KV keys with prefix `sub:`, sends a Web Push message to each subscriber. Cleans up any subscription that returns 410 (expired/unsubscribed). Returns 200 with `{ sent, failed, cleaned }` counts.

### KV Namespace

`WEBPUSH_SUBSCRIPTIONS` — bound to the worker.  
Key format: `sub:<sha256-hex-of-endpoint>`  
Value: full JSON-stringified `PushSubscription` object  
No TTL set; stale subscriptions cleaned on 410 response from push service.

### VAPID

Web Push requires VAPID (Voluntary Application Server Identification). The worker uses the Web Crypto API (`crypto.subtle`) for ECDSA signing and ECDH encryption — no Node.js-only packages.

Library: `web-push` or `@block65/webcrypto-web-push` (Workers-compatible — verify during implementation).

**Worker secrets (set via `wrangler secret put`):**
- `VAPID_PRIVATE_KEY` — base64url-encoded private key
- `NOTIFY_SECRET` — shared secret for `/send` endpoint

**Worker vars (in `wrangler.json`):**
- `VAPID_PUBLIC_KEY` — base64url-encoded public key (safe to expose)
- `VAPID_SUBJECT` — `mailto:<email>`

### CORS

`/subscribe` and `/unsubscribe` must accept requests from `https://uoplan.party` (and `http://localhost:5173` for dev). `/send` is internal — no CORS needed.

---

## Part 2: Frontend (Step 1 — Term Selection)

### Files to create/modify

- **New:** `apps/web/src/components/steps/NotificationToggle.tsx` — the toggle component
- **New:** `apps/web/public/sw.js` — service worker (handles `push` event)
- **Modify:** `apps/web/src/main.tsx` or `apps/web/index.html` — register service worker
- **Modify:** The Step 1 term-selection component — add `<NotificationToggle />` at the bottom

### localStorage

Key: `uoplan-notifications`  
Shape:
```ts
type NotificationState =
  | { status: 'disabled' }
  | { status: 'subscribed'; subscription: SerializedPushSubscription }
  | { status: 'denied' }
```

**No requests to the Worker on page load.** State is read entirely from `localStorage`.

### Toggle behaviour

| Current state | User clicks "Enable" | User clicks "Disable" |
|---------------|---------------------|----------------------|
| `disabled` | Request permission → subscribe → POST `/subscribe` → save to localStorage | — |
| `subscribed` | — | `subscription.unsubscribe()` → POST `/unsubscribe` → clear localStorage |
| `denied` | Toggle shown as disabled, tooltip: "Notifications blocked in browser settings" | — |

If browser doesn't support `PushManager`, the toggle is hidden entirely.

### Service Worker (`public/sw.js`)

Minimal — only handles `push` events:
```js
self.addEventListener('push', event => {
  const { title, body, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

Registration (in `main.tsx` or similar):
```ts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### VAPID public key

Exposed via Vite env var `VITE_VAPID_PUBLIC_KEY` (set in Cloudflare Pages env or `.env.production`).

---

## Part 3: New Scraper Script + GitHub Action

### New scraper: `apps/scrapers/src/check_terms.ts`

Fetches the uOttawa public class search page and parses the term `<select>` dropdown. Compares the found term IDs against `apps/web/public/data/terms.json`.

**Output:** JSON array of new term objects to stdout, e.g.:
```json
[{"termId":"2269","name":"2026 Fall Term"}]
```
Empty array `[]` if no new terms.

The script exits 0 regardless (new terms or not) — the GH Action checks whether the output array is empty.

Add to `apps/scrapers/package.json` scripts:
```json
"check:terms": "tsx src/check_terms.ts"
```
And root `package.json`:
```json
"check:terms": "pnpm --filter scrapers run check:terms"
```

### New workflow: `.github/workflows/check-new-terms.yml`

**Schedule:** `0 */4 * * *` (every 4 hours) + `workflow_dispatch`

**Steps:**
1. Checkout repo
2. Setup pnpm + Node 24 + install deps
3. Run `pnpm check:terms`, capture stdout as `NEW_TERMS`
4. If `NEW_TERMS == '[]'` → exit job (no notification needed)
5. Dispatch `daily-scrape.yml` via `gh workflow run daily-scrape.yml`
6. Poll `gh run list --workflow=daily-scrape.yml --limit=1` until status is `completed`; fail if conclusion is not `success`
7. Get HEAD commit SHA after scrape push: `git ls-remote origin main | cut -f1`
8. Poll `gh api repos/$GITHUB_REPOSITORY/commits/{sha}/check-runs` every 30s until Cloudflare Pages check name matches and status is `completed` with conclusion `success`; timeout after 10 minutes
9. For each new term in `NEW_TERMS`, call `POST https://notifications.uoplan.party/send` with `Authorization: Bearer $NOTIFY_SECRET` (one HTTP call per new term; typically only one term drops at a time)

**Notification content** (per new term):
```json
{
  "title": "uoplan — New Term Available",
  "body": "2026 Fall Term is now on uoplan. Start planning your schedule!",
  "url": "https://uoplan.party"
}
```

**Secrets required in GitHub:**
- `NOTIFY_SECRET` — must match the Worker's `NOTIFY_SECRET` secret

---

## Infrastructure Setup (manual, one-time)

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Create KV namespace: `wrangler kv namespace create WEBPUSH_SUBSCRIPTIONS`
3. Set Worker secrets: `wrangler secret put VAPID_PRIVATE_KEY`, `wrangler secret put NOTIFY_SECRET`
4. Set `VITE_VAPID_PUBLIC_KEY` in Cloudflare Pages environment variables
5. Add `NOTIFY_SECRET` to GitHub Actions secrets
6. Add custom domain `notifications.uoplan.party` to the Worker in Cloudflare dashboard

---

## Verification

1. **Worker endpoints:** Use `curl` to POST a test subscription, then POST `/send` with the Bearer token; verify push notification arrives in browser
2. **Subscribe flow:** Open `localhost:5173`, click enable → confirm browser permission dialog → confirm localStorage has `status: 'subscribed'` → confirm KV entry exists via Wrangler
3. **Unsubscribe flow:** Toggle off → confirm localStorage cleared → confirm KV entry deleted
4. **GitHub Action (dry run):** Temporarily add a fake term to the comparison, trigger `workflow_dispatch`, observe it dispatches daily-scrape, waits, polls CF Pages, calls `/send`
5. **Service worker:** Confirm push notification renders with correct title/body/click-to-open
6. **Denied state:** Block notifications in browser settings, reload → confirm toggle is disabled with tooltip
