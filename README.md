# Todop — a little direction for your everyday

A React and TypeScript planner with an animated product front page, tasks and subtasks, projects, monthly calendar, archive search, appearance settings, offline device storage, and a private Supabase workspace for signed-in users.

## Run locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. `/` is the front page; `/app` opens the planner; `/auth` opens sign-in. Existing `/projects`, `/calendar`, `/search`, and `/settings` links still work. The installed PWA starts at `/app`.

The official Supabase client is pinned in `package.json` and the lockfile. The client defaults to the requested Todop project (`awfcntpziyorwiigqmel`), using its browser-safe publishable key. Copy `.env.example` to `.env.local` to override the project. Never put a service-role or secret key in a `VITE_` variable.

## Authentication

Email/password sign-in, account creation with email confirmation, password reset, recovery completion, persisted sessions, and sign-out are implemented. Email confirmation stays enabled. The dashboard Site URL is `https://todop7.netlify.app/auth`; the permitted callbacks are:

- `https://todop7.netlify.app/auth**`
- `http://localhost:5173/auth**`
- `http://127.0.0.1:4173/auth**`

Add a narrowly scoped callback if using a different development port or deployment domain.

**Email delivery remains in testing mode, at the owner's request.** The default Supabase sender sends only to organization team email addresses and has a low sending limit. Public confirmation and password-reset delivery require [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Configure it in Supabase, never in the browser. Leaked-password protection is currently disabled in the project; the security advisor flags this setting.

## Storage and data ownership

`PlannerRepository` owns task validation, completion semantics, subtasks, project ordering/deletion, settings, and imports. Its local and Supabase adapters share these rules. UI components depend on the `StorageRepository` interface, including a stable snapshot and change subscription.

- Signed-out work uses the existing `todop_app_data_v1` browser storage. The service worker precaches the complete app shell for offline device editing.
- Signed-in work uses `public.planner_workspaces`, keyed by `auth.users.id`. Each row contains the existing versioned planner JSON shape and a revision counter. This preserves atomic backup/restore and project/task relationships. It is intended for a personal planner, not large shared workspaces.
- RLS allows authenticated users to select, insert, and update only their own row. Signed-out access is revoked. Ownership changes are checked on updates. The indexed primary key supports owner lookup.
- Same-instance writes are serialized. Cloud writes use revision compare-and-swap so another device's in-flight edit cannot be silently overwritten. Forms also reject saving over changed task fields. Cloud data refreshes every 30 seconds while visible and on window focus/reconnection.
- Cloud editing requires a connection. Failed writes leave the accepted snapshot intact and display an error. Guest data is never automatically uploaded, replaced, or mixed with an account.
- Settings offers **Copy device planner to account** for an empty cloud workspace. For an existing account, export a guest backup and use the explicit restore confirmation. Device copies remain available after sign-out.
- Malformed local data is retained under `todop_app_data_v1_recovery` before starting a fresh schema. Imports reject unsupported versions, invalid dates, duplicate IDs, and missing project references.

The migrations in `supabase/migrations/` have been applied to the specified hosted project; their versions match its migration history. On a different project, apply both migrations with your authenticated Supabase migration workflow. Creating a new account lazily creates its empty workspace; no privileged signup trigger is needed.

## Verification

```sh
npm test
npm run lint
npm run build
npx playwright install chromium webkit  # once
npm run test:e2e
```

The production build includes TypeScript checks and generates the service worker. Browser tests run against the production build and Netlify script policy in Chromium and WebKit. They cover scheduling, calendar, project deletion, subtasks, search, offline use, restore failures, worker upgrades, responsive landing-page interactions, account entry, confirmation/reset messages, simulated cloud saves/failures, and sign-out isolation.

Account-flow browser tests simulate Supabase HTTP responses; they do not create real accounts or send emails. Live checks verified the hosted schema, ownership policies, grants, auth settings, and rejection of signed-out Data API requests. Live signed-in CRUD and email delivery still need an approved test account; automatic approval review rejected creating synthetic users directly in the hosted auth schema.

## Deployment

The existing Netlify configuration builds with `npm run build` and publishes `dist`. SPA redirects support the new routes. No server runtime is required. Production hosting currently uses [todop7.netlify.app](https://todop7.netlify.app/).

Repository changes are prepared for review separately from the live Supabase migrations and auth URL settings. Deploy the reviewed branch through the existing Netlify workflow. The service worker activates a new build after existing app tabs close; reopen old installed tabs to receive the update.
