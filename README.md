# Branchframe

React + TypeScript + Vite frontend for a traceable creative workflow.

## Development

Requires Node.js 22.12+ (Node.js 24 recommended) and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

PowerShell: use `Copy-Item .env.example .env` and `npm.cmd` if scripts are restricted.
The development page runs at http://localhost:5173.

## API configuration

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_USE_MOCK_API=true
```

Mock mode uses MSW to intercept HTTP requests before React starts. The page labels
mock mode explicitly. Mock endpoints include GET /health, GET/POST /projects,
and GET /projects/:id. Solara uses the canonical seed IDs. Creation offers blank
projects; full demo cloning arrives with the associated domain fixtures.
Brief mocks support revision list/latest/detail/create with immutable history.
Direction mocks support list/detail/create/clone, immutable revisions, attribute
diff, activation with decisions, and concurrency-checked metadata PATCH.
Unimplemented API calls in mock mode fail rather than reach a real backend.
The service worker is checked in at public/mockServiceWorker.js.

To connect the backend, set VITE_USE_MOCK_API=false and restart Vite. When the
variable is absent, the app uses the real API. The backend must allow the web
origin with credentials and expose the headers listed in the contract.

All requests use one client with credentials: include, request IDs, runtime
schema validation, structured errors, abort/timeout support, repeated query
filters, and optional idempotency keys. Assessment creation requires a key.
The caller creates one key per user intent and reuses it on retry. The client
never retries writes automatically. HTTP errors expose field details and
Retry-After to future feature forms.

On boot the app checks GET /health. A malformed response or incompatible
contract major version blocks the workspace with a visible error and retry.
Provider keys and server secrets must never use a VITE_ variable.

## Checks

```sh
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run preview
```

Tests cover schema/contract field parity, HTTP mock health, error envelopes,
idempotency headers, repeated filters, timeout/cancellation, network failure,
unknown response fields, and the boot compatibility gate.

## Current scope

Integration foundation, project list/search/status filters/sorting, blank-project
creation, and Project Home are implemented. The overview reads the summary API,
shows the active direction and exact revision, server-provided asset/review/stale
counts, the latest assessment (with Simulated label when applicable), and recent
human decisions. New blank projects show empty states. Mock writes survive navigation
and reset on reload. Creation reuses its intent key on retry and prevents duplicate
submissions. Other screens, persistence, the assessment workflow, and real backend
integration are not implemented yet. The browser smoke test checks opening Solara,
focus navigation, and viewport overflow at desktop and phone widths using installed
Microsoft Edge. The full product E2E scenario arrives with subsequent features.

Brief is available from Project Home via View brief. Users can inspect the latest
brief and older revisions, create the first brief, or save a new revision with a
change summary. Forms include structured required/forbidden attributes, lists,
and source text. Saved revisions are never edited in place. Markdown displays as
plain text. Viewer/unknown roles see read-only controls. Failed forms retain input.
Brief writes have no contract idempotency support; after a network failure, check
history before resubmitting. The browser test verifies old brief content remains
unchanged after creating a revision, at desktop and phone widths.

Creative Directions is available through Manage directions on Project Home.
Create a direction, clone a selected revision, inspect revision history, compare
two revisions, and activate an exact revision with a recorded reason. Saving a
revision never activates it. Project Home resolves the pinned active revision and
shows the activation decision. Comparisons are deterministic and network-local
in mock mode; no AI is called. Browser tests cover revision creation, comparison,
activation dialog Escape/focus behavior, and Project Home synchronization.

Reference Board supports URL registration, permission notes, attributes with
provenance/review status, metadata conflicts, archive/restore, and links to exact
direction revisions, assets and asset versions. Sources are never fetched during
registration. Upload and AI analysis are deferred.

Asset Library is available through View assets on Project Home. Search/filter/sort
the asset grid, inspect detail and newest-first version summaries, create logical
asset records, edit metadata and logical statuses, and archive/restore without
altering existing versions. Asset creation uses an idempotency key. Linked
reference notes and rights are read from the API; Project Home counts reflect
mock asset mutations. Storage uploads and version approval decisions are
scheduled for subsequent features. Local demo images are
procedurally drawn placeholders. Browser tests cover these workflows at desktop
and phone widths.

Asset version inspection and comparison are now available within asset detail.
Inspect exact IDs, prompts/settings, recorded attributes, file metadata, lineage,
reference notes and collection pins. Create a derived or independent version
using a file URL or explicit metadata-only mode. The form preserves drafts on
failure and reuses an unchanged creation intent key. Old approval states and pins
remain attached to the old version; newest-first history includes the appended
version. Uploads, AI generation and version review decisions remain deferred.

Requirements: branchframe_prd_trd_erd.md. Frontend guidance: SOUL.md.
Wire contract: INTEGRATION_CONTRACT.md. Assumptions and gaps:
INTEGRATION_NOTES.md. Shared Zod schemas: packages/contracts/src/index.ts.
English UI copy is centralized in src/copy/en.ts and feature copy modules.

## Git workflow

Complete one feature, run relevant checks, commit, and push directly to
origin/main as requested by the project owner. Never force push or commit secrets.
Each feature report includes a recommendation for the next task.
