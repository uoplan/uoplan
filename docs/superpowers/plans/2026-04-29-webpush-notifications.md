# WebPush Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser Web Push notifications so uoplan users can opt in once and be notified automatically when a new University of Ottawa term becomes available.

**Architecture:** A Cloudflare Worker (`apps/notifications/`) stores push subscriptions in KV and exposes three endpoints (subscribe, unsubscribe, send). A toggle in the wizard's Term step subscribes/unsubscribes and stores state in `localStorage` — no Worker requests on page load. A new GitHub Action (`check-new-terms.yml`) scrapes the uOttawa search page every 4 hours, and when a new term is detected, triggers the full scrape, waits for the Cloudflare Pages deploy to go green, then calls the Worker's `/send` endpoint.

**Tech Stack:** Cloudflare Workers + KV, `web-push` npm package (with `nodejs_compat` flag), Vite env vars for VAPID public key, Mantine `Switch` component, Vitest for the scraper unit test, Wrangler v4.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `apps/notifications/package.json` | Worker package config + scripts |
| Create | `apps/notifications/wrangler.json` | Worker bindings, KV, routes, vars |
| Create | `apps/notifications/tsconfig.json` | TS config for Workers runtime |
| Create | `apps/notifications/src/index.ts` | Worker fetch handler: subscribe / unsubscribe / send |
| Create | `apps/web/public/sw.js` | Service worker: handles `push` event, shows notification |
| Modify | `apps/web/src/main.tsx` | Register service worker on startup |
| Create | `apps/web/src/components/steps/NotificationToggle.tsx` | Bell toggle: localStorage state, subscribe/unsubscribe logic |
| Modify | `apps/web/src/components/steps/TermStep.tsx` | Add `<NotificationToggle />` at bottom |
| Create | `apps/scrapers/src/check_terms.ts` | Fetch uOttawa search page, compare to terms.json, print new terms JSON |
| Modify | `apps/scrapers/package.json` | Add `check:terms` script |
| Modify | `package.json` (root) | Add `check:terms` root script |
| Create | `.github/workflows/check-new-terms.yml` | 4-hour schedule: detect new terms → trigger scrape → wait for CF Pages → notify |

---

## Task 1: Manual Infrastructure Setup

> **Do this first.** These are one-time manual steps that generate values needed by later tasks.

- [ ] **Step 1: Install wrangler**

```bash
pnpm add -g wrangler
wrangler login
```

- [ ] **Step 2: Generate VAPID keys**

```bash
npx web-push generate-vapid-keys
```

Save the printed `Public Key` and `Private Key` — you'll use them in steps 4 and 5.

- [ ] **Step 3: Create KV namespace**

```bash
cd apps/notifications
wrangler kv namespace create WEBPUSH_SUBSCRIPTIONS
```

Copy the `id` from the output (looks like `"id": "abc123..."`).

- [ ] **Step 4: Update `wrangler.json` with real values**

After Task 2 creates the file, replace:
- `REPLACE_WITH_KV_NAMESPACE_ID` → the id from Step 3
- `REPLACE_AFTER_GENERATE` → the Public Key from Step 2

- [ ] **Step 5: Set Worker secrets**

```bash
wrangler secret put VAPID_PRIVATE_KEY
# paste the Private Key from Step 2

wrangler secret put NOTIFY_SECRET
# choose a random value, e.g.: openssl rand -hex 32
```

Save the `NOTIFY_SECRET` value — you need it in Step 6.

- [ ] **Step 6: Add secrets to GitHub Actions**

In GitHub → Repository → Settings → Secrets → Actions, add:
- `NOTIFY_SECRET` → same value used in Step 5

- [ ] **Step 7: Add Vite env var to Cloudflare Pages**

In Cloudflare Dashboard → Pages project → Settings → Environment variables:
- `VITE_VAPID_PUBLIC_KEY` → the Public Key from Step 2

For local dev, create `apps/web/.env.local`:
```
VITE_VAPID_PUBLIC_KEY=<your_public_key>
VITE_NOTIFICATIONS_URL=http://localhost:8787
```

---

## Task 2: Cloudflare Worker Project Scaffold

**Files:**
- Create: `apps/notifications/package.json`
- Create: `apps/notifications/wrangler.json`
- Create: `apps/notifications/tsconfig.json`

