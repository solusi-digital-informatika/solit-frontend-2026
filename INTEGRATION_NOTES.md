# Frontend integration notes

Contract version: 1.0.0
Contract SHA-256: EA050C8AA413FC56E60E6676336754132624F4CD6A0EB776930718A1CC3150B2

## Assumptions

- Locked decisions and open-question defaults are used as requested for implementation.
- Mock API is enabled explicitly by VITE_USE_MOCK_API=true; when absent, real API mode is used.
- Responses are schema-validated in every build; development diagnostics contain paths/request IDs, never raw payloads.
- Foundation provides the health mock only. Feature fixtures and endpoints are added with each feature using the fixed IDs in contract section 9.
- Schema exports use the documented type name plus Schema (e.g. ProjectSchema) and inferred type Project.
- API requests time out after 15 seconds unless overridden; mutations are never automatically retried.

## Proposed contract changes

- None.

## Known gaps

- Product screens, seeded project fixtures, mutation handlers, and feature-specific tests are scheduled for subsequent features.
- Canonical enum schemas are strict. Unknown-enum display handling will be implemented with the status components before those screens ship.
- Backend integration has not been exercised; current verification uses MSW.

## Verification

Run npm run test, npm run lint, npm run typecheck, and npm run build.
