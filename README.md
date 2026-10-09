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
mock mode explicitly. The current mock endpoint is GET /health; feature handlers
and section 9 project fixtures will be added with their corresponding features.
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
npm run preview
```

Tests cover schema/contract field parity, HTTP mock health, error envelopes,
idempotency headers, repeated filters, timeout/cancellation, network failure,
unknown response fields, and the boot compatibility gate.

## Current scope

Integration foundation and the initial compatibility screen are implemented.
The product screens, project fixtures, persistence, assessment workflow, and
real backend integration are not implemented yet. Browser visual checks and
the full product E2E scenario are scheduled with subsequent features.

Requirements: branchframe_prd_trd_erd.md. Frontend guidance: SOUL.md.
Wire contract: INTEGRATION_CONTRACT.md. Assumptions and gaps:
INTEGRATION_NOTES.md. Shared Zod schemas: packages/contracts/src/index.ts.
English UI copy is centralized in src/copy/en.ts.

## Git workflow

Complete one feature, run relevant checks, commit, and push directly to
origin/main as requested by the project owner. Never force push or commit secrets.
Each feature report includes a recommendation for the next task.
