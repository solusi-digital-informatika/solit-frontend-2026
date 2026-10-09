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
- Newly created blank project summaries contain no active direction, assets, assessment, or decisions; asset counts update as logical records are created.
- Brief handlers cover list/latest/detail/create and cursor pagination. The seed brief uses ID …0020; its unspecified wording is fictional demo copy, not an inferred client brief.
- Brief creation appends an immutable revision. UI sends every documented input field, preserves requirement IDs, and generates UUIDs for new attributes; the mock also assigns IDs when omitted.
- Revision >1 requires a change summary. A new revision form always starts from the API's latest brief, even when a historical revision is being viewed.
- Brief POST has no documented idempotency support, so the client prevents simultaneous submissions but never automatically retries ambiguous failed writes. The form directs users to check history after network/timeout failure.
- Source Markdown is displayed as plain text. No extraction, HTML rendering, or AI analysis occurs.
- Brief creation controls require a known OWNER/REVIEWER/EDITOR role; unknown roles and VIEWER are read-only.
- Creative Directions mocks provide list/detail/create/clone, revisions, deterministic diff, audited activation, and metadata PATCH with expectedUpdatedAt checks.
- Warm Organic uses …0040/…0041 from section 9. Directions and immutable revisions have separate mock storage; the project pointer resolves the exact active revision even when a newer revision exists.
- Creation, revision, and activation write mock activity records; activation also writes a CHANGE_DIRECTION decision visible in Project Home. The activity screen is a later feature.
- Metadata PATCH emits DIRECTION_METADATA_UPDATED as a generic eventType string (ActivityEvent explicitly permits unknown strings); reconcile this event label with the backend before the Activity Log feature.
- Mock diff compares recorded attribute groups only, without AI interpretation. The UI displays the server's differences and does not compute them.
- Direction history is read through cursor pagination. Forms preserve prior requirement IDs, source attributes, and nullable metadata; clones receive new direction/revision identities.
- Direction/revision/activation POST has no contract idempotency support. In-flight duplicate submissions are prevented; failed writes are never automatically retried.
- Collection handlers and version review/status decisions are not implemented yet. Their invariants must be rechecked once those feature slices and the real backend are available; current tests verify brief, asset metadata, version content, lineage, seeded pins and count stability.
- Reference Board uses #/projects/:projectId/references and the reference list/detail/metadata/attribute/link endpoints in section 6.7. It supports server filters, cursor pagination, URL registration, editing, archive/restore, and links to exact direction revisions, assets, and asset versions.
- Reference fixtures use section 9 IDs …0080/…0081. The local JPGs are procedural demo textures created for this repository, with visible source and permission notes; they are not third-party photography. PUBLIC_URL registration never fetches the source or creates an image preview.
- File upload/storage integration and P1 AI analysis are deferred; the registration form explicitly describes the supported URL flow. AI-inferred attributes returned by the backend retain their origin and show their separate review status.
- Reference metadata PATCH uses expectedUpdatedAt. Conflict handling retains the draft and loads the latest metadata for comparison before explicit resubmission. Attribute/link writes are confirmed by the API before display; mutations are never automatically retried.
- Reference editing requires a known OWNER/REVIEWER/EDITOR role; unknown roles and VIEWER are read-only. Real authorization remains the backend's responsibility.
- Solara asset and version-summary fixtures (…0050–…0053, …0060–…0064) are shared by Asset Library and Reference Board. Linking does not mutate asset or direction records. New logical asset IDs can be linked immediately and asset detail reflects reference link additions/removals.
- Reference mutations append canonical mock activity events in memory. The activity feed endpoint and screen remain a later feature.
- Asset Library uses #/projects/:projectId/assets and deep links at #/projects/:projectId/assets/:assetId. Library filters remain in place when returning from a detail screen within the same mounted project workspace.
- Asset handlers implement section 6.6 list/detail, metadata-only logical asset creation, metadata PATCH and paginated version summaries. Search, status/type/direction/tag/owner filters, includeArchived and all four sorts are server-side. Project Home asset counts now come from this shared mock store, including archived records in total and byStatus.
- All seed versions are associated with Cold Industrial for the mock direction filter, matching the pre-switch demo scenario. Changing the active direction does not rewrite this recorded association. Filtering now resolves the latest version's stored direction revision, including newly created versions.
- The five local asset JPGs are procedurally drawn fictional demo placeholders at the filenames in section 9. They are not generated by an AI service and are not third-party photography. Missing/unsafe/broken previews have explicit text fallbacks.
- Asset creation uses a stable Idempotency-Key for an unchanged intent; edits to the draft generate a new key. The mock scopes replay by project and rejects a reused key with a different body. No automatic retry occurs.
- Asset metadata edits preserve versions and use expectedUpdatedAt; conflicts retain the draft and show the latest server metadata for comparison. Logical status controls offer only DRAFT/IN_PROGRESS/NEEDS_REVIEW/REJECTED/ARCHIVED. APPROVED requires a specific version decision and is never offered by this editor.
- Archive is confirmed and restore explicitly sets the logical asset to DRAFT; both leave all version statuses untouched. Unknown role strings and VIEWER hide mutation controls; real authorization remains enforced by the backend.
- No membership-list endpoint is contracted. Owner assignment offers the known project owner, preserves any current owner on edits, and filters by owners observed in loaded asset records. Clearing an existing owner is withheld because nullable ownerUserId is not specified by this contract.
- Asset detail shows newest-first version summaries, backend-provided decisions and linked reference usage/rights notes. Mock asset create/edit actions append canonical activity events in memory; the activity endpoint is still deferred.
- Versioning implements GET /asset-versions/:id and POST /assets/:id/versions, plus atomic initialVersion support in the mock asset-creation endpoint. The UI offers new-version creation after creating the logical asset; it does not combine those forms.
- Version detail displays exact IDs, prompt/model/provider metadata, recorded attributes, typed generation settings, file metadata, source/derived lineage, version references and exact collection revision pins. Unknown generation metadata remains null/empty rather than inventing a provider or prompt. Seed recorded attributes use authored fictional demo values for the #9 scenario described below.
- Seed full-version fixtures preserve Hero v2's source Hero v1 and section 9 collection pins (Hero v2, Close-up v1, Factory Background v1). pinnedIn is a seeded projection in the version mock; collection DTOs/endpoints remain a later feature. Tests assert these version pin projections survive creation; the complete collection invariant requires collection integration later.
- Creating a version appends a sequential number, updates the logical asset's latestVersion/count, and leaves prior content, approval states, and pins untouched. isLatest and lineage derivedVersions are current server projections and can change without altering old content. The mock resolves omitted direction/brief IDs at save time; explicit null removes the association.
- Same-asset lineage and same-project direction/brief/reference associations are checked before mutation. An invalid initialVersion leaves no partial asset record. Version POST uses stable per-intent idempotency keys, scoped by asset in the mock; changed bodies get new keys and no write is automatically retried.
- New-version forms support an existing HTTP(S) or local demo file URL, or explicit metadata-only mode. No remote file is fetched by the mock; thumbnail/checksum remain absent for registered URLs. Storage uploads and AI generation remain deferred. Local demo URLs are checked after URL normalization to reject path escape; credential-bearing and non-HTTP(S) URLs are rejected.
- New-version forms retain drafts on failures and copy editable generation metadata from the selected source. Structured settings are preserved as read-only values and can be explicitly removed; primitive settings use typed fields. Initial statuses are DRAFT/CANDIDATE/NEEDS_REVIEW only. Approved/rejected decisions and audited administrative status changes are deferred to the review workflow.
- Version comparisons show two exact versions side by side, stacked at narrow widths. They make no AI call or compatibility claim. Mutation controls require a known editing role and asset metadata actions are disabled while a version draft is open.
- Schema exports use the documented type name plus Schema (e.g. ProjectSchema) and inferred type Project.
- API requests time out after 15 seconds unless overridden; mutations are never automatically retried.

