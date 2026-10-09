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
- Version detail displays exact IDs, prompt/model/provider metadata, recorded attributes, typed generation settings, file metadata, source/derived lineage, version references and exact collection revision pins. Unknown generation metadata remains null/empty rather than inventing a provider or prompt. Seed recorded attributes remain unspecified/empty; the deterministic impact-assessment fixture will be completed in #9 against section 9.3.
- Seed full-version fixtures preserve Hero v2's source Hero v1 and section 9 collection pins (Hero v2, Close-up v1, Factory Background v1). pinnedIn is a seeded projection in the version mock; collection DTOs/endpoints remain a later feature. Tests assert these version pin projections survive creation; the complete collection invariant requires collection integration later.
- Creating a version appends a sequential number, updates the logical asset's latestVersion/count, and leaves prior content, approval states, and pins untouched. isLatest and lineage derivedVersions are current server projections and can change without altering old content. The mock resolves omitted direction/brief IDs at save time; explicit null removes the association.
- Same-asset lineage and same-project direction/brief/reference associations are checked before mutation. An invalid initialVersion leaves no partial asset record. Version POST uses stable per-intent idempotency keys, scoped by asset in the mock; changed bodies get new keys and no write is automatically retried.
- New-version forms support an existing HTTP(S) or local demo file URL, or explicit metadata-only mode. No remote file is fetched by the mock; thumbnail/checksum remain absent for registered URLs. Storage uploads and AI generation remain deferred. Local demo URLs are checked after URL normalization to reject path escape; credential-bearing and non-HTTP(S) URLs are rejected.
- New-version forms retain drafts on failures and copy editable generation metadata from the selected source. Structured settings are preserved as read-only values and can be explicitly removed; primitive settings use typed fields. Initial statuses are DRAFT/CANDIDATE/NEEDS_REVIEW only. Approved/rejected decisions and audited administrative status changes are deferred to the review workflow.
- Version comparisons show two exact versions side by side, stacked at narrow widths. They make no AI call or compatibility claim. Mutation controls require a known editing role and asset metadata actions are disabled while a version draft is open.
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
