# Branchframe — Frontend ↔ Backend Integration Contract

| | |
|---|---|
| **Contract version** | `1.0.0` |
| **Based on** | `branchframe_prd_trd_erd.md` v1.0 (PRD §1, TRD §2, ERD §3) |
| **Audience** | Two independent AI coding agents on different machines: the **Backend Agent (BE)** and the **Frontend Agent (FE)**. They do not talk to each other. They integrate at the end. |
| **Wire format** | JSON over HTTP, base path `/api/v1`, UTF-8 |
| **Status** | Proposed. Binding once the human owner confirms §2 (Locked Decisions) and §13 (Open Questions). |

> **One-line purpose:** if BE and FE both follow this file literally, integration day is a smoke test, not a rewrite.

---

## 1. How to use this contract

### 1.1 Precedence

1. For **wire format** (URLs, field names, enums, status codes, error codes): this contract wins over the PRD/TRD/ERD.
2. For **product behavior** (what a feature should do): the PRD/TRD/ERD wins. If this contract contradicts it, do **not** guess. Add an entry to §13 and keep going with the contract's version.
3. If this contract is silent or ambiguous: choose the simplest option, write the choice into `INTEGRATION_NOTES.md` in your repo (one line per choice), and flag it at integration. Never silently invent a field the other side must know about.

### 1.2 Rules for both agents

- **Do not change this contract unilaterally.** If you need a change, write it in `INTEGRATION_NOTES.md` under "Proposed contract changes" and continue with the current contract. The human owner reconciles at the end.
- **Responses contain every documented field.** Empty values are `null` or `[]`, never omitted. Requests may omit optional fields.
- **FE must ignore unknown response fields** and render a safe generic fallback for unknown enum values (never crash).
- **BE strips unknown request fields** silently (Zod `.strip()`) but validates every documented field strictly.
- **Single source for types:** both agents create `packages/contracts/src/index.ts` containing Zod schemas + inferred TS types that mirror §4–§5 **exactly**. Name the types identically. The two copies must be byte-for-byte equivalent in exported names and shapes.
- **Never recompute business rules on the client.** Derived fields (`isStale`, `latestVersion`, `counts`, `priority`, `isSimulated`, …) come from BE. FE only displays them.
- **No secrets on the client.** FE never sees a provider key, model name that is secret, or storage key.

### 1.3 Working in isolation until integration day

| Agent | Must do |
|---|---|
| **FE** | Build against a mock API (MSW or equivalent) that returns the fixtures in §9 and validates every mocked response with the `packages/contracts` Zod schemas. Toggle with `VITE_USE_MOCK_API=true`. All 10 screens in PRD §1.8 must work in mock mode. |
| **BE** | Implement every endpoint in §6. Seed the database with exactly the data in §9 (same UUIDs). Ship contract tests (§11) that validate every response against the Zod schemas. Provide `AI_MODE=mock` working with no network and no key. |

---

## 2. Locked decisions (veto these before work starts)

These resolve gaps or choices the PRD/TRD/ERD left open. Both agents treat them as fixed.

| # | Decision |
|---|---|
| D-01 | **Casing:** JSON is `camelCase`. Database is `snake_case`. BE maps between them. |
| D-02 | **Auth in MVP:** `AUTH_MODE=demo`. No login screen. BE resolves every request to one seeded demo user with role `OWNER`. FE sends `credentials: "include"` on every request so real cookie-session auth can be added later with **no** contract change. |
| D-03 | **Active direction** is stored as `projects.active_direction_revision_id` (single source of truth). The optional `PROJECT_ACTIVE_DIRECTION` table is **not** built. History lives in `Decision(CHANGE_DIRECTION)` + `ActivityEvent`. |
| D-04 | **Assessments are always poll-able.** `POST` returns an assessment object. If `status` is `PENDING` or `RUNNING`, FE polls `GET`. Rules-only/mock usually returns `COMPLETED` immediately; FE must handle both. |
| D-05 | **Files:** BE returns resolved, short-lived `fileUrl` / `thumbnailUrl`. BE never returns `storageKey`. FE never builds file URLs itself. |
| D-06 | **Pagination:** cursor-based everywhere (§3.4). |
| D-07 | **Mutable fields are few and explicit.** Immutable after creation: direction revisions, brief revisions, asset-version content, decisions, approvals. The only mutable thing on an asset version is `status`, and only through audited endpoints (§6.6). |
| D-08 | **Simulated AI is labeled.** Any result produced by the mock provider has `isSimulated: true`. FE must show a persistent "Simulated" badge next to it. |
| D-09 | **AI configuration is env-only.** FE can read AI status (`GET /settings/ai`) and run a connectivity test. FE cannot set keys, models, or mode. |
| D-10 | **One version per asset per collection revision.** A collection revision may pin at most one version of any given asset. |
| D-11 | **No hard delete.** `DELETE` endpoints archive. |
| D-12 | **Contract handshake:** `GET /health` returns `contractVersion`. FE checks on boot that the major version matches its own and shows a blocking error if not. |

Endpoints marked **(+)** in §6 are not in TRD §2.8 but are required for the PRD screens to work.

---

## 3. Conventions

### 3.1 Transport

- Base URL: `${VITE_API_BASE_URL}` = `http://localhost:3001/api/v1` in dev.
- `Content-Type: application/json` except `POST /projects/:id/uploads` (`multipart/form-data`).
- IDs: UUID strings. Timestamps: ISO-8601 UTC with `Z` (e.g. `2026-10-10T08:30:00.000Z`).
- FE renders timestamps in the user's local timezone.
- Strings are trimmed by BE. Empty string for an optional text field is normalized to `null`.

### 3.2 Envelopes

```ts
type UUID = string;
type ISODateTime = string;

interface ResponseMeta { simulated?: boolean }                 // extend only via contract change

interface ApiResponse<T> { data: T; meta?: ResponseMeta }

interface ApiList<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null };
}

interface ApiError {
  error: {
    code: ErrorCode;
    message: string;           // human-readable, English, safe to show
    requestId: string;         // same value as response header X-Request-Id
    details: ErrorDetail[];    // [] when none
  };
}
interface ErrorDetail { path: string; message: string; code?: string }  // path like "body.title"
```

Success status codes: `200` read/update/action, `201` created, `204` never used (always return a body).

### 3.3 Error codes

| `code` | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query/path fails schema. `details[]` lists every failing field. |
| `UNAUTHENTICATED` | 401 | No/invalid session (unused in demo mode). |
| `FORBIDDEN` | 403 | Role too low, or `DEMO_MODE` off for `/demo/*`. |
| `NOT_FOUND` | 404 | Entity missing **or belongs to another project/user** (never leak existence). |
| `CONFLICT` | 409 | Stale write: `expectedUpdatedAt` does not match. FE should refetch and let the user re-apply. |
| `INVALID_STATE_TRANSITION` | 409 | Action not allowed in the entity's current status (e.g. approve a `DRAFT` revision). |
| `REVISION_FROZEN` | 409 | Tried to change items of a collection revision that is not `DRAFT`. |
| `OPEN_REVISION_EXISTS` | 409 | Tried to create a collection revision while a `DRAFT`/`IN_REVIEW` one exists. |
| `ASSET_ALREADY_PINNED` | 409 | Same asset pinned twice in one collection revision (D-10). |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Same `Idempotency-Key`, different request body. |
| `CROSS_PROJECT_REFERENCE` | 422 | A referenced ID exists but belongs to a different project than the target. |
| `ASSESSMENT_SCOPE_TOO_LARGE` | 422 | More than `maxAssetsPerAssessment` versions in an AI mode. |
| `AI_NOT_CONFIGURED` | 422 | AI mode requested but `AI_MODE=openai` has no key/model on the server. |
| `AI_BUDGET_EXCEEDED` | 422 | Monthly budget ceiling reached. |
| `NO_IMAGE_INPUT` | 422 | Reference analysis requested but no image bytes are available. |
| `PAYLOAD_TOO_LARGE` | 413 | Upload over limit (§6.3). |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Upload not PNG/JPEG/WebP (validated by file signature, not extension). |
| `RATE_LIMITED` | 429 | Include `Retry-After` header (seconds). |
| `PROVIDER_ERROR` | 502 | Only on synchronous provider calls (`/settings/ai/test`, `/references/:id/analyze`). |
| `PROVIDER_TIMEOUT` | 504 | Same scope as above. |
| `INTERNAL_ERROR` | 500 | Anything else. Never include stack traces. |

> Assessment provider failures are **not** HTTP errors. They are stored on the assessment as `status: "FAILED"` with `errorCode` (§6.8).

FE behavior: show `error.message` for 4xx; for `VALIDATION_ERROR` map `details[].path` to form fields; always offer a retry for 5xx/429; always log `requestId` where the user can copy it.

### 3.4 Pagination, filtering, sorting

- Query: `?limit=25&cursor=<opaque>`. Default `limit` 25, max 100. FE treats `cursor` as an opaque string.
- Sorting: `?sort=<field>:<asc|desc>`; allowed fields are listed per endpoint. Default is stated per endpoint.
- Filters are plain query params. Multi-value filters are repeated params (`?status=DRAFT&status=APPROVED`).
- Text search: `?q=` (case-insensitive substring over fields listed per endpoint).

### 3.5 Idempotency