## Feature #9 — Impact Assessment & Impact Map

- Routes: #/projects/:projectId/impact and /impact/:assessmentId. Result links open #/projects/:projectId/assets/:assetId/versions/:versionId, including historical versions; detail reads reject records belonging to another project/asset.
- Start/list/detail/retry/cancel use section 6.8 endpoints. Starts use a stable idempotency key for an unchanged body; changed input allocates a new key. Default old direction, latest brief and latest versions of non-archived assets resolve in the mock at request time. Explicit scopes support historical version IDs and deduplicate repeated IDs. Confirmed assessments retain their original exact version references and direction diff after later asset changes.
- Impact Map displays API priority order, qualitative uncertainty, rationale, supporting/conflicting evidence, missing information, suggested actions, original/effective recommendation, resolution, counts and the required human-decision disclaimer. It never computes recommendations, priorities or counts. Detail filters affect returned items while full counts remain unchanged. Known editing roles can start/retry/cancel; VIEWER and unknown roles are read-only, with backend authorization still required.
- GET polling begins at 1.5 seconds, increases by 1.5 to a 5-second maximum, stops at terminal states/read errors, and stops automatically after 120 seconds with manual refresh/cancel guidance. Cleanup aborts reads and clears timers. POST is never used for polling or retried automatically. AI_NOT_CONFIGURED preserves the draft and offers an explicit new rules-only intent.
- The mock completes inline, providerName=mock, isSimulated=true, rulesVersion=rules-v1, imagesSent=0. AI_ASSISTED/HYBRID remain deterministic simulated metadata outcomes; no real AI call, image inference or confidence percentage is produced. The form sends includeImages=false. Real provider lifecycle, authorization and persistence still require backend verification; pending/running/failed/retry/cancel UI is checked using controlled API responses.
- Exact Solara Cold Industrial …0031 → Warm Organic …0041 with brief …0020 returns Factory …0063 REVIEW_REQUIRED/HIGH priority 1, Metal …0064 RECREATE_CANDIDATE/LOW priority 2, Closeup …0062 ADAPT_CANDIDATE/MEDIUM priority 3, Hero …0061 REUSE_CANDIDATE/MEDIUM priority 4. Other version/direction/brief combinations return REVIEW_REQUIRED/HIGH with an explicit uncalibrated-scope explanation. This mock fixture does not implement a general rules engine. Reuse at medium uncertainty does not set requiresHumanReview; other demo outcomes do.
- Seed recordedAttributes now contain authored fictional metadata sufficient for that documented scenario. They are explicitly described as demo attributes rather than extracted observations. Factory lighting/mood remain missing. Existing provider/prompt fields remain null and procedural demo files remain unchanged.
- Project Home latestAssessment and unresolvedRecommendationCount are server-owned mock projections. The latter counts UNRESOLVED/DEFERRED items in the latest COMPLETED run, following section 5.3. Human decisions/overrides are implemented in feature #10; assessment runs do not activate direction, change version status/content or move approved collection pins.

