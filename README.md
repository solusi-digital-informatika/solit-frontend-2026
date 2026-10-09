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
VITE_API_BASE_URL=https://api.solit.my.id/api/v1
VITE_USE_MOCK_API=false
```

The default configuration connects to [the backend API documentation](https://api.solit.my.id/docs) with the `/api/v1` prefix. Open development at `http://localhost:5173`; the deployed backend accepts that origin and rejects `http://127.0.0.1:5173`. Restart Vite after changing `.env`. Production hosting must be allowed by backend CORS as well.

Set `VITE_USE_MOCK_API=true` for offline demo work. Mock mode uses MSW to intercept HTTP requests before React starts. The page labels
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

`npm run test:live` runs an opt-in read-only contract and browser smoke test against the deployed backend, with MSW disabled. It opens the completed feature pages and exact version detail without creating projects, assets, assessments or decisions. Live writes remain subject to backend authorization and provider settings.

On machines with limited resources, run checks sequentially and use
`npm run test -- --maxWorkers=2` and `npm run test:e2e -- --workers=2`.

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
submissions. Additional feature screens are described below; mock data remains
session-local and resets on reload. The browser smoke test checks opening Solara,
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

Impact Assessment & Impact Map is available through View impact map on Project
Home. Compare exact direction/brief revisions, assess the latest non-archived
versions or select historical version IDs, inspect prioritized recommendations
and evidence, filter results, and open the exact evaluated version. Counts and
recommendations come from the API. Pending/running reads use bounded polling;
failed runs support explicit retry or rules-only fallback, and running runs can
be cancelled. No mutation is retried automatically.

The mock provider completes inline with a visible Simulated label and no image
inspection. Cold Industrial to Warm Organic reproduces the documented Solara
outcomes; other scopes conservatively require human review. This is a demo
fixture, not a general compatibility engine. Human decisions and overrides are available on completed assessment items.
Accept, override, dismiss or defer with a recorded rationale and selected next
action. New decisions supersede earlier records without changing the original
recommendation or asset/version approvals and pins. Inspect full/current-only
history within the assessment or through View decisions on Project Home; filter
by type and exact record IDs. Unconfirmed saves preserve the draft and never
retry automatically. Deferred items remain unresolved.

Collections & Review is available through View collections on Project Home.
Create collections with exact version pins, inspect revisions and newer-version
indicators, and create drafts that copy the original pins. Draft items support
ordering, notes, removal and explicit same-asset version replacement with a
rationale. Submit for review, approve or request changes/reject with recorded
comments. Approved revisions freeze their pins; later approval supersedes the
previous revision without changing its history or approving asset versions.
Collection metadata supports conflict comparison and archive/restore.

Activity Log & Export is available through View activity & export on Project Home.
Apply server filters by event, local date range, actor and entity IDs; load further
pages, inspect actor/timestamp/request IDs, and refresh recorded history. Unknown
event types render a generic label, and only known metadata fields are shown.
All known project roles, including viewers, can create JSON, Markdown or CSV
exports. Review API warnings and download the returned file. JSON includes full
historical versions, assessments, decision supersession and exact collection pins;
Markdown summarizes the project; CSV lists each asset's latest version. The mock
serializer removes resolved media URLs, credential fields and signed URLs, warns
about local demo paths/metadata-only versions, and protects CSV cells from formula
execution. Export writes are never retried automatically. Live serialization and
redaction remain backend responsibilities. Activity reads were verified against
the deployed backend; live export writes have not been exercised.

Requirements: branchframe_prd_trd_erd.md. Frontend guidance: SOUL.md.
Wire contract: INTEGRATION_CONTRACT.md. Assumptions and gaps:
INTEGRATION_NOTES.md. Shared Zod schemas: packages/contracts/src/index.ts.
English UI copy is centralized in src/copy/en.ts and feature copy modules.

## Git workflow

Complete one feature, run relevant checks, commit, and push directly to
origin/main as requested by the project owner. Never force push or commit secrets.
Each feature report includes a recommendation for the next task.