- Header `Idempotency-Key: <string, 8–160 chars>`.
- **Required** on: `POST /projects/:id/impact-assessments`.
- **Supported (optional)** on: `POST /projects`, `POST /assets/:id/versions`, `POST /projects/:id/assets`, `POST /projects/:id/collections`, `POST /collections/:id/revisions`.
- Behavior: same key + same body from the same actor → BE returns the **original** response with HTTP `200` and header `Idempotent-Replayed: true` (no duplicate rows). Same key + different body → `422 IDEMPOTENCY_KEY_REUSED`. Keys are remembered for ≥ 24 h.
- FE: generate one key per **user intent** (when the user opens the confirm dialog), keep it in component state until the request completes, and reuse it on retry/double-click. Generate a new one for a genuinely new intent.

### 3.6 Optimistic concurrency

Mutable entities (`Project`, `Asset`, `Reference`, `Collection`, `Direction`) expose `updatedAt`. Every `PATCH` body must include `expectedUpdatedAt` (the value FE last saw). Mismatch → `409 CONFLICT`. Immutable entities have no `PATCH`.

### 3.7 Headers

| Header | Direction | Notes |
|---|---|---|
| `X-Request-Id` | response (always) | FE may also send one; BE echoes it, else generates a UUID. |
| `Idempotency-Key` | request | §3.5 |
| `Idempotent-Replayed` | response | `true` only on a replay. |
| `Retry-After` | response | On `429`. |

### 3.8 Roles