- [ ] **Step 1: Create `apps/notifications/package.json`**

```json
{
  "name": "notifications",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "wrangler types && tsc --noEmit"
  },
  "dependencies": {
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@types/web-push": "^3.6.4",
    "typescript": "^5.8.3",
    "wrangler": "^4.12.0"
  }
}
```

> **Note:** Do NOT add `@cloudflare/workers-types` — it is legacy. Runtime and binding types come from running `wrangler types` which generates `worker-configuration.d.ts`.

- [ ] **Step 2: Create `apps/notifications/wrangler.json`**

```json
{
  "name": "uoplan-notifications",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-29",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    {
      "binding": "WEBPUSH_SUBSCRIPTIONS",
      "id": "REPLACE_WITH_KV_NAMESPACE_ID"
    }
  ],
  "vars": {
    "VAPID_PUBLIC_KEY": "REPLACE_AFTER_GENERATE",
    "VAPID_SUBJECT": "mailto:matteopolak@hotmail.com"
  },
  "routes": [
    {
      "pattern": "notifications.uoplan.party/*",
      "zone_name": "uoplan.party"
    }
  ]
}
```

- [ ] **Step 3: Create `apps/notifications/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true
  },
  "include": ["src", "worker-configuration.d.ts"]
}
```

> **Note:** `worker-configuration.d.ts` is generated by `wrangler types` and provides all Cloudflare runtime types (KVNamespace, etc.) plus the `Env` interface for your bindings. It does not exist yet — `wrangler types` in the typecheck script generates it.

- [ ] **Step 4: Install dependencies**

```bash
pnpm install
```

(Run from repo root — pnpm workspace picks up `apps/notifications/` automatically.)

- [ ] **Step 5: Commit scaffold**

```bash
git add apps/notifications/
git commit -m "feat(notifications): scaffold Cloudflare Worker project"
```

---

## Task 3: Worker HTTP Handler

All three endpoints in a single fetch handler.

**Files:**
- Create: `apps/notifications/src/index.ts`

- [ ] **Step 1: Write `apps/notifications/src/index.ts`**

```ts
import webpush from 'web-push';

export interface Env {
  WEBPUSH_SUBSCRIPTIONS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  NOTIFY_SECRET: string;
}

const ALLOWED_ORIGINS = ['https://uoplan.party', 'http://localhost:5173'];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

async function endpointKey(endpoint: string): Promise<string> {
  const data = new TextEncoder().encode(endpoint);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sub:${hex}`;
}

async function handleSubscribe(req: Request, env: Env): Promise<Response> {
  const sub = await req.json<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return json(req, 400, { error: 'Invalid subscription' });
  }
  const key = await endpointKey(sub.endpoint);
  await env.WEBPUSH_SUBSCRIPTIONS.put(key, JSON.stringify(sub));
  return json(req, 201, { ok: true });
}

async function handleUnsubscribe(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ endpoint?: string }>();
  if (!body?.endpoint) {
    return json(req, 400, { error: 'Missing endpoint' });
  }
  const key = await endpointKey(body.endpoint);
  await env.WEBPUSH_SUBSCRIPTIONS.delete(key);
  return json(req, 200, { ok: true });
}

