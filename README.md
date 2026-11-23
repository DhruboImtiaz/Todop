# Todop — a little direction for your everyday

Todop is a personal planner for daily tasks and longer projects. Organize work with recurring tasks, a monthly calendar, and project roadmaps. Use a device-only planner or sign in to sync a personal planner across devices and collaborate in shared workspaces.

[Open Todop](https://todop7.netlify.app/)

## Run locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. The installed app starts at `/app`.

| Route | Opens |
| --- | --- |
| `/` | Homepage with the interactive sample planner |
| `/app` | Upcoming and undated tasks |
| `/projects`, `/calendar`, `/search`, `/settings` | Planner views and preferences |
| `/demo` | Full sample planner with its own browser storage |
| `/auth`, `/workspaces` | Account sign-in or shared workspaces |

Copy [`.env.example`](.env.example) to `.env.local` to connect your own Supabase project. Todop uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, which are exposed to the browser. Use a publishable key for the browser client.

## Try the demo

The homepage preview uses the same sample tasks across Upcoming, Projects, Calendar, and Roadmap. Mark the design review done in **Upcoming** to update the Studio refresh progress in **Projects** and unblock its milestone in **Roadmap**. Select a date in **Calendar** to see its deadlines. **Workspaces** shows a sample team and links to sign-in.

The full demo at `/demo` has its own `todop_demo_v2` browser store. Use **Reset demo** to refresh the sample tasks, projects, repeat rules, and recently deleted entry.

## Project roadmaps and shared workspaces

- Open a project and choose **Roadmap** to see tasks in deadline order. In **Roadmap settings**, mark a dated task as a milestone or select prerequisites from the same project. Unfinished prerequisites block a task. A task is at risk when its own deadline has passed or an unfinished prerequisite is due after it.
- Signed-in users can open **Shared workspaces** from Projects. Create a workspace and generate a single-use link under **Members and invitations**. Invites expire after seven days and owners can revoke them. Collaborators sign in to accept an invite and can leave the workspace. Owners can remove collaborators.
- Shared workspaces keep tasks and roadmaps separate from personal planners. Shared edits require a connection. The database checks membership and uses revision numbers to prevent conflicting writes from silently overwriting shared changes.

## Planning and recovery

- **Recurring tasks:** daily, weekly, monthly, or a custom interval from 1 to 365. Completing a recurring task archives that occurrence and creates one future occurrence with fresh subtasks. Missed dates are skipped rather than creating a backlog. Local wall-clock time is preserved; short months clamp to their last day and later months return to the original day.
- **Undo:** completion, reopening, and deletion offer a 12-second undo action. Undo checks for newer edits before changing an occurrence.
- **Recently deleted:** tasks and their subtasks can be restored for 30 days. A deleted project is not recreated on restore. Expired entries disappear immediately and are pruned on the next successful write.

## Authentication

Email/password sign-in, account creation with email confirmation, password reset, recovery completion, persisted sessions, and sign-out are implemented. Email confirmation stays enabled. The dashboard Site URL is `https://todop7.netlify.app/auth`; the permitted callbacks are:

- `https://todop7.netlify.app/auth**`
- `http://localhost:5173/auth**`
- `http://127.0.0.1:4173/auth**`

Add a narrowly scoped callback if using a different development port or deployment domain.

**Email delivery remains in testing mode, at the owner's request.** The default Supabase sender sends only to organization team email addresses and has a low sending limit. Public confirmation and password-reset delivery require [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Configure it in Supabase, never in the browser. Leaked-password protection is currently disabled in the project; the security advisor flags this setting.

## Offline editing, sync, and backups

`PlannerRepository` owns task validation, completion semantics, subtasks, project ordering/deletion, settings, and imports. Its local and Supabase adapters share these rules. UI components depend on the `StorageRepository` interface, including a stable snapshot and change subscription.

- Signed-out work uses `todop_app_data_v2` browser storage. On first use, version 1 device data is copied into version 2 without modifying the original copy. The service worker precaches the complete app shell for offline device editing.
- Signed-in personal planners use `public.planner_workspaces`, keyed by `auth.users.id`. Each row stores a versioned planner snapshot and a revision counter, preserving project and task relationships through backup and restore.
- RLS allows authenticated users to select, insert, and update only their own row. Signed-out access is revoked. Ownership changes are checked on updates. The indexed primary key supports owner lookup.
- Open your signed-in planner online once on each device. Subsequent edits save to that account's browser storage, survive offline reload, and sync when Todop is open and connected. Pending changes stay on the device until they sync. Guest data is kept separate.
- Same-browser tabs coordinate writes. Sync checks the cloud revision and combines independent changes. When the same task changes on both devices, Todop pauses sync and keeps the device changes available for export before you choose the cloud version.
- Settings offers **Copy device planner to account** for an empty cloud workspace. For an existing account, export a guest backup and use the explicit restore confirmation. Device copies remain available after sign-out.
- Use **Backup & Restore** in Settings to export or replace a personal planner. Restore validates the file, requires confirmation, and pauses if the cloud planner changed in the meantime. Malformed local data is retained under `todop_app_data_v2_recovery` before starting a fresh schema.

Snapshot version 3 stores milestones and task dependencies. Version 1 and 2 backups remain importable.

## Verification

```sh
npm test
npm run lint
npm run build
npx playwright install chromium webkit  # once
npm run test:e2e
```

The production build includes TypeScript checks and generates the service worker. Browser tests run against the production build and Netlify script policy in Chromium and WebKit. They cover scheduling, projects, calendar, search, reloads and restores offline, PWA updates, and stable homepage tab switches across phone and desktop widths.

Account-flow browser tests simulate Supabase HTTP responses. They cover an offline reload with an expired token, reconnection and recurring task sync across two browser contexts, a lost response after a cloud save, and conflicting edits. The roadmap tests check offline reload and dependency cycle rejection. The shared-workspace tests cover accepting an invite after sign-in, editing a project across two accounts, and losing access after removal.

Run the access policy test against a local Supabase database after applying the migrations. The test transaction rolls back.

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/team_workspace_access.sql
```

## Deployment

Apply the [project roadmaps and team workspaces migration](supabase/migrations/20261118061236_project_roadmaps_and_team_workspaces.sql) to the deployment database before releasing the frontend. It adds the team access policies and lets the personal planner store version 3 snapshots.

Netlify builds with `npm run build` and publishes `dist`. The SPA redirect serves deep links such as `/workspaces`. The service worker activates an update once existing app tabs close.