Roles: `OWNER` > `REVIEWER` > `EDITOR` > `VIEWER` (a higher role includes the lower role's rights, except as noted). BE enforces on every call; FE hides/disables controls using `project.currentUserRole` but never relies on that for security.

| Capability | Min role |
|---|---|
| Any `GET` | `VIEWER` |
| Create/edit briefs, directions, references, assets, versions, collections (draft), start assessments, resolve recommendations, change active direction | `EDITOR` |
| Approve/reject asset versions; approve / reject collection revisions | `REVIEWER` |
| Archive/restore project, demo reset | `OWNER` |

In demo mode the actor is `OWNER`, so everything is allowed.

### 3.9 Null vs absent

Responses: always present, `null` when empty. Requests: omit or send `null` for "no value". Arrays default to `[]`.

---

## 4. Enums

Exactly as ERD §3.4. FE and BE share these literal strings.

```ts
type ProjectStatus = "ACTIVE" | "ARCHIVED";
type ProjectRole = "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER";
type DirectionStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED" | "ARCHIVED";

type AssetType = "HERO_IMAGE" | "PRODUCT_IMAGE" | "BACKGROUND" | "TEXTURE"
               | "CHARACTER" | "CONCEPT_ART" | "LAYOUT" | "OTHER";
type AssetStatus = "DRAFT" | "IN_PROGRESS" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
type AssetVersionStatus = "DRAFT" | "CANDIDATE" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED";

type Recommendation = "REUSE_CANDIDATE" | "ADAPT_CANDIDATE" | "REVIEW_REQUIRED" | "RECREATE_CANDIDATE";
type UncertaintyLevel = "LOW" | "MEDIUM" | "HIGH";
type AnalysisSource = "RULES" | "AI" | "HYBRID";
type AssessmentMode = "RULES_ONLY" | "AI_ASSISTED" | "HYBRID";
type AssessmentStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
type ResolutionStatus = "UNRESOLVED" | "ACCEPTED" | "OVERRIDDEN" | "DISMISSED" | "DEFERRED";
type ResolutionAction = "ACCEPT" | "OVERRIDE" | "DEFER" | "DISMISS";          // request-side verb

type DecisionType = "ACCEPT_RECOMMENDATION" | "OVERRIDE_RECOMMENDATION" | "DISMISS_RECOMMENDATION"
  | "DEFER_RECOMMENDATION" | "APPROVE_VERSION" | "REJECT_VERSION" | "REQUEST_REVISION"
  | "CHANGE_DIRECTION" | "PIN_TO_COLLECTION" | "REPLACE_PINNED_VERSION";

type CollectionType = "DELIVERABLE" | "REVIEW_ROUND" | "PRESENTATION" | "OTHER";
type CollectionStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUPERSEDED" | "ARCHIVED";
type CollectionRevisionStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED";
type ApprovalDecision = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";

type ReferenceSourceType = "USER_UPLOAD" | "PUBLIC_URL" | "INTERNAL_ASSET" | "DEMO_ASSET";
type AttributeCategory = "PALETTE" | "LIGHTING" | "COMPOSITION" | "MATERIAL" | "MOOD"
                       | "TYPOGRAPHY" | "SUBJECT" | "OTHER";                  // == REFERENCE_ATTRIBUTE_TYPE
type AttributeOrigin = "USER_PROVIDED" | "AI_INFERRED" | "SYSTEM_DERIVED";
type AttributeReviewStatus = "UNREVIEWED" | "CONFIRMED" | "CORRECTED" | "REJECTED";

type EvidenceSource = "BRIEF" | "DIRECTION" | "ASSET_METADATA" | "IMAGE_OBSERVATION" | "USER_NOTE" | "RULE";
```

`EvidenceSource.RULE` is an addition to the TRD's illustrative list so rules-only output has a truthful source.

---

---

## 5. Data types (DTOs)

These are the exact response shapes. `packages/contracts` must export a Zod schema and inferred type for each, with the same name.

### 5.1 Shared building blocks

```ts
interface UserSummary { id: UUID; displayName: string }

/** A requirement or exclusion used in briefs and directions. Rules engine matches on `category` + normalized `value`. */
interface AttributeRequirement {
  id: UUID;                       // BE assigns if absent in a request
  category: AttributeCategory;
  label: string;                  // e.g. "Lighting style"
  value: string;                  // e.g. "soft natural light"  (BE lowercases+trims a copy for matching)
  hard: boolean;                  // true = hard constraint (a conflict forces stronger recommendation)
}

interface PaletteColor { name: string; hex: string | null; role: string | null }   // hex "#RRGGBB"
interface LightingSpec { quality: string | null; direction: string | null; temperature: string | null; notes: string | null }
interface CompositionSpec { framing: string | null; layout: string | null; notes: string | null }
interface TypographySpec { families: string[]; notes: string | null }

/** Normalized, lowercase tokens recorded on an asset version. Used by the rules engine. */
interface RecordedAttributes {
  palette: string[]; lighting: string[]; composition: string[];
  materials: string[]; mood: string[]; typography: string[]; subject: string[];
}

interface Evidence {
  source: EvidenceSource;
  statement: string;
  sourceId: UUID | null;          // id of brief/direction revision, asset version, etc. — MUST be in the assessment's input set
  ruleId: string | null;          // e.g. "R-MISSING-METADATA" when source = "RULE"
}
```

### 5.2 Project

```ts
interface Project {
  id: UUID; name: string; slug: string; description: string | null;
  status: ProjectStatus;
  owner: UserSummary;
  currentUserRole: ProjectRole;
  activeDirectionRevisionId: UUID | null;
  createdAt: ISODateTime; updatedAt: ISODateTime; archivedAt: ISODateTime | null;
}

/** Everything the Project Home screen needs in one call. */
interface ProjectSummary {
  project: Project;
  activeDirection: { direction: Direction; revision: DirectionRevision } | null;
  assetCounts: { total: number; byStatus: Record<AssetStatus, number> };
  unresolvedRecommendationCount: number;      // items with resolutionStatus UNRESOLVED/DEFERRED in the latest COMPLETED assessment
  staleCollectionItemCount: number;           // pinned versions older than the asset's latest, in latest non-superseded revisions
  latestAssessment: { id: UUID; status: AssessmentStatus; startedAt: ISODateTime; isSimulated: boolean } | null;
  recentDecisions: Decision[];                // newest 5
}
```

### 5.3 Brief

```ts
interface BriefRevision {
  id: UUID; projectId: UUID; revisionNumber: number;
  title: string; objective: string; targetAudience: string | null;
  deliverables: string[];
  requirements: AttributeRequirement[];            // "required attributes"
  constraints: string[];
  forbiddenAttributes: AttributeRequirement[];
  acceptanceCriteria: string[];
  sourceText: string | null;                       // pasted text/Markdown; FE must sanitize if rendered as HTML
  changeSummary: string | null;                    // required by BE when revisionNumber > 1
  createdBy: UserSummary; createdAt: ISODateTime;
}
type BriefRevisionInput = Omit<BriefRevision, "id" | "projectId" | "revisionNumber" | "createdBy" | "createdAt">;
```

### 5.4 Directions

```ts
interface DirectionRevision {
  id: UUID; directionId: UUID; revisionNumber: number;
  summary: string;
  palette: PaletteColor[]; lighting: LightingSpec; composition: CompositionSpec;
  materials: string[]; mood: string[]; typography: TypographySpec;
  requiredAttributes: AttributeRequirement[]; forbiddenAttributes: AttributeRequirement[];
  stylePrompt: string | null; changeSummary: string | null;
  createdBy: UserSummary; createdAt: ISODateTime;
}
type DirectionRevisionInput = Omit<DirectionRevision, "id" | "directionId" | "revisionNumber" | "createdBy" | "createdAt">;

interface Direction {
  id: UUID; projectId: UUID; name: string; description: string | null;
  status: DirectionStatus;
  isActive: boolean;                       // true iff project.activeDirectionRevisionId belongs to this direction
  latestRevision: DirectionRevision;
  revisionCount: number;
  createdBy: UserSummary; createdAt: ISODateTime; updatedAt: ISODateTime; archivedAt: ISODateTime | null;
}

interface DirectionDiffChange {
  category: AttributeCategory | "SUMMARY" | "STYLE_PROMPT";
  field: string;                           // e.g. "lighting.quality", "palette", "forbiddenAttributes"
  from: string | null; to: string | null;  // human-readable
  kind: "ADDED" | "REMOVED" | "CHANGED";
}
interface DirectionDiff {
  fromRevisionId: UUID | null; toRevisionId: UUID;
  summary: string;                         // one or two sentences, deterministic (not AI)
  changes: DirectionDiffChange[];
}

interface ActiveDirectionChangeResult {
  project: Project;
  previousDirectionRevisionId: UUID | null;
  decisionId: UUID;
}
```

### 5.5 Storage, references

```ts
interface StorageObject {
  id: UUID; originalFilename: string | null; mimeType: string; byteSize: number;
  width: number | null; height: number | null; checksum: string | null;
  url: string; urlExpiresAt: ISODateTime | null;     // null for public demo assets
  createdAt: ISODateTime;
}

interface ReferenceAttribute {
  id: UUID; referenceId: UUID;
  attributeType: AttributeCategory;
  value: { text: string; hex: string | null };
  origin: AttributeOrigin; reviewStatus: AttributeReviewStatus;
  createdBy: UserSummary | null; createdAt: ISODateTime; updatedAt: ISODateTime;
}

interface ReferenceLink {
  targetType: "DIRECTION_REVISION" | "ASSET" | "ASSET_VERSION";
  targetId: UUID;
  relationshipType: string | null;     // required for ASSET links (default "INSPIRATION"); null otherwise
  usageNote: string | null;
}

interface Reference {
  id: UUID; projectId: UUID; title: string; description: string | null;
  sourceType: ReferenceSourceType;
  sourceUrl: string | null;            // never fetched by BE in MVP
  usageRightsNote: string | null;      // FE must always display this next to the reference
  tags: string[];
  fileUrl: string | null; thumbnailUrl: string | null;
  attributes: ReferenceAttribute[];
  links: ReferenceLink[];
  addedBy: UserSummary; createdAt: ISODateTime; updatedAt: ISODateTime; archivedAt: ISODateTime | null;
}
```

### 5.6 Assets and versions

```ts
interface AssetVersionSummary {
  id: UUID; assetId: UUID; versionNumber: number;
  status: AssetVersionStatus;
  thumbnailUrl: string | null;
  createdAt: ISODateTime;
}
/** Summary plus enough asset context to render a row without a second request. */
interface AssetVersionRef extends AssetVersionSummary { assetTitle: string; assetType: AssetType }

interface Asset {
  id: UUID; projectId: UUID; title: string; description: string | null;
  assetType: AssetType; status: AssetStatus; tags: string[];
  owner: UserSummary | null;
  versionCount: number;
  latestVersion: AssetVersionSummary | null;
  createdBy: UserSummary; createdAt: ISODateTime; updatedAt: ISODateTime; archivedAt: ISODateTime | null;
}

interface AssetDetail extends Asset {
  versions: AssetVersionSummary[];                      // newest first
  referenceLinks: Array<{ referenceId: UUID; relationshipType: string; note: string | null }>;
  recentDecisions: Decision[];                          // newest 10 touching this asset or its versions
}

interface AssetVersion {
  id: UUID; assetId: UUID; assetTitle: string; versionNumber: number;
  derivedFromVersionId: UUID | null;
  directionRevisionId: UUID | null; briefRevisionId: UUID | null;
  fileUrl: string | null; thumbnailUrl: string | null; externalFileUrl: string | null;
  isMetadataOnly: boolean;                              // true iff no file and no external URL
  mimeType: string | null; width: number | null; height: number | null; contentChecksum: string | null;
  prompt: string | null; negativePrompt: string | null;
  providerName: string | null; modelName: string | null; modelVersion: string | null;   // null = unknown; never fabricated
  generationSettings: Record<string, unknown>;
  recordedAttributes: RecordedAttributes;
  revisionRationale: string;
  status: AssetVersionStatus;
  references: Array<{ referenceId: UUID; usageNote: string | null }>;
  isLatest: boolean;                                    // latest version number of its asset
  pinnedIn: Array<{                                     // which collection revisions pin THIS version
    collectionId: UUID; collectionName: string;
    collectionRevisionId: UUID; revisionNumber: number; revisionStatus: CollectionRevisionStatus;
  }>;
  lineage: { derivedFrom: AssetVersionSummary | null; derivedVersions: AssetVersionSummary[] };
  createdBy: UserSummary; createdAt: ISODateTime;
}

interface AssetVersionInput {
  derivedFromVersionId?: UUID | null;                   // must be a version of the SAME asset
  directionRevisionId?: UUID | null;                    // default: project's active revision
  briefRevisionId?: UUID | null;                        // default: latest brief revision
  storageObjectId?: UUID | null;
  thumbnailStorageObjectId?: UUID | null;
  externalFileUrl?: string | null;                      // http(s) or "/demo-assets/..." only
  metadataOnly?: boolean;                               // must be true to create a version with no file and no URL
  mimeType?: string | null; width?: number | null; height?: number | null;   // honored only with externalFileUrl
  prompt?: string | null; negativePrompt?: string | null;
  providerName?: string | null; modelName?: string | null; modelVersion?: string | null;
  generationSettings?: Record<string, unknown>;
  recordedAttributes?: Partial<RecordedAttributes>;
  revisionRationale: string;                            // required, min 3 chars (use "Initial version" for v1)
  references?: Array<{ referenceId: UUID; usageNote?: string | null }>;
  status?: "DRAFT" | "CANDIDATE" | "NEEDS_REVIEW";      // default DRAFT
}
```

### 5.7 Impact assessments

```ts
interface ImpactAssessment {
  id: UUID; projectId: UUID;
  oldDirectionRevisionId: UUID | null; newDirectionRevisionId: UUID; briefRevisionId: UUID | null;
  mode: AssessmentMode; status: AssessmentStatus;
  providerName: string | null; modelName: string | null;      // "mock" for simulated runs
  promptTemplateVersion: string | null; outputSchemaVersion: string; rulesVersion: string;  // e.g. "rules-v1"
  isSimulated: boolean;
  imagesSent: number;                                          // 0 means NO image was inspected; FE must not imply otherwise
  directionDiff: DirectionDiff;
  summary: string | null;
  errorCode: string | null; errorSummary: string | null;      // set when FAILED
  counts: { total: number; byRecommendation: Record<Recommendation, number>; unresolved: number };
  items: ImpactAssessmentItem[] | null;                        // null in list responses and until COMPLETED
  startedBy: UserSummary; startedAt: ISODateTime; completedAt: ISODateTime | null;
}

interface ImpactAssessmentItem {
  id: UUID; assessmentId: UUID;
  assetVersion: AssetVersionRef;
  recommendation: Recommendation;                              // the system's recommendation; NEVER edited after creation
  rationale: string;
  supportingEvidence: Evidence[]; conflictingEvidence: Evidence[];
  missingInformation: string[]; suggestedActions: string[];
  uncertaintyLevel: UncertaintyLevel;                          // qualitative only — no percentage confidence anywhere
  requiresHumanReview: boolean;
  analysisSource: AnalysisSource;
  priority: number;                                            // 1 = most urgent; items are returned sorted ascending
  priorityReason: string;
  resolutionStatus: ResolutionStatus;
  effectiveRecommendation: Recommendation;                     // = overridden value if OVERRIDDEN, else = recommendation
  latestDecision: Decision | null;
  createdAt: ISODateTime; updatedAt: ISODateTime;
}
```

### 5.8 Decisions

```ts
interface Decision {
  id: UUID; projectId: UUID;
  assessmentItemId: UUID | null; assetId: UUID | null; assetVersionId: UUID | null;
  directionRevisionId: UUID | null; collectionRevisionId: UUID | null;
  decisionType: DecisionType;
  selectedAction: string | null;
  rationale: string;                                           // always non-empty; BE fills a default text when the user gave none (§6.8)
  previousRecommendation: Recommendation | null; newRecommendation: Recommendation | null;
  supersedesDecisionId: UUID | null;
  supersededByDecisionId: UUID | null;                         // derived; null = this is the current decision
  createdBy: UserSummary; createdAt: ISODateTime;
}
```

### 5.9 Collections

```ts
interface CollectionItem {
  id: UUID; collectionRevisionId: UUID; position: number;     // 1-based, gapless
  role: string | null; note: string | null;
  pinnedVersion: AssetVersionRef;                              // the EXACT pinned version
  latestVersion: AssetVersionRef;                              // asset's current latest (may equal pinned)
  isStale: boolean;                                            // latest.versionNumber > pinned.versionNumber
  newerVersionCount: number;
}

interface Approval {
  id: UUID; collectionRevisionId: UUID; decision: ApprovalDecision;
  comment: string | null; reviewedBy: UserSummary; reviewedAt: ISODateTime;
}

interface CollectionRevisionSummary {
  id: UUID; collectionId: UUID; revisionNumber: number; status: CollectionRevisionStatus;
  changeSummary: string | null; itemCount: number; staleItemCount: number;
  createdBy: UserSummary; createdAt: ISODateTime; submittedAt: ISODateTime | null; approvedAt: ISODateTime | null;
}
interface CollectionRevision extends CollectionRevisionSummary {
  collectionName: string;
  items: CollectionItem[];                                     // ordered by position
  approvals: Approval[];                                       // newest first
}

interface Collection {
  id: UUID; projectId: UUID; name: string; description: string | null;
  collectionType: CollectionType; status: CollectionStatus;
  latestRevision: CollectionRevisionSummary;
  approvedRevisionId: UUID | null;                             // current APPROVED revision, if any
  createdBy: UserSummary; createdAt: ISODateTime; updatedAt: ISODateTime; archivedAt: ISODateTime | null;
}
interface CollectionDetail extends Collection { revisions: CollectionRevisionSummary[] }   // newest first
```

### 5.10 Activity, export, settings

```ts
type ActivityEventType =
  | "PROJECT_CREATED" | "PROJECT_UPDATED" | "PROJECT_ARCHIVED" | "PROJECT_RESTORED"
  | "BRIEF_REVISION_CREATED" | "DIRECTION_CREATED" | "DIRECTION_REVISION_CREATED" | "ACTIVE_DIRECTION_CHANGED"
  | "REFERENCE_ADDED" | "REFERENCE_UPDATED" | "REFERENCE_LINKED" | "REFERENCE_ATTRIBUTE_REVIEWED"
  | "ASSET_CREATED" | "ASSET_UPDATED" | "ASSET_VERSION_CREATED" | "ASSET_VERSION_STATUS_CHANGED"
  | "ASSESSMENT_STARTED" | "ASSESSMENT_COMPLETED" | "ASSESSMENT_FAILED" | "ASSESSMENT_CANCELLED"
  | "RECOMMENDATION_RESOLVED"
  | "COLLECTION_CREATED" | "COLLECTION_REVISION_CREATED" | "COLLECTION_ITEM_PINNED" | "COLLECTION_ITEM_REPLACED"
  | "COLLECTION_SUBMITTED" | "COLLECTION_APPROVED" | "COLLECTION_REVIEW_REJECTED"
  | "EXPORT_CREATED" | "DEMO_RESET";

interface ActivityEvent {
  id: UUID; projectId: UUID; actor: UserSummary | null;
  eventType: ActivityEventType | string;                       // FE: unknown string → generic row
  entityType: string; entityId: UUID | null;
  summary: string;                                             // concise, safe to display verbatim
  metadata: Record<string, unknown>;                           // never contains secrets/payloads; FE shows only known keys
  requestId: string | null; createdAt: ISODateTime;
}

interface ExportResult {
  id: UUID; format: "JSON" | "MARKDOWN" | "CSV";
  filename: string; contentType: string; content: string;      // inline text; FE triggers the download itself
  warnings: Array<{ code: "LOCAL_ONLY_FILE_PATHS" | "METADATA_ONLY_VERSIONS" | "OTHER"; message: string }>;
  createdAt: ISODateTime;
}

interface AiSettings {
  mode: "mock" | "openai";
  providerConfigured: boolean;               // true if a key is present server-side. The key itself is NEVER returned.
  modelName: string | null;
  imageAnalysisAvailable: boolean;
  maxAssetsPerAssessment: number;
  monthlyBudgetLimitUsd: number | null;
  monthToDateCostUsd: number | null;         // null = unknown
}
interface AiTestResult { ok: boolean; latencyMs: number | null; errorCode: string | null; message: string }

interface HealthStatus {
  status: "ok"; apiVersion: string; contractVersion: string;   // semver; FE compares MAJOR
  aiMode: "mock" | "openai"; demoMode: boolean; authMode: "demo" | "session";
}
```

---

## 6. Endpoints

Conventions used below: `→` means response `data` type. "Role" is the minimum role (§3.8). Every path param and body is validated; every referenced ID must belong to the same project as the target (`CROSS_PROJECT_REFERENCE` otherwise). Every successful mutation writes an `ActivityEvent` (§5.10) in the same transaction.

### 6.1 System, settings, demo

| Method & path | Role | Request | Response |
|---|---|---|---|
| `GET /health` | none | — | `HealthStatus` (inside the normal `ApiResponse` envelope) |
| `GET /settings/ai` | VIEWER | — | `AiSettings` |
| `POST /settings/ai/test` | EDITOR | — | `AiTestResult`. In mock mode returns `ok: true` instantly. Never exposes the key. Errors: `AI_NOT_CONFIGURED`, `PROVIDER_ERROR`, `PROVIDER_TIMEOUT`. |
| `POST /demo/reset` (+) | OWNER | `{ confirm: true }` | `Project` (the re-seeded Solara project, IDs per §9). `403 FORBIDDEN` unless `DEMO_MODE=true`. Deletes **only** demo-seed data and restores the seed. Logs `DEMO_RESET`. |

### 6.2 Projects

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `GET /projects` | VIEWER | `?status=ACTIVE\|ARCHIVED&q=&sort=updatedAt:desc\|name:asc` | `ApiList<Project>`. `q` matches name, description. |
| `POST /projects` | EDITOR | `{ name: string(1..160), description?: string, template: "BLANK" \| "DEMO_SOLARA" }` | `201 Project`. `DEMO_SOLARA` creates the seed in §9 under **new** UUIDs (the fixed UUIDs belong to the permanent demo project only). Supports `Idempotency-Key`. |
| `GET /projects/:projectId` | VIEWER | — | `Project` |
| `GET /projects/:projectId/summary` (+) | VIEWER | — | `ProjectSummary` |
| `PATCH /projects/:projectId` | EDITOR | `{ name?, description?, expectedUpdatedAt }` | `Project` |
| `DELETE /projects/:projectId?confirm=true` | OWNER | — | Archives (D-11). Missing `confirm=true` → `400 VALIDATION_ERROR`. → `Project` with `status: "ARCHIVED"`. |
| `POST /projects/:projectId/restore` (+) | OWNER | — | `Project` |

### 6.3 Uploads

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `POST /projects/:projectId/uploads` (+) | EDITOR | `multipart/form-data`, field `file` | `201 StorageObject`. Allowed: PNG, JPEG, WebP (checked by file signature). Max **10 MB**, max **8000 px** per side. Errors: `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`. BE generates the storage name; ignores the client filename for pathing. |

FE flow: upload first, then pass the returned `id` as `storageObjectId` when creating a reference or asset version. Orphaned uploads are BE's cleanup problem.

### 6.4 Briefs

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `GET /projects/:projectId/brief-revisions` | VIEWER | `?sort=revisionNumber:desc` (default) | `ApiList<BriefRevision>` |
| `GET /projects/:projectId/brief-revisions/latest` (+) | VIEWER | — | `BriefRevision`, `404` if none yet |
| `GET /brief-revisions/:revisionId` (+) | VIEWER | — | `BriefRevision` |
| `POST /projects/:projectId/brief-revisions` | EDITOR | `BriefRevisionInput` (`title`, `objective` required; `changeSummary` required unless this is revision 1) | `201 BriefRevision`. Revision number is allocated server-side in a transaction. Previous revisions untouched. |

### 6.5 Directions

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `GET /projects/:projectId/directions` | VIEWER | `?status=` (repeatable), `includeArchived=false` | `ApiList<Direction>` |
| `POST /projects/:projectId/directions` | EDITOR | `{ name, description?, revision?: DirectionRevisionInput, cloneFromDirectionRevisionId?: UUID }` | `201 Direction` with revision 1, status `DRAFT`. Either `revision` or `cloneFromDirectionRevisionId` is required; if both, `revision` fields override the clone. Clone copies attributes only (no assets/versions touched). |
| `GET /directions/:directionId` (+) | VIEWER | — | `Direction` |
| `PATCH /directions/:directionId` (+) | EDITOR | `{ name?, description?, status?: "DRAFT" \| "ARCHIVED", expectedUpdatedAt }` | `Direction`. Archiving the active direction → `409 INVALID_STATE_TRANSITION`. `ACTIVE`/`SUPERSEDED` are set only by `active-direction`. |
| `GET /directions/:directionId/revisions` | VIEWER | — | `ApiList<DirectionRevision>` newest first |
| `POST /directions/:directionId/revisions` | EDITOR | `DirectionRevisionInput` with `changeSummary` required | `201 DirectionRevision`. Does **not** change which revision is active, and does not touch any asset version. |
| `GET /direction-revisions/:revisionId` (+) | VIEWER | — | `DirectionRevision` |
| `GET /direction-revisions/diff?from=<uuid>&to=<uuid>` (+) | VIEWER | `from` optional | `DirectionDiff`. Deterministic, no AI call, free. FE uses it for the Brief & Direction compare view and for the Impact Map header. |
| `POST /projects/:projectId/active-direction` | EDITOR | `{ directionRevisionId: UUID, reason: string(3..1000) }` | `ActiveDirectionChangeResult`. Effects, all in one transaction: set `project.activeDirectionRevisionId`; previous direction → `SUPERSEDED` (unless same direction, then stays `ACTIVE`); new direction → `ACTIVE`; write `Decision(CHANGE_DIRECTION)` + `ACTIVE_DIRECTION_CHANGED`. **Never** modifies assets, versions, collections, or past assessments. `409 INVALID_STATE_TRANSITION` if the target revision's direction is `ARCHIVED`. |

### 6.6 Assets and versions

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `GET /projects/:projectId/assets` | VIEWER | `?q=&status=&assetType=&directionId=&tag=&ownerUserId=&includeArchived=false&sort=updatedAt:desc\|title:asc\|status:asc\|versionCount:desc` | `ApiList<Asset>`. `q` matches title, description, tags. `directionId` = assets whose **latest** version was created under any revision of that direction. |
| `POST /projects/:projectId/assets` | EDITOR | `{ title, description?, assetType, tags?: string[], ownerUserId?, initialVersion?: AssetVersionInput }` | `201 AssetDetail`. If `initialVersion` is present, version 1 is created atomically (`versionNumber: 1`). Supports `Idempotency-Key`. |
| `GET /assets/:assetId` | VIEWER | — | `AssetDetail` |
| `PATCH /assets/:assetId` | EDITOR | `{ title?, description?, assetType?, status?, tags?, ownerUserId?, expectedUpdatedAt }` | `Asset`. `status` may be set to `DRAFT`, `IN_PROGRESS`, `NEEDS_REVIEW`, `REJECTED`, `ARCHIVED`. Setting `APPROVED` → `409 INVALID_STATE_TRANSITION` (BE sets it when a version is approved). **Never** deletes or alters versions. |
| `GET /assets/:assetId/versions` | VIEWER | — | `ApiList<AssetVersionSummary>` newest first |
| `POST /assets/:assetId/versions` | EDITOR | `AssetVersionInput` | `201 AssetVersion`. Version number allocated in a transaction (`max+1`). **Never** changes the status of earlier versions, and **never** changes any collection pin. Supports `Idempotency-Key`. Validation: `derivedFromVersionId` must belong to this asset; `directionRevisionId`/`briefRevisionId`/`references[]` must belong to this project; a version with no `storageObjectId` and no `externalFileUrl` requires `metadataOnly: true` (else `VALIDATION_ERROR`). |
| `GET /asset-versions/:versionId` | VIEWER | — | `AssetVersion` (includes `pinnedIn`, `lineage`, `isLatest`) |
| `PATCH /asset-versions/:versionId` (+) | EDITOR | `{ status: "DRAFT" \| "CANDIDATE" \| "NEEDS_REVIEW" \| "SUPERSEDED", reason: string(3..500) }` | `AssetVersion`. Audited administrative status change only (D-07). No content field can be patched. `APPROVED`/`REJECTED` are rejected here; use the next endpoint. |
| `POST /asset-versions/:versionId/decisions` (+) | REVIEWER | `{ decisionType: "APPROVE_VERSION" \| "REJECT_VERSION" \| "REQUEST_REVISION", rationale: string(3..2000) }` | `201 { decision: Decision, assetVersion: AssetVersion }`. Status mapping: `APPROVE_VERSION`→`APPROVED`, `REJECT_VERSION`→`REJECTED`, `REQUEST_REVISION`→`NEEDS_REVIEW`. Approval is bound to **this version id**; creating version N+1 later does not move or revoke it. |

### 6.7 References

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `GET /projects/:projectId/references` | VIEWER | `?q=&tag=&sourceType=&attributeType=&includeArchived=false&sort=createdAt:desc` | `ApiList<Reference>`. `q` matches title, description, tags, usage note, attribute text. |
| `POST /projects/:projectId/references` | EDITOR | `{ title, description?, sourceType, sourceUrl?, storageObjectId?, usageRightsNote?, tags?, attributes?: Array<{ attributeType, value: { text, hex? } }>, links?: ReferenceLinkInput[] }` | `201 Reference`. Rules: `USER_UPLOAD`/`INTERNAL_ASSET` require `storageObjectId`; `PUBLIC_URL` requires `sourceUrl` (http/https; **never fetched**); `DEMO_ASSET` requires `sourceUrl` starting with `/demo-assets/` or a `storageObjectId`. Attributes from the request are stored as `origin: USER_PROVIDED`, `reviewStatus: CONFIRMED`. |
| `GET /references/:referenceId` (+) | VIEWER | — | `Reference` |
| `PATCH /references/:referenceId` (+) | EDITOR | `{ title?, description?, usageRightsNote?, tags?, archived?: boolean, expectedUpdatedAt }` | `Reference` |
| `POST /references/:referenceId/attributes` (+) | EDITOR | `{ attributeType, value: { text, hex? } }` | `201 ReferenceAttribute` (`USER_PROVIDED`, `CONFIRMED`) |
| `PATCH /reference-attributes/:attributeId` (+) | EDITOR | `{ value?: { text, hex? }, reviewStatus?: "CONFIRMED" \| "CORRECTED" \| "REJECTED" }` | `ReferenceAttribute`. `origin` never changes (an AI-inferred attribute stays `AI_INFERRED` even after correction). If `value` changes without an explicit `reviewStatus`, BE sets `CORRECTED`. |
| `POST /references/:referenceId/links` (+) | EDITOR | `ReferenceLinkInput = { targetType, targetId, relationshipType?, usageNote? }` | `201 Reference`. `ASSET` links default `relationshipType` to `"INSPIRATION"`. Idempotent on `(referenceId, targetType, targetId, relationshipType)`. |
| `DELETE /references/:referenceId/links?targetType=&targetId=` (+) | EDITOR | — | `Reference` |
| `POST /references/:referenceId/analyze` (+, **P1**) | EDITOR | `{}` | `Reference` with new `AI_INFERRED`/`UNREVIEWED` attributes and `meta.simulated`. `422 NO_IMAGE_INPUT` if the reference has no image bytes (BE must never claim to have looked at an image it did not receive). In mock mode returns deterministic fake attributes with `meta.simulated: true`. FE may hide this button in MVP. |

### 6.8 Impact assessments

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `POST /projects/:projectId/impact-assessments` | EDITOR | **Header `Idempotency-Key` required.** Body: `{ oldDirectionRevisionId?: UUID \| null, newDirectionRevisionId: UUID, briefRevisionId?: UUID, assetVersionIds?: UUID[], mode: AssessmentMode, includeImages?: boolean }` | `201 ImpactAssessment` (or `200` + `Idempotent-Replayed: true`). See rules below. |
| `GET /projects/:projectId/impact-assessments` | VIEWER | `?status=&sort=startedAt:desc` | `ApiList<ImpactAssessment>` with `items: null` |
| `GET /impact-assessments/:assessmentId` | VIEWER | `?recommendation=&resolutionStatus=` (filters `items` only) | `ImpactAssessment` with `items` sorted by `priority` asc once `COMPLETED` |
| `POST /impact-assessments/:assessmentId/retry` (+) | EDITOR | — | `ImpactAssessment`. Only from `FAILED`; moves it back to `RUNNING` on the **same id** (no duplicate rows). Else `409 INVALID_STATE_TRANSITION`. |
| `POST /impact-assessments/:assessmentId/cancel` (+) | EDITOR | — | `ImpactAssessment`. Only from `PENDING`/`RUNNING`. |
| `POST /impact-assessments/:assessmentId/items/:itemId/decision` | EDITOR | `ResolveItemInput` (below) | `201 { decision: Decision, item: ImpactAssessmentItem }` |

**Start rules**

- `oldDirectionRevisionId` omitted/null → BE uses the project's active revision **at request time** and stores it. `newDirectionRevisionId` must differ from the old one (`VALIDATION_ERROR`).
- `briefRevisionId` omitted → latest brief revision (may be null if the project has none).
- `assetVersionIds` omitted → BE uses the **latest version of every non-archived asset**. Explicit IDs must belong to the project.
- `mode: "AI_ASSISTED" | "HYBRID"` with `AI_MODE=mock` → allowed; runs the deterministic mock provider; `isSimulated: true`. With `AI_MODE=openai` and no key → `422 AI_NOT_CONFIGURED`. FE should then offer "Run rules-only instead". More than `maxAssetsPerAssessment` versions in an AI mode → `422 ASSESSMENT_SCOPE_TOO_LARGE`.
- `includeImages` defaults `false`. Only honored if the provider supports images; `imagesSent` reports what actually went out.
- The call is non-blocking in principle (D-04). BE may finish rules/mock work inline and return `COMPLETED`; FE must still handle `PENDING`/`RUNNING`.
- The record stores the exact `oldDirectionRevisionId`, `newDirectionRevisionId`, `briefRevisionId`, and the exact version IDs evaluated (via items). This is the reproducibility invariant.
- A provider timeout/error never returns an HTTP error. The assessment becomes `FAILED` with `errorCode`/`errorSummary`; no items are persisted for a failed run; no asset/version/approval is touched.

**FE polling:** `GET` every 1.5 s, multiplying by 1.5 up to 5 s, until `status` ∈ {`COMPLETED`,`FAILED`,`CANCELLED`}. After 120 s show "Still running" with a manual refresh and a cancel button. Never re-`POST` to "check".

**Resolve an item**

```ts
interface ResolveItemInput {
  resolution: ResolutionAction;                    // ACCEPT | OVERRIDE | DEFER | DISMISS
  overrideRecommendation?: Recommendation;         // required iff OVERRIDE; must differ from item.recommendation
  selectedAction?: string | null;                  // usually one of item.suggestedActions; free text allowed
  rationale?: string;                              // required (≥ 5 chars) for OVERRIDE and DISMISS; optional otherwise
}
```

Mapping (BE): `ACCEPT`→`DecisionType ACCEPT_RECOMMENDATION`/`ACCEPTED`; `OVERRIDE`→`OVERRIDE_RECOMMENDATION`/`OVERRIDDEN`; `DEFER`→`DEFER_RECOMMENDATION`/`DEFERRED`; `DISMISS`→`DISMISS_RECOMMENDATION`/`DISMISSED`. If `rationale` is empty for `ACCEPT`/`DEFER`, BE stores `"Accepted without comment"` / `"Deferred without comment"`.

- Allowed only when the assessment is `COMPLETED` (`409 INVALID_STATE_TRANSITION` otherwise).
- Re-resolving is allowed at any time: BE creates a **new** decision with `supersedesDecisionId` = the previous current decision. Old decisions stay.
- `item.recommendation` is never modified. An override sets `resolutionStatus: OVERRIDDEN` and `effectiveRecommendation` to the new value; `previousRecommendation`/`newRecommendation` on the decision record the change.
- Resolving never mutates an asset, version, or collection. It only records intent.

### 6.9 Decisions

| Method & path | Role | Request | Response |
|---|---|---|---|
| `GET /projects/:projectId/decisions` (+) | VIEWER | `?assessmentId=&assetId=&assetVersionId=&collectionRevisionId=&decisionType=&currentOnly=false&sort=createdAt:desc` | `ApiList<Decision>`. `currentOnly=true` drops decisions that have a `supersededByDecisionId`. |

### 6.10 Collections

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `GET /projects/:projectId/collections` | VIEWER | `?status=&collectionType=&includeArchived=false` | `ApiList<Collection>` |
| `POST /projects/:projectId/collections` | EDITOR | `{ name, description?, collectionType, items?: Array<{ assetVersionId, role?, note? }> }` | `201 CollectionDetail`. Creates revision 1 as `DRAFT`; each item is pinned to the **given version id** and writes `Decision(PIN_TO_COLLECTION)`. Supports `Idempotency-Key`. |
| `GET /collections/:collectionId` (+) | VIEWER | — | `CollectionDetail` |
| `PATCH /collections/:collectionId` (+) | EDITOR | `{ name?, description?, archived?: boolean, expectedUpdatedAt }` | `Collection` |
| `GET /collections/:collectionId/revisions` (+) | VIEWER | — | `ApiList<CollectionRevisionSummary>` |
| `GET /collection-revisions/:revisionId` (+) | VIEWER | — | `CollectionRevision` (items include `isStale`) |
| `POST /collections/:collectionId/revisions` | EDITOR | `{ basedOnRevisionId?: UUID, changeSummary: string(3..1000) }` | `201 CollectionRevision` (`DRAFT`). Copies the pins of the base revision **exactly as pinned** (not auto-updated to latest). Base defaults to the latest revision. `409 OPEN_REVISION_EXISTS` if a `DRAFT`/`IN_REVIEW` revision already exists. Supports `Idempotency-Key`. |
| `POST /collection-revisions/:revisionId/items` | EDITOR | `{ assetVersionId, role?, note?, position? }` | `201 CollectionItem`. Revision must be `DRAFT` (`409 REVISION_FROZEN`). `409 ASSET_ALREADY_PINNED` if that asset is already pinned. Appends if `position` omitted; otherwise shifts others down, keeping positions gapless. Writes `Decision(PIN_TO_COLLECTION)`. |
| `PATCH /collection-revision-items/:itemId` (+) | EDITOR | `{ assetVersionId?: UUID, position?, role?, note?, rationale?: string }` | `CollectionItem`. `DRAFT` only. Replacing `assetVersionId` requires `rationale` (≥ 5 chars), the new version must belong to the **same asset**, and writes `Decision(REPLACE_PINNED_VERSION)` + `COLLECTION_ITEM_REPLACED`. This is the **only** way a pin moves. |
| `DELETE /collection-revision-items/:itemId` (+) | EDITOR | — | `CollectionRevision`. `DRAFT` only; re-packs positions. |
| `POST /collection-revisions/:revisionId/submit-review` | EDITOR | — | `CollectionRevision` → `IN_REVIEW`. Requires ≥ 1 item. |
| `POST /collection-revisions/:revisionId/approve` | REVIEWER | `{ comment?: string }` | `CollectionRevision` → `APPROVED`. Only from `IN_REVIEW`. Creates `Approval(APPROVED)`. Any previously `APPROVED` revision of the same collection → `SUPERSEDED`. Collection `status` → `APPROVED`. Pins are now frozen. |
| `POST /collection-revisions/:revisionId/reject` (+) | REVIEWER | `{ decision: "CHANGES_REQUESTED" \| "REJECTED", comment: string(3..2000) }` | `CollectionRevision` → `REJECTED`. Only from `IN_REVIEW`. Creates `Approval`. To continue work, the editor creates a new revision. |

### 6.11 Activity and export

| Method & path | Role | Request | Response / notes |
|---|---|---|---|
| `GET /projects/:projectId/activity` | VIEWER | `?from=<ISO>&to=<ISO>&actorId=&eventType=&entityType=&entityId=&sort=createdAt:desc` | `ApiList<ActivityEvent>` |
| `POST /projects/:projectId/exports` | VIEWER | `{ format: "JSON" \| "MARKDOWN" \| "CSV" }` | `201 ExportResult`. JSON: project, brief revisions, directions + revisions, references, assets + versions, assessments + items, decisions, collections + revisions + pins. MARKDOWN: human-readable report. CSV: flat table of assets × latest version. Never contains secrets, storage keys, or signed URLs. `warnings` includes `LOCAL_ONLY_FILE_PATHS` when any version uses a non-portable path. Logs `EXPORT_CREATED`. |

---

## 7. Behavior contracts

### 7.1 State machines

BE enforces these; any other transition → `409 INVALID_STATE_TRANSITION`. FE uses them to decide which buttons to show, but BE is the authority.

| Entity | Allowed transitions |
|---|---|
| **Direction** | `DRAFT → ACTIVE` (via active-direction) · `ACTIVE → SUPERSEDED` (when another direction becomes active) · `SUPERSEDED → ACTIVE` (via active-direction) · `DRAFT/SUPERSEDED → ARCHIVED` · `ARCHIVED → DRAFT` (via PATCH). The active direction cannot be archived. |
| **Asset version** | `DRAFT ↔ CANDIDATE ↔ NEEDS_REVIEW` (PATCH) · `* → SUPERSEDED` (PATCH) · `→ APPROVED` / `→ REJECTED` / `→ NEEDS_REVIEW` only through `POST /asset-versions/:id/decisions`. |
| **Assessment** | `PENDING → RUNNING → COMPLETED \| FAILED \| CANCELLED` · `PENDING/RUNNING → CANCELLED` · `FAILED → RUNNING` (retry, same id). `COMPLETED` and `CANCELLED` are terminal. |
| **Assessment item resolution** | `UNRESOLVED/ACCEPTED/OVERRIDDEN/DISMISSED/DEFERRED → any of those` through a new decision. `UNRESOLVED` is never re-entered. |
| **Collection revision** | `DRAFT → IN_REVIEW → APPROVED \| REJECTED` · `APPROVED → SUPERSEDED` (when a newer revision of the same collection is approved). Items editable only in `DRAFT`. |

### 7.2 Invariants visible through the API

These come from PRD §1.5 and ERD §3.6. Each has a test in §11.

| ID | Invariant | Observable behavior |
|---|---|---|
| I-1 | **No silent replacement of approved work.** | After `POST /assets/:id/versions`, every existing collection item still returns the same `pinnedVersion.id`. The item's `isStale` becomes `true`. |
| I-2 | **Frozen revisions.** | Mutating items of a non-`DRAFT` revision → `409 REVISION_FROZEN`. |
| I-3 | **Direction change is non-destructive.** | `active-direction` leaves every asset, version, collection, and past assessment byte-identical. |
| I-4 | **Decisions are append-only.** | There is no `PATCH`/`DELETE` for decisions. Re-resolving creates a new row linked via `supersedesDecisionId`. |
| I-5 | **Assessment reproducibility.** | An assessment's `old/newDirectionRevisionId`, `briefRevisionId`, and item `assetVersion.id`s never change after creation. |
| I-6 | **AI output is untrusted.** | Every item references only version IDs from the assessment's input set; every input version has exactly one item; evidence `sourceId`s are in the input set or `null`; invalid output is rejected or normalized to `REVIEW_REQUIRED` + `HIGH` uncertainty. |
| I-7 | **No cross-project leakage.** | Foreign-project IDs return `404` (reads) or `422 CROSS_PROJECT_REFERENCE` (writes). |
| I-8 | **Idempotent creation.** | Replayed `Idempotency-Key` creates no second assessment/version/asset/collection revision. |
| I-9 | **No fabricated provider metadata.** | Unknown `modelVersion`, token counts, cost → `null`. |
| I-10 | **No secrets in any response, export, log, or activity metadata.** | Provider keys, auth headers, storage keys, signed-URL signatures in logs: never. |
| I-11 | **No false image claims.** | If `imagesSent == 0`, no evidence item has `source: "IMAGE_OBSERVATION"`, and FE must not say an image was inspected. |
| I-12 | **Simulated is labeled.** | `providerName == "mock"` ⇔ `isSimulated == true`. |
| I-13 | **Version numbers are gapless and unique per asset.** | Concurrent `POST …/versions` never produce duplicates (retry on unique violation). |
| I-14 | **Human override is preserved.** | `item.recommendation` is immutable; the override lives only in `resolutionStatus`, `effectiveRecommendation`, and `Decision`. |

### 7.3 What the frontend must visibly distinguish (PRD risk: "version history becomes confusing")

Four different things, four different labels, never merged:

1. **Asset** (logical work item)
2. **Asset version** (immutable iteration)
3. **Latest version** of an asset (`isLatest`, `CollectionItem.latestVersion`)
4. **Pinned version** in a collection revision (`CollectionItem.pinnedVersion`)

Status and recommendation must always carry a text label and an icon, never color alone.

### 7.4 Required UI states (FE)

For every list/detail screen: loading, empty, error-with-retry (show `requestId`), offline, no-results (for filters). For AI actions: pending, failed-with-retry, "Run rules-only instead". Destructive actions (archive project/direction/reference, replace a pinned version, approve/reject a collection revision) need a confirm dialog. Optimistic UI is allowed only for local, reversible UI state, never for approvals, pins, decisions, or version creation.

---

## 8. AI and rules semantics

### 8.1 Division of labor

| Concern | Owner |
|---|---|
| Rules engine (`rules-v1`), direction diff, priority ranking, provider adapter, Zod validation of AI output, usage logging | **BE** |
| Rendering recommendations, evidence, uncertainty, missing information, disclaimer, override UI, "Simulated" badge | **FE** |

### 8.2 Required FE disclaimer

Wherever recommendations are shown, FE displays: *"These are recommendations, not an objective quality judgment. A person decides."* No percentage confidence is shown anywhere; `uncertaintyLevel` is rendered as the words Low / Medium / High.

### 8.3 `rules-v1` minimum behavior (BE-owned; the seed outcomes in §9.3 are the acceptance target)

| Rule id | Behavior |
|---|---|
| `R-MISSING-METADATA` | If `recordedAttributes` is empty for 2+ of {palette, lighting, materials, mood} → `REVIEW_REQUIRED`, uncertainty `HIGH`, list what is missing in `missingInformation`. |
| `R-FORBIDDEN-CONFLICT` | Asset token matches a `forbiddenAttributes` value of the new direction/brief → conflicting evidence; a `hard` match forces `RECREATE_CANDIDATE` unless metadata is missing. |
| `R-REQUIRED-MISSING` | A `hard` required attribute with no matching recorded token → conflicting evidence. |
| `R-STYLE-OVERLAP` | Per style category (palette, lighting, materials, mood): compare recorded tokens to the new direction. 0 conflicting categories + ≥ 2 matches → `REUSE_CANDIDATE`; 1–2 conflicting categories while composition/purpose is still compatible → `ADAPT_CANDIDATE`; ≥ 3 conflicting categories → `RECREATE_CANDIDATE`; anything else → `REVIEW_REQUIRED`. |
| `R-NO-LEGAL-INFERENCE` | Never state or imply rights/licensing from visual compatibility. |

When evidence is thin or contradictory, prefer `REVIEW_REQUIRED` over a confident class.

### 8.4 AI-assisted layer

- The provider adapter returns the internal schema (`ImpactAssessmentItem` fields) only. The domain never depends on a vendor's response shape.
- BE sends the minimum context: new/old direction attributes, brief constraints, and the requested versions' metadata. Briefs, filenames, notes, and image text are **untrusted data**, never instructions.
- `AI_MODE=mock`: deterministic, network-free, same results every run (§9.3), always `isSimulated: true`.
- Billable calls only happen on an explicit user-started assessment or analyze action. Nothing runs in the background.

---

## 9. Seed fixtures (shared by BE seed and FE mocks)

All IDs below are valid UUIDs. BE seeds exactly these; FE mocks return exactly these. FE tests and BE contract tests both assert against them.

### 9.1 Entities

| Entity | ID | Notes |
|---|---|---|
| Demo user | `00000000-0000-4000-8000-000000000001` | "Demo Owner", role `OWNER` |
| **Project** "Solara — Product Visual Campaign" | `00000000-0000-4000-8000-000000000010` | slug `solara-product-visual-campaign`; `activeDirectionRevisionId` = Direction A rev 1 |
| Brief revision 1 | `00000000-0000-4000-8000-000000000020` | |
| Direction A "Cold Industrial" | `00000000-0000-4000-8000-000000000030` | status `ACTIVE` |
| Direction A rev 1 | `00000000-0000-4000-8000-000000000031` | steel blue / graphite / cool white · hard directional high-contrast light · metal, glass, polished surfaces · precise, technical, premium |
| Direction B "Warm Organic" | `00000000-0000-4000-8000-000000000040` | status `DRAFT` |
| Direction B rev 1 | `00000000-0000-4000-8000-000000000041` | amber / cream / warm brown / muted green · soft warm natural light · wood, paper, stone, natural textures · approachable, calm, crafted |
| Asset "Hero Product Reveal" | `00000000-0000-4000-8000-000000000050` | `HERO_IMAGE`, 2 versions |
| Asset "Product Close-up" | `00000000-0000-4000-8000-000000000051` | `PRODUCT_IMAGE`, 1 version |
| Asset "Factory Background" | `00000000-0000-4000-8000-000000000052` | `BACKGROUND`, 1 version (sparse metadata on purpose) |
| Asset "Metal Texture Detail" | `00000000-0000-4000-8000-000000000053` | `TEXTURE`, 1 version |
| Version Hero v1 | `00000000-0000-4000-8000-000000000060` | `SUPERSEDED` |
| Version Hero v2 | `00000000-0000-4000-8000-000000000061` | `APPROVED`, `derivedFromVersionId` = Hero v1 |
| Version Close-up v1 | `00000000-0000-4000-8000-000000000062` | `APPROVED` |
| Version Factory Background v1 | `00000000-0000-4000-8000-000000000063` | `APPROVED`, no recorded lighting or mood |
| Version Metal Texture v1 | `00000000-0000-4000-8000-000000000064` | `CANDIDATE` |
| Collection "Solara Launch Hero Set" | `00000000-0000-4000-8000-000000000070` | `DELIVERABLE`, status `APPROVED` |
| Collection revision 1 | `00000000-0000-4000-8000-000000000071` | `APPROVED`; pins, in order: Hero **v2** (`…0061`), Close-up v1 (`…0062`), Factory Background v1 (`…0063`) |
| Reference "Brushed steel macro" | `00000000-0000-4000-8000-000000000080` | `DEMO_ASSET`, linked to Direction A rev 1 |
| Reference "Warm timber studio" | `00000000-0000-4000-8000-000000000081` | `DEMO_ASSET`, linked to Direction B rev 1 |

Initially `isStale` is `false` for every collection item (no newer versions exist).

Demo files, served by BE at `/demo-assets/*` and used by FE mocks as relative URLs: `hero-v1.jpg`, `hero-v2.jpg`, `closeup-v1.jpg`, `factory-bg-v1.jpg`, `metal-texture-v1.jpg`, `ref-steel.jpg`, `ref-timber.jpg`. Use generated or openly licensed placeholders only.

### 9.2 Demo scenario (PRD §1.10)

Open collection → note pins → switch active direction A→B → run assessment → inspect reasons → override one recommendation → create a new version of an adapted asset → confirm collection still pins the old version → explicitly revise the collection and pin the new version → show activity log. The E2E sequence in §12.3 follows exactly this.

### 9.3 Expected deterministic assessment (Direction A rev 1 → B rev 1, `RULES_ONLY` or mock AI)

| Priority | Asset version | Recommendation | Uncertainty | Why (summary) |
|---|---|---|---|---|
| 1 | Factory Background v1 (`…0063`) | `REVIEW_REQUIRED` | `HIGH` | Missing lighting and mood metadata; pinned in an approved collection. |
| 2 | Metal Texture v1 (`…0064`) | `RECREATE_CANDIDATE` | `LOW` | Metal/polished material, cool palette and hard lighting all conflict with Direction B. |
| 3 | Product Close-up v1 (`…0062`) | `ADAPT_CANDIDATE` | `MEDIUM` | Composition reusable; palette and lighting conflict. Pinned in an approved collection. |
| 4 | Hero Product Reveal v2 (`…0061`) | `REUSE_CANDIDATE` | `MEDIUM` | Composition and mood are compatible; no hard conflicts. |

Counts: one of each class, `unresolved: 4`. `rulesVersion: "rules-v1"`. For the mock provider, `providerName: "mock"`, `isSimulated: true`, `imagesSent: 0`. Each item has ≥ 1 evidence entry with a `sourceId` from the input set, `priorityReason` filled, and `requiresHumanReview: true` for every class except `REUSE_CANDIDATE` with `LOW`/`MEDIUM` uncertainty.

If the owner prefers different seed outcomes, change this table and §14, then both sides update. Do not diverge silently.

---

## 10. Environment and dev setup

| | Value |
|---|---|
| API (dev) | `http://localhost:3001`, base path `/api/v1` |
| Web (dev) | `http://localhost:5173` |
| CORS | BE allows exactly `WEB_ORIGIN`, `credentials: true`, exposes `X-Request-Id`, `Idempotent-Replayed`, `Retry-After`. |
| Static demo files | `GET /demo-assets/*` (no `/api/v1` prefix, no auth) |

**BE `.env.example`** (placeholders only):

```dotenv
NODE_ENV=development
PORT=3001
WEB_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://user:password@localhost:5432/branchframe
AUTH_MODE=demo
DEMO_MODE=true
AI_MODE=mock
OPENAI_API_KEY=
OPENAI_MODEL=
AI_MAX_ASSETS_PER_ASSESSMENT=20
AI_MONTHLY_BUDGET_LIMIT_USD=
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=./.data/uploads
```

**FE `.env.example`:**

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_USE_MOCK_API=true
```

Never put a provider key, model secret, or `DATABASE_URL` behind a `VITE_` name. `.env` is gitignored on both sides.

---

## 11. Contract tests

**BE must ship tests that:**

1. Validate the response of **every** endpoint in §6 against its Zod schema (success and each documented error code).
2. Assert invariants I-1 … I-14 (§7.2). I-6 requires a fault-injection provider that returns a foreign `assetVersionId`, an invalid enum, and a missing item.
3. Assert the §9.3 outcomes on a freshly seeded database.
4. Assert idempotency: double `POST` with one key → one row, second response has `Idempotent-Replayed: true`.
5. Assert authorization shape (even in demo mode, unit-test the role policy table in §3.8).

**FE must ship tests that:**

1. Parse every mock fixture with the shared Zod schemas (so mocks cannot drift from the contract).
2. Render every `Recommendation`, `AssetVersionStatus`, `CollectionRevisionStatus`, and `ResolutionStatus` with text + icon, and render an unknown enum value without crashing.
3. Cover the stale-pin warning (`isStale: true`), frozen revision UI, and the "Simulated" badge.
4. Cover polling: `RUNNING → COMPLETED`, `RUNNING → FAILED` (retry + "run rules-only instead"), and double-click not producing a second request with a new key.
5. Cover each error code in §3.3 that has special UX (`CONFLICT`, `REVISION_FROZEN`, `AI_NOT_CONFIGURED`, `ASSESSMENT_SCOPE_TOO_LARGE`, `RATE_LIMITED`).

**Dev-time runtime check (FE):** in development builds, validate every API response with the Zod schema and `console.error` on mismatch. This makes contract drift loud on integration day.

---

## 12. Integration plan

### 12.1 Sync protocol (agents are on different machines)

1. The human owner copies this file and `packages/contracts/` between machines (git is ideal).
2. Each agent records the **SHA-256 of `INTEGRATION_CONTRACT.md`** it worked from at the top of its `INTEGRATION_NOTES.md`. If the hashes differ at integration, stop and reconcile first.
3. Each agent keeps `INTEGRATION_NOTES.md` with: assumptions (§1.1 rule 3), proposed contract changes, known gaps, and commands to run its tests.

### 12.2 Phased integration

| Phase | Goal | Done when |
|---|---|---|
| 0. Handshake | FE reaches BE | `GET /health` OK; `contractVersion` majors match; CORS works with credentials. |
| 1. Reads | Every screen renders real data | FE dev-time schema validation shows zero errors on the seeded project (§9). |
| 2. Simple writes | Briefs, directions, references, assets, versions | Create/edit flows work; `VALIDATION_ERROR` maps to form fields; `CONFLICT` flow works. |
| 3. Assessment | Impact map end-to-end | §9.3 outcomes shown; override works; polling and failure/retry paths work. |
| 4. Collections | Pinning and approval | I-1, I-2 verified from the UI. |
| 5. Extras | Activity, export, settings, demo reset | Export has no secrets; reset restores §9. |
| 6. Hardening | Accessibility basics, error states, build | Keyboard nav, labels, focus, contrast; production builds pass. |

### 12.3 End-to-end smoke sequence (run top to bottom on a fresh seed)

| # | Call | Expected |
|---|---|---|
| 1 | `GET /health` | `contractVersion` major matches |
| 2 | `POST /demo/reset {confirm:true}` | Project `…0010` |
| 3 | `GET /projects/…0010/summary` | 4 assets, active direction A, `staleCollectionItemCount: 0` |
| 4 | `GET /collection-revisions/…0071` | 3 items pinning `…0061`, `…0062`, `…0063`; none stale |
| 5 | `POST /projects/…0010/active-direction {directionRevisionId:"…0041", reason}` | `previousDirectionRevisionId: …0031`; Direction B `ACTIVE`, A `SUPERSEDED` |
| 6 | `GET /projects/…0010/assets` | unchanged versions and statuses (I-3) |
| 7 | `POST …/impact-assessments` (new `Idempotency-Key`, `RULES_ONLY`, `newDirectionRevisionId: …0041`) | assessment; poll until `COMPLETED` |
| 8 | Repeat #7 with the **same** key and body | `200`, `Idempotent-Replayed: true`, same `id` |
| 9 | `GET /impact-assessments/:id` | §9.3 table exactly |
| 10 | `POST …/items/:metalItemId/decision {resolution:"OVERRIDE", overrideRecommendation:"REVIEW_REQUIRED", rationale}` | `OVERRIDDEN`; `recommendation` still `RECREATE_CANDIDATE`; `effectiveRecommendation` `REVIEW_REQUIRED` |
| 11 | `POST /assets/…0051/versions {derivedFromVersionId:"…0062", revisionRationale, …}` | `versionNumber: 2` |
| 12 | `GET /collection-revisions/…0071` | Close-up still pins `…0062`; `isStale: true`, `newerVersionCount: 1` (I-1) |
| 13 | `PATCH /collection-revision-items/<closeupItem of rev 1> {assetVersionId:<Close-up v2>, rationale}` (rev 1 is `APPROVED`) | `409 REVISION_FROZEN` (I-2) |
| 14 | `POST /collections/…0070/revisions {changeSummary}` | revision 2 `DRAFT`, pins copied exactly |
| 15 | `PATCH /collection-revision-items/<closeupItemInRev2> {assetVersionId:<v2>, rationale}` | pin moves; `REPLACE_PINNED_VERSION` decision |
| 16 | `POST /collection-revisions/<rev2>/submit-review`, then `/approve` | rev 2 `APPROVED`, rev 1 `SUPERSEDED` |
| 17 | `GET /collection-revisions/…0071` | still pins the original three versions (history intact) |
| 18 | `GET /projects/…0010/activity` | includes `ACTIVE_DIRECTION_CHANGED`, `ASSESSMENT_*`, `RECOMMENDATION_RESOLVED`, `ASSET_VERSION_CREATED`, `COLLECTION_REVISION_CREATED`, `COLLECTION_ITEM_REPLACED`, `COLLECTION_APPROVED` |
| 19 | `POST /projects/…0010/exports {format:"JSON"}` | valid JSON; contains no keys/secrets/signed signatures |

### 12.4 Mismatch triage

When FE and BE disagree on integration day: (1) check this file; whoever deviates fixes their side. (2) If the file is ambiguous, pick the option that is simplest for the **frontend** to consume, record it in §14, and update both sides. (3) Never patch a mismatch by adding a client-side workaround for a server rule (e.g. recomputing `isStale`).

---

## 13. Open questions (defaults apply unless the owner says otherwise)

| # | Question | Default used by this contract |
|---|---|---|
| Q1 | Real authentication at integration time? | No. `AUTH_MODE=demo` (D-02). |
| Q2 | Real image uploads in the MVP, or demo assets only? | Both endpoints exist (§6.3); the demo runs on `/demo-assets/*`. FE may hide the upload UI until BE storage works. |
| Q3 | Real OpenAI at integration, or mock only? | Mock. `AI_MODE=openai` is optional and must not block integration. |
| Q4 | One repo or two? | Either. Sync via §12.1. |
| Q5 | UI language | English UI, copy kept in a string table so Indonesian can be added. |
| Q6 | Are the expected seed outcomes in §9.3 right for the demo story? | Yes as written. Adjust the table if not. |
| Q7 | Should `HYBRID` fall back to rules if the AI half fails? | No. The run is `FAILED` and FE offers retry or a new rules-only run. |
| Q8 | `REQUEST_REVISION` currently maps to version status `NEEDS_REVIEW` because the enum has no dedicated state. Acceptable? | Yes. |

---

## 14. Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-10 | Initial contract derived from `branchframe_prd_trd_erd.md` v1.0. |

Versioning rule: **MAJOR** = breaking wire change (rename/remove field, change enum or status code); **MINOR** = additive (new optional field/endpoint); **PATCH** = clarification only. FE and BE must match on MAJOR.

---

## Appendix A — Paste-ready instructions for each agent

### A.1 For the Backend Agent

> You are the Backend Agent for Branchframe. Read `INTEGRATION_CONTRACT.md` and `branchframe_prd_trd_erd.md` fully before writing code. The contract is the source of truth for every URL, field name, enum, status code, and error code. Implement every endpoint in §6 with Fastify (or NestJS, pick one) + TypeScript + PostgreSQL + Zod. Create `packages/contracts` with Zod schemas named exactly as in §4–§5. Apply the schema changes in Appendix B. Seed the database with exactly §9 (same UUIDs). Implement `AI_MODE=mock` first and make it deterministic per §9.3; the OpenAI adapter is optional and last. Enforce invariants I-1…I-14 server-side and write the contract tests in §11. Never expose provider keys, storage keys, or stack traces. Do not add, rename, or remove fields; record proposals in `INTEGRATION_NOTES.md` instead. Report which commands you ran and their real outcomes. Never claim a test passed if you did not run it.

### A.2 For the Frontend Agent

> You are the Frontend Agent for Branchframe. Read `INTEGRATION_CONTRACT.md` and `branchframe_prd_trd_erd.md` fully before writing code. Build React + TypeScript + Vite. Create `packages/contracts` with Zod schemas named exactly as in §4–§5. Build all 10 screens from PRD §1.8 against a mock API (MSW) that returns the §9 fixtures and validates every response with the Zod schemas; toggle with `VITE_USE_MOCK_API`. All server calls go through one API client that sends `credentials: "include"`, handles the error envelope, attaches `Idempotency-Key` where §3.5 requires it, and validates responses in dev. Never recompute business rules (`isStale`, priority, counts, `isSimulated`); display what the server sends. Show the "Simulated" badge, the recommendation disclaimer, and text+icon status labels as specified in §7–§8. Handle every UI state in §7.4. Do not add, rename, or remove fields; record proposals in `INTEGRATION_NOTES.md`. Never put a secret behind a `VITE_` variable. Report which commands you ran and their real outcomes.

---

## Appendix B — ERD adjustments the Backend Agent must apply

The ERD is missing columns the PRD/TRD require. BE adds these in migrations (FE does not care how):

| Table | Addition | Why |
|---|---|---|
| `projects` | `active_direction_revision_id UUID NULL FK → direction_revisions.id` | D-03 |
| `assets` | `tags TEXT[] NOT NULL DEFAULT '{}'` | FR-005 filter by tag |
| `references` | `tags TEXT[] NOT NULL DEFAULT '{}'` | FR-004 tags |
| `decisions` | `collection_revision_id UUID NULL FK` | `PIN_TO_COLLECTION` / `REPLACE_PINNED_VERSION` need a target |
| `collection_items` | `asset_id UUID NOT NULL` + `UNIQUE(collection_revision_id, asset_id)`; app check that `asset_version.asset_id = asset_id` | D-10 |
| `impact_assessments` | `images_sent INTEGER NOT NULL DEFAULT 0`, `direction_diff JSONB NOT NULL DEFAULT '{}'` | §5 DTOs |
| `impact_assessment_items` | `priority INTEGER NOT NULL`, `priority_reason TEXT NOT NULL` | FR-007 ranking must be explained |
| new `idempotency_records` | `(key, actor_id, route, request_hash, response_status, response_body, created_at)` | §3.5 |

Everything else in the ERD stands as written, including all invariants in ERD §3.6.

---