async function handleSend(req: Request, env: Env): Promise<Response> {
  if (req.headers.get('Authorization') !== `Bearer ${env.NOTIFY_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { title, body, url } = await req.json<{ title: string; body: string; url: string }>();

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  let sent = 0;
  let failed = 0;
  let cleaned = 0;
  let cursor: string | undefined;
  let listComplete = false;

  while (!listComplete) {
    const list = await env.WEBPUSH_SUBSCRIPTIONS.list({ prefix: 'sub:', cursor });
    cursor = list.cursor ?? undefined;
    listComplete = list.list_complete;

    await Promise.all(
      list.keys.map(async (kvKey) => {
        const subJson = await env.WEBPUSH_SUBSCRIPTIONS.get(kvKey.name);
        if (!subJson) return;
        const subscription = JSON.parse(subJson);
        try {
          await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }));
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await env.WEBPUSH_SUBSCRIPTIONS.delete(kvKey.name);
            cleaned++;
          } else {
            failed++;
          }
        }
      }),
    );
  }

  return new Response(JSON.stringify({ sent, failed, cleaned }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (req.method === 'POST') {
      if (pathname === '/subscribe') return handleSubscribe(req, env);
      if (pathname === '/unsubscribe') return handleUnsubscribe(req, env);
      if (pathname === '/send') return handleSend(req, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/notifications && pnpm typecheck
```

Expected: no errors. If `web-push` types are missing, run `pnpm add -D @types/web-push` in `apps/notifications/`.

- [ ] **Step 3: Start dev server**

```bash
cd apps/notifications && pnpm dev
```

Expected: Wrangler starts on `http://localhost:8787`.

> **Note on `web-push` in Workers:** The `nodejs_compat` flag polyfills `node:crypto` and `node:https`. If `webpush.sendNotification` throws "Cannot find module 'crypto'" or similar, you need to set the `nodejs_compat_v2` flag in `wrangler.json` instead. Change `"compatibility_flags": ["nodejs_compat"]` to `"compatibility_flags": ["nodejs_compat_v2"]` and retry.

- [ ] **Step 4: Test subscribe (with dev server running)**

```bash
curl -s -X POST http://localhost:8787/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"endpoint":"https://test.example.com/push/abc","keys":{"p256dh":"dGVzdA","auth":"dGVzdA"}}'
```

Expected response: `{"ok":true}`, status 201, `Access-Control-Allow-Origin: http://localhost:5173` header present.

- [ ] **Step 5: Test unsubscribe**

```bash
curl -s -X POST http://localhost:8787/unsubscribe \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"endpoint":"https://test.example.com/push/abc"}'
```

Expected: `{"ok":true}`, status 200.

- [ ] **Step 6: Test /send rejects wrong auth**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-token" \
  -d '{"title":"Test","body":"Hello","url":"https://uoplan.party"}'
```

Expected: `401`.

- [ ] **Step 7: Commit**

```bash
git add apps/notifications/src/
git commit -m "feat(notifications): add subscribe/unsubscribe/send Worker endpoints"
```

---

## Task 4: Service Worker + Registration

**Files:**
- Create: `apps/web/public/sw.js`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Create `apps/web/public/sw.js`**

```js
self.addEventListener('push', (event) => {
  const { title, body, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

- [ ] **Step 2: Register SW — modify `apps/web/src/main.tsx`**

Add the service worker registration block after `await initializeI18n()` and before `ReactDOM.createRoot(...)`.

Full file after edit:

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { I18nProvider } from '@lingui/react';
import { theme } from './styles/theme';
import './styles/global.css';
import App from './App';
import { i18n, initializeI18n } from './i18n';

await initializeI18n();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <App />
      </MantineProvider>
    </I18nProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Verify SW registers in dev**

```bash
pnpm dev
```

Open http://localhost:5173 in a browser. Open DevTools → Application → Service Workers. Confirm `sw.js` is listed and status is "activated".

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/sw.js apps/web/src/main.tsx
git commit -m "feat(web): register service worker for push notifications"
```

---

## Task 5: NotificationToggle Component + TermStep Integration

**Files:**
- Create: `apps/web/src/components/steps/NotificationToggle.tsx`
- Modify: `apps/web/src/components/steps/TermStep.tsx`

- [ ] **Step 1: Create `apps/web/src/components/steps/NotificationToggle.tsx`**

```tsx
import { useState } from 'react';
import { Group, Switch, Text, Tooltip } from '@mantine/core';
import { IconBell, IconBellOff } from '@tabler/icons-react';

const WORKER_URL = (import.meta.env.VITE_NOTIFICATIONS_URL as string | undefined) ?? 'https://notifications.uoplan.party';
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';
const LS_KEY = 'uoplan-notifications';

type NotifState =
  | { status: 'disabled' }
  | { status: 'subscribed'; subscription: PushSubscriptionJSON }
  | { status: 'denied' };

function loadState(): NotifState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { status: 'disabled' };
    return JSON.parse(raw) as NotifState;
  } catch {
    return { status: 'disabled' };
  }
}

function saveState(state: NotifState): void {
  if (state.status === 'disabled') {
    localStorage.removeItem(LS_KEY);
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function NotificationToggle() {
  const [state, setState] = useState<NotifState>(loadState);
  const [loading, setLoading] = useState(false);

  if (!('PushManager' in window)) return null;

  const isSubscribed = state.status === 'subscribed';
  const isDenied = state.status === 'denied';

  async function handleEnable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        const next: NotifState = { status: 'denied' };
        saveState(next);
        setState(next);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch(`${WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      const next: NotifState = { status: 'subscribed', subscription: sub.toJSON() };
      saveState(next);
      setState(next);
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (state.status !== 'subscribed') return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();

      await fetch(`${WORKER_URL}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: state.subscription.endpoint }),
      });

      saveState({ status: 'disabled' });
      setState({ status: 'disabled' });
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  const icon = isSubscribed ? <IconBell size={14} /> : <IconBellOff size={14} />;

  return (
    <Group justify="space-between" align="center">
      <Group gap="xs">
        {icon}
        <Text size="sm" c="dimmed">
          Notify me when new terms are added
        </Text>
      </Group>
      <Tooltip
        label="Notifications blocked in browser settings"
        disabled={!isDenied}
        withArrow
      >
        <span>
          <Switch
            checked={isSubscribed}
            disabled={isDenied || loading}
            onChange={isSubscribed ? handleDisable : handleEnable}
            size="sm"
          />
        </span>
      </Tooltip>
    </Group>
  );
}
```

> **Note:** `PushSubscriptionJSON` is a browser built-in TypeScript type. If you see a type error, add `"lib": ["ES2022", "DOM"]` to `apps/web/tsconfig.json` (it should already include `DOM`).

- [ ] **Step 2: Modify `apps/web/src/components/steps/TermStep.tsx`**

Add the import and `<NotificationToggle />` at the bottom of the `Stack`:

```tsx
import { Alert, Select, Stack, Text } from '@mantine/core';
import type { Term } from 'schemas';
import { tr } from '../../i18n';
import { NotificationToggle } from './NotificationToggle';

interface TermStepProps {
  terms: Term[];
  value: string | null;
  onChange: (termId: string) => void;
}

export function TermStep({ terms, value, onChange }: TermStepProps) {
  const data = terms.map((t) => ({ value: t.termId, label: t.name }));

  return (
    <Stack gap="md" data-tour="term-select">
      <Select
        label={tr('termStep.label')}
        placeholder={tr('termStep.placeholder')}
        data={data}
        value={value}
        onChange={(v) => {
          if (!v) return;
          onChange(v);
        }}
        searchable
        size="md"
      />
      <Alert color="blue" variant="light" radius={0}>
        <Text size="sm">{tr('termStep.note')}</Text>
      </Alert>
      <NotificationToggle />
    </Stack>
  );
}
```

- [ ] **Step 3: Typecheck the web app**

```bash
pnpm --filter web typecheck
```

Expected: no errors.

- [ ] **Step 4: Open dev server and verify toggle appears**

```bash
pnpm dev
```

Navigate to http://localhost:5173. Go to Step 1 (Term Selection). Confirm the bell icon and "Notify me when new terms are added" toggle appears at the bottom.

Click the toggle. Confirm the browser permission dialog appears. If you grant it and the `VITE_VAPID_PUBLIC_KEY` is set correctly in `.env.local`, the subscribe call should succeed and the toggle should flip to "on".

- [ ] **Step 5: Verify localStorage state**

In DevTools → Application → Local Storage → `http://localhost:5173`:
Confirm key `uoplan-notifications` has value like:
```json
{"status":"subscribed","subscription":{"endpoint":"https://...","keys":{...}}}
```

After toggling off, confirm the key is removed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/steps/NotificationToggle.tsx apps/web/src/components/steps/TermStep.tsx
git commit -m "feat(web): add notification toggle to term selection step"
```

---

## Task 6: Terms Check Scraper

**Files:**
- Create: `apps/scrapers/src/check_terms.ts`
- Modify: `apps/scrapers/package.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Write the failing test**

Create `apps/scrapers/src/check_terms.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';

function parseTermDropdown(html: string): Array<{ termId: string; name: string }> {
  const $ = cheerio.load(html);
  const select = $('#CLASS_SRCH_WRK2_STRM\\$35\\$');
  const terms: Array<{ termId: string; name: string }> = [];
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

describe('parseTermDropdown', () => {
  it('extracts term IDs and names from a select element', () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value="">Select a term</option>
        <option value="2261">2026 Winter Term</option>
        <option value="2265">2026 Spring/Summer Term</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toEqual([
      { termId: '2261', name: '2026 Winter Term' },
      { termId: '2265', name: '2026 Spring/Summer Term' },
    ]);
  });

  it('skips blank option values', () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value=""> </option>
        <option value="2261">2026 Winter Term</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toEqual([{ termId: '2261', name: '2026 Winter Term' }]);
  });

  it('deduplicates by termId', () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value="2261">2026 Winter Term</option>
        <option value="2261">2026 Winter Term (duplicate)</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toHaveLength(1);
  });

  it('returns empty array when select element is missing', () => {
    expect(parseTermDropdown('<html></html>')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter scrapers test
```

Expected: FAIL — `parseTermDropdown` is not defined yet.

- [ ] **Step 3: Create `apps/scrapers/src/check_terms.ts`**

Export `parseTermDropdown` so the test can import it, then run the main check:

```ts
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
```

- [ ] **Step 4: Update the test to import from the file**

Replace the inline `parseTermDropdown` definition in `check_terms.test.ts` with an import:

```ts
import { describe, it, expect } from 'vitest';
import { parseTermDropdown } from './check_terms.ts';

// ... rest of tests unchanged
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter scrapers test
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Add `check:terms` script to `apps/scrapers/package.json`**

In the `scripts` object, add:
```json
"check:terms": "node src/check_terms.ts"
```

- [ ] **Step 7: Add `check:terms` script to root `package.json`**

In the root `scripts` object, add:
```json
"check:terms": "pnpm --filter scrapers check:terms"
```

- [ ] **Step 8: Run manually to verify output**

```bash
pnpm check:terms
```

Expected: `[]` (no new terms currently). If it prints something like `[{"termId":"2269","name":"2026 Fall Term"}]`, a real new term was detected.

- [ ] **Step 9: Commit**

```bash
git add apps/scrapers/src/check_terms.ts apps/scrapers/src/check_terms.test.ts apps/scrapers/package.json package.json
git commit -m "feat(scrapers): add check:terms script and unit tests"
```

---

## Task 7: GitHub Action — check-new-terms.yml

**Files:**
- Create: `.github/workflows/check-new-terms.yml`

- [ ] **Step 1: Create `.github/workflows/check-new-terms.yml`**

```yaml
name: Check for new terms and notify

on:
  schedule:
    - cron: '0 */4 * * *'
  workflow_dispatch:

permissions:
  contents: read
  actions: write

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 120

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          run_install: false

      - name: Setup Node 24
        uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check for new terms
        id: check_terms
        run: |
          NEW_TERMS=$(pnpm check:terms 2>/dev/null)
          echo "new_terms=$NEW_TERMS" >> "$GITHUB_OUTPUT"
          echo "New terms detected: $NEW_TERMS"

      - name: Exit early if no new terms
        if: steps.check_terms.outputs.new_terms == '[]'
        run: |
          echo "No new terms found. Nothing to do."

      - name: Trigger daily scrape
        if: steps.check_terms.outputs.new_terms != '[]'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          BEFORE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
          echo "Dispatching daily-scrape.yml at $BEFORE"
          gh workflow run daily-scrape.yml

          # Wait for the run to appear in the API
          echo "Waiting for run to appear..."
          sleep 20

          for i in $(seq 1 24); do
            RUN_ID=$(gh run list --workflow=daily-scrape.yml --limit=5 \
              --json createdAt,databaseId \
              --jq "[.[] | select(.createdAt > \"$BEFORE\")] | .[0].databaseId // empty")
            if [ -n "$RUN_ID" ]; then
              echo "Found triggered run: $RUN_ID"
              echo "SCRAPE_RUN_ID=$RUN_ID" >> "$GITHUB_ENV"
              break
            fi
            echo "Run not yet visible (attempt $i/24), retrying in 5s..."
            sleep 5
          done

          if [ -z "$SCRAPE_RUN_ID" ]; then
            echo "::error::Could not locate the triggered daily-scrape run"
            exit 1
          fi

      - name: Wait for daily scrape to complete
        if: steps.check_terms.outputs.new_terms != '[]'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "Waiting for run $SCRAPE_RUN_ID to complete..."
          while true; do
            RESULT=$(gh run view "$SCRAPE_RUN_ID" --json status,conclusion)
            STATUS=$(echo "$RESULT" | jq -r '.status')
            CONCLUSION=$(echo "$RESULT" | jq -r '.conclusion')
            echo "  status=$STATUS conclusion=$CONCLUSION"
            if [ "$STATUS" = "completed" ]; then
              if [ "$CONCLUSION" != "success" ]; then
                echo "::error::daily-scrape run $SCRAPE_RUN_ID ended with conclusion: $CONCLUSION"
                exit 1
              fi
              echo "daily-scrape completed successfully"
              break
            fi
            sleep 60
          done

      - name: Get HEAD SHA after scrape push
        if: steps.check_terms.outputs.new_terms != '[]'
        run: |
          NEW_SHA=$(git ls-remote origin main | cut -f1)
          echo "NEW_SHA=$NEW_SHA" >> "$GITHUB_ENV"
          echo "HEAD after scrape: $NEW_SHA"

      - name: Wait for Cloudflare Pages build
        if: steps.check_terms.outputs.new_terms != '[]'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          TIMEOUT=600
          START=$(date +%s)
          echo "Polling CF Pages check-run for commit $NEW_SHA (timeout ${TIMEOUT}s)..."

          while true; do
            ELAPSED=$(( $(date +%s) - START ))
            if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
              echo "::error::Timed out after ${TIMEOUT}s waiting for Cloudflare Pages build"
              exit 1
            fi

            # Look for a check whose name contains "cloudflare" or "pages" (case-insensitive)
            CHECK=$(gh api "repos/$GITHUB_REPOSITORY/commits/$NEW_SHA/check-runs" \
              --jq '[.check_runs[] | select(.name | test("cloudflare|pages"; "i"))] | .[0] | {status: .status, conclusion: .conclusion}' \
              2>/dev/null || echo '{}')

            CF_STATUS=$(echo "$CHECK" | jq -r '.status // "not_found"')
            CF_CONCLUSION=$(echo "$CHECK" | jq -r '.conclusion // "null"')

            echo "  CF Pages: status=$CF_STATUS conclusion=$CF_CONCLUSION (${ELAPSED}s elapsed)"

            if [ "$CF_STATUS" = "completed" ]; then
              if [ "$CF_CONCLUSION" = "success" ]; then
                echo "Cloudflare Pages build succeeded"
                break
              else
                echo "::error::Cloudflare Pages build ended with: $CF_CONCLUSION"
                exit 1
              fi
            fi

            sleep 30
          done

      - name: Send push notifications
        if: steps.check_terms.outputs.new_terms != '[]'
        env:
          NOTIFY_SECRET: ${{ secrets.NOTIFY_SECRET }}
          NEW_TERMS: ${{ steps.check_terms.outputs.new_terms }}
        run: |
          echo "$NEW_TERMS" | jq -c '.[]' | while IFS= read -r term; do
            TERM_NAME=$(echo "$term" | jq -r '.name')

            PAYLOAD=$(jq -n \
              --arg title "uoplan — New Term Available" \
              --arg body "$TERM_NAME is now on uoplan. Start planning your schedule!" \
              --arg url "https://uoplan.party" \
              '{title: $title, body: $body, url: $url}')

            echo "Sending notification for: $TERM_NAME"
            HTTP_CODE=$(curl -s -o /tmp/notif_response.json -w "%{http_code}" \
              -X POST "https://notifications.uoplan.party/send" \
              -H "Content-Type: application/json" \
              -H "Authorization: Bearer $NOTIFY_SECRET" \
              -d "$PAYLOAD")

            echo "  HTTP $HTTP_CODE: $(cat /tmp/notif_response.json)"

            if [ "$HTTP_CODE" != "200" ]; then
              echo "::warning::Notification request returned HTTP $HTTP_CODE"
            fi
          done
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/check-new-terms.yml
git commit -m "feat(ci): add check-new-terms workflow with WebPush notification"
```

---

## Task 8: Deploy Worker + Add Custom Domain

- [ ] **Step 1: Verify `wrangler.json` has the real KV ID and VAPID public key**

Open `apps/notifications/wrangler.json`. Both `REPLACE_WITH_KV_NAMESPACE_ID` and `REPLACE_AFTER_GENERATE` must be replaced with real values from Task 1 before deploying.

- [ ] **Step 2: Deploy**

```bash
cd apps/notifications && pnpm deploy
```

Expected: output like `Deployed uoplan-notifications to ... (1.23 sec)`.

- [ ] **Step 3: Add custom domain in Cloudflare Dashboard**

1. Go to Workers & Pages → `uoplan-notifications`
2. Settings → Triggers → Custom Domains
3. Add `notifications.uoplan.party`

Wait ~30 seconds for DNS propagation.

- [ ] **Step 4: Verify live subscribe endpoint**

```bash
curl -s -X POST https://notifications.uoplan.party/subscribe \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://test.invalid/push/verify","keys":{"p256dh":"dGVzdA","auth":"dGVzdA"}}'
```

Expected: `{"ok":true}`, status 201.

- [ ] **Step 5: Verify live unsubscribe endpoint**

```bash
curl -s -X POST https://notifications.uoplan.party/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://test.invalid/push/verify"}'
```

Expected: `{"ok":true}`, status 200.

- [ ] **Step 6: Full end-to-end browser test**

1. Open https://uoplan.party (after the Cloudflare Pages deploy picks up the frontend changes — this happens after the branch is merged)
2. Go to Step 1 — term selection
3. Click the notification toggle → grant browser permission
4. Confirm `uoplan-notifications` key appears in DevTools → Application → Local Storage
5. Use `wrangler kv key list --binding WEBPUSH_SUBSCRIPTIONS` to confirm a `sub:...` key was stored in KV
6. Click toggle again (disable) → confirm localStorage key is removed and KV entry is deleted

- [ ] **Step 7: Test notification send (with real subscription in KV)**

```bash
curl -s -X POST https://notifications.uoplan.party/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_NOTIFY_SECRET>" \
  -d '{"title":"uoplan — Test Notification","body":"This is a test push.","url":"https://uoplan.party"}'
```

Expected: `{"sent":1,"failed":0,"cleaned":0}` and a push notification appears in the browser.

- [ ] **Step 8: Commit any final tweaks and push**

```bash
git push origin main
```

---

## Task 9: Test GitHub Action (Dry Run)

- [ ] **Step 1: Manually trigger the workflow**

```bash
gh workflow run check-new-terms.yml
```

Since no real new terms exist, the job should exit early with "No new terms found."

- [ ] **Step 2: Confirm early exit**

```bash
gh run list --workflow=check-new-terms.yml --limit=1
```

View the run. Confirm step "Exit early if no new terms" ran and subsequent steps were skipped.

- [ ] **Step 3: Simulate a new term (optional)**

To test the full notification path without waiting for a real new term, temporarily modify `apps/web/public/data/terms.json` locally (don't commit) to remove a real term from the list. Run `pnpm check:terms` — it should now output a non-empty JSON array. Restore the file.

The GitHub Action's real-world trigger will fire the first time uOttawa adds a new term to their search page that isn't in `terms.json`.

---

## Verification Checklist

- [ ] Worker deployed and reachable at `https://notifications.uoplan.party`
- [ ] `/subscribe` stores entry in KV, returns 201
- [ ] `/unsubscribe` removes KV entry, returns 200
- [ ] `/send` with wrong auth returns 401
- [ ] `/send` with correct auth delivers a push notification to subscribed browser
- [ ] Toggle in Step 1 shows when `PushManager` is available, hidden when not
- [ ] Toggle correctly shows "denied" state (disabled with tooltip) when permission is blocked
- [ ] `localStorage` key `uoplan-notifications` is set on subscribe and removed on unsubscribe
- [ ] No Worker requests on page load
- [ ] `pnpm check:terms` returns `[]` when no new terms exist
- [ ] `check-new-terms.yml` workflow exits early when `pnpm check:terms` returns `[]`
- [ ] Workflow correctly dispatches `daily-scrape.yml` when new terms are detected