## Feature #10 - Human Decisions & Overrides

- Each completed assessment item supports ACCEPT, OVERRIDE, DISMISS and DEFER through POST /impact-assessments/:assessmentId/items/:itemId/decision. Override must differ from the original recommendation; override/dismiss require a rationale of at least 5 characters. Accept/defer without a comment use the backend defaults. Selected actions allow suggested or free text and record intent only.
- Decision controls require a known OWNER/EDITOR/REVIEWER role; VIEWER and unknown roles retain read-only history. The form preserves failed drafts, shows field errors/request IDs and prevents duplicate in-flight submits. The endpoint has no idempotency contract: no automatic write retry; ambiguous failures direct the user to refresh history before resubmitting.
- Re-resolving appends a new decision linked by supersedesDecisionId/supersededByDecisionId. The original recommendation, evidence, rationale, priority and uncertainty remain unchanged; effectiveRecommendation and resolutionStatus are separate server fields. Current decision actor, rationale, selected action and timestamp are visible on the item.
- History is available within the assessment and at #/projects/:projectId/decisions via Project Home. It supports server-side decisionType/currentOnly and exact assessment/asset/version/collection revision filters, cursor pagination, unknown-type labels, cross-project guards and read retry. History links inspect the exact recorded asset version.
- Mock decisions emit RECOMMENDATION_RESOLVED events and update confirmed assessment counts, latest-completed Project Home unresolved counts, recent decisions and asset detail recent decisions. DEFERRED still counts as unresolved. Earlier #9's cumulative mock count has been corrected to the latest-completed definition in section 5.3. Version content, status/approval, lineage, active direction and collection pins are preserved.
- This feature uses the deployed endpoint and payload from its OpenAPI (ResolveInput/ResolveResponse); the existing shared ResolveItemInput DTO has the same wire fields. Live smoke tests read decision history and open its page without creating production decisions. POST/supersession behavior is verified through MSW; live writes have not been exercised.

## Deployed backend integration

- API base is https://api.solit.my.id/api/v1; documentation is https://api.solit.my.id/docs. Local `.env` and `.env.example` now select live mode. Missing base configuration defaults to this deployed API; the mock toggle still works explicitly. `.env` remains ignored by Git.
- Health reports API/contract 1.0.0 and authMode=demo. No new login or browser provider key is required by the published OpenAPI. Frontend retains credentialed requests, runtime validation, request IDs and the major-version gate. Real authorization remains server-owned.
- CORS preflight accepts http://localhost:5173 with credentials, X-Request-Id and Idempotency-Key; http://127.0.0.1:5173 is rejected. Vite defaults to localhost and strict port 5173. Deployment origins must be configured on the backend; no proxy or CORS bypass is introduced.
- `npm run test:live` is an opt-in read-only Playwright check. It validates actual health/project/summary/brief/direction/reference/asset/version/assessment/decision responses using shared schemas and opens completed feature pages through browser CORS without MSW. This passed against the deployed backend on 2026-10-10. Existing assessment detail is checked only when history contains one. No live write or paid provider invocation is performed by this test. An existing localhost dev server can be reused; the test asserts live mode and the deployed browser health URL, so a mock or different API target cannot pass silently.
- Live mutations/provider retry/cancel have not been exercised against the deployed service; their request construction, errors and state transitions remain covered by mock integration tests.

## Proposed contract changes

- None.

## Known gaps

- Collections, version review/status decisions and activity feed remain subsequent feature slices.
- Implemented feature views retain text fallbacks for unknown status/recommendation values.
- Read-only backend integration is verified by the opt-in live smoke test. Mutations and provider lifecycle still require live verification.

## Verification

Run npm run test -- --maxWorkers=2, npm run lint, npm run typecheck, npm run build, and npm run test:e2e -- --workers=2 sequentially on resource-constrained machines.
Browser smoke tests use installed Microsoft Edge (Playwright channel msedge) at desktop and phone widths. Install Edge or adjust the test channel if it is unavailable on another machine.
