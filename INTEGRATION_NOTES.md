# Frontend integration notes

Contract version: 1.0.0
Contract SHA-256: EA050C8AA413FC56E60E6676336754132624F4CD6A0EB776930718A1CC3150B2

## Assumptions

- Locked decisions and open-question defaults are used as requested for implementation.
- Mock API is enabled explicitly by VITE_USE_MOCK_API=true; when absent, real API mode is used.
- Responses are schema-validated in every build; development diagnostics contain paths/request IDs, never raw payloads.
- Mock handlers cover health and project list/read/create (BLANK); Solara uses the fixed project/user/active-revision IDs in section 9.
- Project creation offers BLANK only. DEMO_SOLARA cloning is withheld until the associated direction, asset, and collection fixtures exist; the mock currently returns a validation error for that unavailable template.
- Mock project writes stay in memory until reload; list/detail navigation preserves them. The UI labels this limitation explicitly.
- Project URLs use #/projects/:projectId so detail navigation requires no hosting rewrite.
- Project response views accept unknown status/role strings with a generic display fallback; canonical fixtures remain strict.
- Project Home uses only GET /projects/:id/summary. Counts and stale/review indicators are displayed verbatim; the mock response fixture has 4 assets (3 APPROVED, 1 DRAFT), no assessment, no recent decisions, and active Cold Industrial revision 1.
- Seed palette hex codes and unspecified direction attributes remain null/empty; no inferred metadata is presented as confirmed source data.
- Blank project summaries contain no active direction, assets, assessment, or decisions.
- Schema exports use the documented type name plus Schema (e.g. ProjectSchema) and inferred type Project.
- API requests time out after 15 seconds unless overridden; mutations are never automatically retried.

## Proposed contract changes

- None.

## Known gaps

- Product screens, seeded project fixtures, mutation handlers, and feature-specific tests are scheduled for subsequent features.
- Project unknown-enum handling is implemented; other feature status components will add equivalent handling before shipping.
- Backend integration has not been exercised; current verification uses MSW.

## Verification

Run npm run test, npm run lint, npm run typecheck, npm run build, and npm run test:e2e.
Browser smoke tests use installed Microsoft Edge (Playwright channel msedge) at desktop and phone widths. Install Edge or adjust the test channel if it is unavailable on another machine.
