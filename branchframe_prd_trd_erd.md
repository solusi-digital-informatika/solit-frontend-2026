# Branchframe --- Product Requirements, Technical Requirements, and Entity Relationship Specification

**Document version:** 1.0\
**Status:** Proposed specification for implementation\
**Product type:** AI-assisted visual asset production and
creative-change management\
**Primary target:** Small creative teams, AI artists, art directors,
design studios, and campaign/content teams\
**Initial delivery:** Web application; hackathon MVP first\
**Default language:** English UI with Indonesian-ready copy
architecture\
**Core principle:** AI recommends; people decide. Existing approved work
must never be silently overwritten.

------------------------------------------------------------------------

# 0. Executive Summary

Branchframe is a workspace for teams producing visual assets with
generative AI. It organizes briefs, creative directions, references,
assets, versions, prompts, decisions, and approvals so that a change in
creative direction does not destroy the value or context of earlier
work.

Branchframe is **not** another image generator. It can connect to a
vision-capable language model for analysis, but it does not require
image generation to demonstrate value. The product's central workflow
is:

1.  Capture a brief and a creative direction.
2.  Organize reference images and asset requirements.
3.  Register visual assets and their versions.
4.  Record which direction, references, prompts, and decisions informed
    each version.
5.  Change the direction or brief.
6.  Generate an impact assessment that identifies assets as
    `REUSE_CANDIDATE`, `ADAPT_CANDIDATE`, `REVIEW_REQUIRED`, or
    `RECREATE_CANDIDATE`.
7.  Explain the evidence and uncertainty behind each recommendation.
8.  Let a human accept, reject, or override the recommendation.
9.  Preserve the previous versions and any approved collection/timeline.
10. Record the decision and the resulting new version or status.

The distinctive product hypothesis is that creative teams need a
**traceable change-impact and reuse workflow**, not just asset storage,
image generation, or version history.

## 0.1 Product promise

**Tagline:** Change the direction. Not the work you've done.

**UVP:** Branchframe turns creative direction changes into traceable,
asset-level production decisions, helping AI-assisted creative teams
identify reusable work, understand revision impact, and preserve
approved production history.

## 0.2 Non-goals

-   Replacing the art director or creative team's judgment.
-   Guaranteeing that an AI model can reproduce an image exactly.
-   Generating video or requiring paid image-generation calls.
-   Automatically modifying approved assets when a brief changes.
-   Serving as a full Photoshop, Figma, or professional digital asset
    management replacement.
-   Claiming legal ownership or licensing rights for imported
    references.
-   Claiming objective visual truth from model-generated image
    descriptions.
-   Using confidential client materials in the demo without explicit
    permission.

------------------------------------------------------------------------

# 1. PRD --- Product Requirements Document

## 1.1 Problem statement

Small creative teams using generative AI often iterate rapidly, but
production context is scattered across briefs, chat messages,
moodboards, prompt documents, folders, and image-generation tools. When
a brief or art direction changes, teams may not know:

-   Which assets are still compatible with the new direction.
-   Which assets can be reused with small adjustments.
-   Which assets conflict with the new direction.
-   Why an asset was created or approved.
-   Which prompt, model, reference, or settings produced a version.
-   Whether an asset is approved for final use.
-   Whether a previously approved collection has changed.
-   What must be reviewed by a human before work can proceed.

This can lead to duplicate effort, missed changes, inconsistent output,
slow handoffs, and loss of useful creative knowledge.

## 1.2 Product hypothesis

If Branchframe links creative requirements, direction versions,
references, assets, asset versions, decisions, and approvals---and then
presents a reasoned impact map when direction changes---teams will be
able to assess changes faster and preserve more useful work.

This is a hypothesis to validate, not an established market fact.

## 1.3 Target users and personas

### Persona A --- AI Artist / Visual Designer

-   Produces multiple visual concepts and iterations.
-   Needs to remember which prompts, references, and settings worked.
-   Wants to reuse useful compositions or assets rather than search
    through folders.
-   Needs to show alternatives and revision history.

### Persona B --- Art Director / Creative Lead

-   Owns visual direction and approves or rejects assets.
-   Needs to communicate a change and see its impact.
-   Wants the team to distinguish a suggestion from an approved
    decision.
-   Must retain final authority over creative choices.

### Persona C --- Producer / Project Coordinator

-   Tracks status, dependencies, approvals, and outstanding reviews.
-   Needs to identify blocked assets and changes requiring attention.
-   Wants a reliable view of which versions are approved for delivery.

### Persona D --- Small Studio Owner

-   Needs continuity when a team member is unavailable.
-   Wants a durable record of creative decisions and production
    knowledge.
-   Has limited time and budget for complicated production software.

## 1.4 Jobs to be done

1.  When the creative direction changes, show me which assets may be
    affected and why.
2.  When I open an asset, show me its lineage: source brief, direction,
    references, versions, prompts, decisions, and approvals.
3.  When an asset is revised, preserve the old version and its approval
    state.
4.  When I hand work to another person, provide enough context to
    continue without relying on memory.
5.  When AI makes a recommendation, show the evidence, uncertainty, and
    relevant missing information.
6.  When I approve a collection, freeze the exact versions that were
    approved.
7.  When I need to present work, export a concise summary without
    exposing secrets or private provider credentials.

## 1.5 Product principles

-   **Human authority:** AI recommendations are advisory.
-   **Traceability:** Important state changes have an actor, timestamp,
    reason, and related entity.
-   **Immutable versions:** A saved asset version is not edited in
    place; a revision creates a new version.
-   **Explicit approval:** Approval belongs to a specific asset version,
    not merely to an asset's mutable current state.
-   **Explainability:** Recommendations include evidence, missing
    evidence, and confidence/uncertainty.
-   **Graceful degradation:** The app remains useful if the AI provider
    is unavailable.
-   **Cost awareness:** Do not generate images automatically; AI
    analysis is user-triggered and budget-aware.
-   **Privacy by default:** Provider keys are never placed in browser
    code or committed to the repository.
-   **Reversible decisions:** Users can supersede a decision without
    deleting its history.

## 1.6 MVP scope

### P0 --- Required for the first usable demo

1.  Create/open a demo project.
2.  Edit project brief and creative direction.
3.  Create direction versions or branches.
4.  Add references using uploaded/local demo images or safe sample
    assets.
5.  Register visual assets with title, description, tags, and status.
6.  Create an asset version and attach prompt/model/settings metadata
    when available.
7.  View version history and compare two versions side by side.
8.  Trigger a direction-change impact assessment.
9.  Display an impact map with four recommendation classes.
10. Explain each recommendation using explicit reasons and missing
    information.
11. Allow a human to accept, reject, or override each recommendation.
12. Create a decision record when a recommendation is resolved.
13. Create an approved asset collection pinned to exact version IDs.
14. Ensure a new asset version does not silently replace the approved
    version.
15. Show activity/decision history.
16. Provide mock AI mode that requires no external API.
17. Provide reset-demo-data functionality.

### P1 --- Useful after the core workflow works

-   Optional OpenAI API integration for text analysis and image
    understanding.
-   Prompt/creative-brief analysis into structured requirements.
-   Reference-image attribute extraction (palette, lighting,
    composition, texture, mood) with user review.
-   Local persistence or backend persistence.
-   JSON/CSV export and human-readable project report.
-   Basic search and filters.
-   Cost/usage ledger for AI calls.
-   Retry and failure states for AI jobs.
-   Project roles: owner, editor, reviewer, viewer.

### P2 --- Explicitly deferred

-   Image generation or editing through paid APIs.
-   Automated perceptual similarity / embeddings at scale.
-   Cloud asset storage and multi-region deployment.
-   Real-time multi-user collaboration.
-   Fine-grained enterprise permission policies.
-   Plugin integrations with creative applications.
-   Automatic publishing to external channels.
-   Advanced visual dependency graphs and workflow automation.

## 1.7 Functional requirements

Priority labels: `MUST`, `SHOULD`, `COULD`, `WON'T (MVP)`.

### FR-001 Project workspace

-   MUST display project name, summary, current direction, asset counts,
    and unresolved reviews.
-   MUST allow creating a project from a template or demo seed.
-   MUST allow editing project metadata.
-   MUST show the project's current active direction.
-   MUST prevent deletion of a project with destructive side effects
    without confirmation.
-   SHOULD support archive/restore.
-   MUST support a no-backend demo mode.

Acceptance criteria: - A user can open the demo project and navigate to
its assets. - Project metadata survives page navigation. - Resetting the
demo restores a known seed state.

### FR-002 Brief management

-   MUST store a brief title, objective, audience, deliverables,
    constraints, required attributes, forbidden attributes, and
    acceptance criteria.
-   MUST keep brief revisions rather than silently overwriting history.
-   MUST let users create a new revision with a change summary.
-   MUST associate an impact assessment with the specific
    brief/direction revision used.
-   SHOULD support pasted text and Markdown.
-   P1: support document upload and extraction.

Acceptance criteria: - Saving a new brief revision preserves the
previous revision. - An impact assessment displays the exact
brief/direction version it evaluated.

### FR-003 Creative directions

-   MUST allow a project to have multiple named directions/branches.
-   MUST capture direction description, visual principles, palette,
    lighting, composition, texture/material, mood, typography (if
    relevant), and exclusions.
-   MUST allow a direction to be marked `DRAFT`, `ACTIVE`, `SUPERSEDED`,
    or `ARCHIVED`.
-   MUST not automatically overwrite asset versions when active
    direction changes.
-   MUST record who changed the active direction and why.
-   SHOULD support cloning an existing direction into an alternative
    branch.

Acceptance criteria: - Switching from Direction A to Direction B leaves
existing asset versions intact. - The interface clearly identifies the
active direction and any superseded direction.

### FR-004 Reference library

-   MUST allow registering a reference with title, source, URL or local
    file reference, notes, tags, and rights/usage note.
-   MUST allow linking a reference to a direction, brief revision,
    asset, or asset version.
-   MUST allow classifying reference attributes such as palette,
    lighting, composition, texture, mood, and typography.
-   SHOULD show a thumbnail if the asset is an image.
-   MUST distinguish user-provided interpretation from AI-inferred
    attributes.
-   MUST not treat a reference as proof that the user has rights to
    reproduce it.

Acceptance criteria: - A reference can be linked to multiple entities. -
A reference's original source and usage note remain visible. -
AI-derived metadata can be corrected by a human.

### FR-005 Asset registry

-   MUST store asset title, purpose, asset type, current status, tags,
    owner, and project.
-   MUST support asset types such as `HERO_IMAGE`, `PRODUCT_IMAGE`,
    `BACKGROUND`, `TEXTURE`, `CHARACTER`, `CONCEPT_ART`, `LAYOUT`,
    `OTHER`.
-   MUST support statuses such as `DRAFT`, `IN_PROGRESS`,
    `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, `ARCHIVED`.
-   MUST distinguish asset identity from individual asset versions.
-   MUST support filters by status, type, direction, tag, and owner.

Acceptance criteria: - An asset can have multiple versions. - Asset
status changes do not delete version history.

### FR-006 Asset versioning and lineage

-   MUST create a new version for every saved revision.
-   MUST store version number, file/reference URI, thumbnail URI if
    available, prompt, negative prompt if available, provider/model,
    generation settings, direction revision, brief revision, creator,
    and creation time.
-   MUST support a `derived_from_version_id` relation.
-   MUST record a revision rationale.
-   MUST permit a version to be marked as a candidate, reviewed,
    approved, rejected, or superseded.
-   MUST not mutate the content metadata of a previously saved version
    except for narrowly scoped administrative corrections that are
    audited.
-   MUST show parent/derived version lineage.

Acceptance criteria: - Creating version 2 leaves version 1 viewable. -
Version 1's approval record still refers to version 1 after version 2 is
created. - The UI clearly distinguishes the asset's latest version from
the version used by an approved collection.

### FR-007 Direction-change impact assessment

-   MUST be explicitly triggered by a user or a defined workflow; no
    hidden paid AI calls.
-   MUST record the old direction, new direction, included asset
    versions, analysis method, model/provider if any, and assessment
    timestamp.
-   MUST assign each evaluated asset version a recommendation:
    -   `REUSE_CANDIDATE`
    -   `ADAPT_CANDIDATE`
    -   `REVIEW_REQUIRED`
    -   `RECREATE_CANDIDATE`
-   MUST include a human-readable rationale, evidence items, missing
    information, and uncertainty.
-   MUST support deterministic rules-only analysis when AI is disabled.
-   MUST allow the user to accept, reject, or override each
    recommendation.
-   MUST display a disclaimer that the result is a recommendation, not
    an objective quality judgment.
-   MUST never auto-delete or auto-replace an asset.
-   SHOULD rank results by urgency or risk, but must explain the
    ranking.

Acceptance criteria: - Every recommendation can be opened to view its
reasons. - If evidence is insufficient, the system can return
`REVIEW_REQUIRED` instead of inventing certainty. - An API/provider
failure leaves the user able to retry or use rules-only mode.

### FR-008 Human decision and decision log

-   MUST record the decision type, entity, actor, timestamp, rationale,
    and prior recommendation if applicable.
-   MUST support decisions such as `ACCEPT_RECOMMENDATION`,
    `OVERRIDE_RECOMMENDATION`, `REJECT_ASSET`, `APPROVE_VERSION`,
    `REQUEST_REVISION`, `CHANGE_DIRECTION`, `PIN_TO_COLLECTION`.
-   MUST retain previous decisions.
-   MUST permit a later superseding decision without erasing the old
    one.
-   SHOULD support comments and reviewer identity.

Acceptance criteria: - Every resolved impact-map item has a decision or
is explicitly left unresolved. - A decision can be traced back to the
assessment and asset version that informed it.

### FR-009 Approval and approved collection

-   MUST allow creating a collection of assets for a deliverable or
    review milestone.
-   MUST pin each collection item to a specific `asset_version_id`.
-   MUST track collection status: `DRAFT`, `IN_REVIEW`, `APPROVED`,
    `SUPERSEDED`, `ARCHIVED`.
-   MUST require an explicit user action to replace a pinned version.
-   MUST show when a newer version exists than the pinned version.
-   MUST preserve the historical state of an approved collection.
-   SHOULD allow a reviewer to approve or request changes at collection
    level.

Acceptance criteria: - Creating a new version of a pinned asset does not
change the approved collection. - The UI shows a warning if the latest
version differs from the approved pinned version. - Replacing a pinned
version creates an auditable collection revision.

### FR-010 AI assistant

-   MUST separate provider integration from core business logic.
-   MUST validate provider output against an application schema.
-   MUST label AI-inferred content as AI-generated.
-   MUST provide mock mode and deterministic fallback.
-   MUST use explicit user action for billable analysis.
-   SHOULD support text-only analysis first, then image understanding.
-   MUST avoid sending full project contents when only a subset is
    needed.
-   MUST log usage metadata, not secret keys or unnecessary raw content.
-   MUST not claim the AI has inspected an image unless image bytes or
    an accessible image input were actually supplied.

Acceptance criteria: - If AI is disabled, the rest of the product
remains usable. - Invalid model output is rejected or safely normalized
rather than trusted. - API keys are not exposed in the frontend bundle
or browser network calls.

### FR-011 Search and filtering

-   MUST support basic text search across project, asset title,
    description, tags, and reference notes.
-   MUST filter by asset status, type, direction, and recommendation
    class.
-   SHOULD support sorting by updated date, version, status, and title.
-   P2: semantic search over text and visual embeddings.

### FR-012 Export

-   MUST export project metadata, directions, assets, versions,
    decisions, and collection pins as JSON.
-   SHOULD export a human-readable Markdown/CSV report.
-   MUST exclude secrets and provider API keys.
-   MUST warn when exported records contain local-only file paths that
    will not resolve elsewhere.
-   P1: export a ZIP package with metadata and user-authorized media
    files.

### FR-013 Activity history

-   MUST record important actions: project created/updated, brief
    revision, direction change, asset version created, impact assessment
    completed, recommendation resolved, approval changed, collection
    pinned/revised, export performed.
-   MUST include actor, timestamp, action, entity, and concise summary.
-   MUST not expose internal API secrets in activity details.
-   SHOULD support filters by date, actor, and action type.

### FR-014 Demo mode

-   MUST have a seeded fictional campaign with at least four assets.
-   MUST include two directions, at least one approved collection, and
    version history.
-   MUST simulate a change from `Cold Industrial` to `Warm Organic`.
-   MUST provide deterministic expected outcomes for demo reliability.
-   MUST make clear that mock recommendations are simulated.
-   MUST not require external network access for the core demo after
    initial assets load.

## 1.8 UX requirements and principal screens

1.  **Project Home:** project status, active direction, recent
    decisions, unresolved items, asset summary.
2.  **Brief & Direction:** structured brief, direction attributes,
    revision history, branch selector.
3.  **Reference Board:** reference thumbnails, tags, attribute notes,
    source/rights note.
4.  **Asset Library:** searchable/filterable grid/list with status and
    version indicator.
5.  **Asset Detail:** preview, metadata, version timeline, lineage,
    prompt/settings, linked references, decisions.
6.  **Impact Map:** old vs new direction summary, per-asset
    recommendation, rationale, evidence, missing info, action controls.
7.  **Version Compare:** side-by-side image/metadata comparison,
    revision rationale, approval state.
8.  **Approved Collection:** version-pinned assets, collection revision,
    review state, stale-version warnings.
9.  **Activity Log:** chronological audit history.
10. **Settings:** AI mode, provider/model configuration status, usage
    limits, privacy information, demo reset.

UX rules: - Never use color alone to communicate a recommendation or
approval state. - Show explicit labels and accessible status icons. -
Provide empty, loading, error, retry, offline, and no-results states. -
Require confirmation for destructive actions. - Use optimistic UI only
for reversible local actions; show pending/error states for API
operations. - Avoid a generic AI-chat dashboard as the primary
interface. The main interface is the asset/change workflow.

## 1.9 Recommendation semantics

The four recommendation classes are not a numerical quality score.

-   **Reuse candidate:** available evidence suggests the asset still
    satisfies the new requirements without modification.
-   **Adapt candidate:** some attributes may conflict, but the asset's
    composition or other reusable properties appear valuable.
-   **Review required:** evidence is missing, ambiguous, contradictory,
    or high-impact; a human must decide.
-   **Recreate candidate:** several core requirements appear
    incompatible, or the asset depends on an obsolete creative premise.

Each result should include: - `recommendation` - `rationale` -
`supporting_evidence[]` - `conflicting_evidence[]` -
`missing_information[]` - `suggested_actions[]` - `uncertainty_level`:
`LOW`, `MEDIUM`, `HIGH` - `requires_human_review`: boolean -
`analysis_source`: `RULES`, `AI`, or `HYBRID`

Do not display fabricated percentage confidence unless it has been
calibrated and evaluated. Prefer qualitative uncertainty labels.

## 1.10 Core demo scenario

Seed project: **Solara --- Product Visual Campaign**.

Direction A: `Cold Industrial` - Palette: steel blue, graphite, cool
white. - Lighting: hard, directional, high contrast. - Materials: metal,
glass, polished surfaces. - Mood: precise, technical, premium.

Direction B: `Warm Organic` - Palette: amber, cream, warm brown, muted
green. - Lighting: soft, warm, natural. - Materials: wood, paper, stone,
natural textures. - Mood: approachable, calm, crafted.

Seed assets: 1. `Hero Product Reveal` --- composition may remain usable;
likely `ADAPT_CANDIDATE` or `REUSE_CANDIDATE` depending on recorded
attributes. 2. `Product Close-up` --- likely `ADAPT_CANDIDATE`. 3.
`Factory Background` --- likely `REVIEW_REQUIRED` or
`RECREATE_CANDIDATE`. 4. `Metal Texture Detail` --- likely
`RECREATE_CANDIDATE`.

Demo sequence: 1. Open the approved collection and note its pinned
version IDs. 2. Change the active direction from A to B. 3. Run impact
assessment. 4. Review the reasons and evidence for each asset. 5.
Override one recommendation to demonstrate human authority. 6. Create a
new version for an adapted asset. 7. Confirm the approved collection
still points to its previous version. 8. Explicitly revise the
collection and pin the new version. 9. Show the decision/activity log.

## 1.11 Success metrics

For a hackathon prototype, measure workflow outcomes rather than
generated-image quality.

-   **Impact assessment completion time:** time from direction change to
    a reviewed set of recommendations.
-   **Decision traceability:** percentage of resolved recommendations
    with rationale and actor.
-   **Version integrity:** number of cases where approved versions are
    accidentally changed; target zero.
-   **Human override rate:** tracked to evaluate recommendation
    usefulness, not treated automatically as failure.
-   **Context completeness:** percentage of asset versions with
    direction, source, and revision rationale recorded.
-   **Demo completion rate:** percentage of test users who complete the
    change-impact scenario without help.
-   **Perceived clarity:** post-task rating on whether users understand
    what changed and what to do next.
-   **API cost per assessment:** recorded when real API mode is enabled.

Do not claim time savings until tested with users and compared to a
baseline.

## 1.12 Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  AI recommendations are wrong        Explain evidence; use
                                      review-required state; human
                                      override; no automatic replacement

  AI hallucinates attributes          Separate user-provided facts from
                                      AI-inferred observations; allow
                                      correction

  API cost grows                      Explicit trigger, model
                                      configuration, image count limits,
                                      usage logging, mock mode

  Provider is unavailable             Rules-only mode, retry, clear
                                      status

  Team over-trusts a recommendation   Explain limitations and require
                                      approval for consequential changes

  Version history becomes confusing   Distinguish asset, asset version,
                                      collection revision, and pinned
                                      version

  Product looks like a generic        Make direction-change impact map
  gallery                             the main demo path

  Rights issues with references       Source and usage notes; use
                                      authorized/public/demo assets

  Secrets leak                        Backend-only provider keys,
                                      environment variables, redaction

  Scope creep                         Keep generation, collaboration, and
                                      external integrations out of MVP
  -----------------------------------------------------------------------

## 1.13 Definition of Done for MVP

-   All P0 functional requirements pass manual acceptance tests.
-   No secret or API key exists in source control or client bundle.
-   Existing approved collection items remain pinned to exact versions.
-   Mock mode works without API credentials.
-   Impact assessment can be retried and does not duplicate records on
    repeated clicks.
-   Error and empty states are implemented.
-   Demo data can be reset.
-   README documents setup, environment variables, AI mode, and
    limitations.
-   At least one end-to-end test covers direction change → impact
    assessment → decision → new version → approved collection integrity.
-   Accessibility basics are checked: keyboard navigation, labels, focus
    visibility, sufficient contrast.

------------------------------------------------------------------------

# 2. TRD --- Technical Requirements Document

## 2.1 Architecture decisions

### Recommended architecture for a real product

-   **Frontend:** React + TypeScript + Vite.
-   **Backend API:** TypeScript + Node.js (Fastify or NestJS). Choose
    one; do not combine both.
-   **Database:** PostgreSQL.
-   **ORM/migrations:** Prisma or Drizzle. Pick one and keep schema
    migrations in source control.
-   **File storage:** S3-compatible object storage in production; local
    filesystem for development only.
-   **AI integration:** OpenAI API through a backend provider adapter.
-   **Validation:** Zod on API boundaries; database constraints as a
    second line of defense.
-   **Testing:** Vitest for unit/integration tests; Playwright for key
    browser workflows.
-   **Observability:** structured logs, request IDs, redacted provider
    usage metrics.
-   **Deployment:** containerized web and API services; managed
    PostgreSQL and object storage where possible.

### Hackathon shortcut

If time is extremely limited, implement React + TypeScript + Vite with
mock data and IndexedDB/localStorage. Keep domain services and
interfaces separated so a backend can be added later. Do not put an
OpenAI API key in browser code. If real API integration is needed, add a
small server-side API route or separate backend.

### Architecture principle

Do not couple the domain model to the OpenAI response shape. The
provider adapter returns an internal validated schema; the rest of the
application depends only on that schema.

## 2.2 Logical architecture

``` mermaid
flowchart TB
  U[User / Creative Team] --> FE[React + TypeScript UI]
  FE --> API[Application API]
  API --> AUTH[Authentication / Authorization]
  API --> DOM[Domain Services]
  DOM --> DB[(PostgreSQL)]
  DOM --> OBJ[Object Storage]
  DOM --> IMP[Impact Assessment Service]
  IMP --> RULES[Deterministic Rules Engine]
  IMP --> AI[AI Provider Adapter]
  AI --> OAI[OpenAI API]
  DOM --> AUDIT[Audit / Activity Service]
  AUDIT --> DB
  API --> JOB[Job Queue - optional P1]
  JOB --> IMP
```

For the hackathon frontend-only mode, replace API/database/object
storage with local repositories and seeded data. Keep the same domain
interfaces.

## 2.3 Suggested repository structure

``` text
branchframe/
  apps/
    web/
      src/
        app/
          router/
          providers/
        components/
          ui/
          layout/
        features/
          projects/
          briefs/
          directions/
          references/
          assets/
          impact-assessments/
          decisions/
          collections/
          activity/
          settings/
        domain/
          entities/
          enums/
          policies/
          services/
        application/
          use-cases/
          ports/
          dto/
        infrastructure/
          repositories/
          storage/
          ai/
          persistence/
        lib/
          validation/
          errors/
          logging/
        test/
    api/                         # add for backend version
      src/
        modules/
          auth/
          projects/
          briefs/
          directions/
          references/
          assets/
          assessments/
          decisions/
          collections/
          activity/
          ai/
        common/
        config/
        test/
  packages/
    contracts/                   # shared request/response schemas
    eslint-config/
    tsconfig/
  prisma/ or db/
    schema.prisma or migrations/
  docs/
    PRD.md
    TRD.md
    ERD.md
  .env.example
  README.md
```

Avoid importing database or provider SDKs into React components. UI
components call application use cases/hooks; use cases call
repository/provider interfaces.

## 2.4 Domain modules

1.  **Projects:** lifecycle, members, project metadata.
2.  **Briefs:** immutable revisions and requirements.
3.  **Directions:** direction branches and revisions.
4.  **References:** reference metadata and attribute annotations.
5.  **Assets:** logical asset records.
6.  **Asset versions:** immutable version metadata and lineage.
7.  **Impact assessments:** run metadata and per-version
    recommendations.
8.  **Decisions:** human resolutions, overrides, rationale.
9.  **Collections:** deliverable/review groupings and pinned versions.
10. **Activity:** auditable domain events.
11. **AI provider:** model selection, structured output, cost/usage
    logging.
12. **Storage:** file upload, signed URLs, content metadata.
13. **Authentication/authorization:** user identity and project-level
    roles (P1 if single-user hackathon).

## 2.5 Core data rules

-   IDs: UUIDs generated by the application/database.
-   Time: store UTC timestamps; render in the user's local timezone.
-   Deletion: prefer soft delete/archive for projects, directions,
    assets, and references. Immutable version and decision history
    should not be cascade-deleted casually.
-   Foreign keys: enforce referential integrity in PostgreSQL.
-   Version numbers: unique per asset; allocate inside a transaction.
-   Approved collection items: always reference `asset_version_id`,
    never just `asset_id`.
-   Direction changes: create a new direction revision or activate an
    existing branch; never mutate the historical assessment context.
-   AI results: store provider/model/version and schema version. Do not
    treat them as source-of-truth for creative intent.
-   Audit events: do not store credentials, full authorization headers,
    or unnecessary raw image content.
-   Idempotency: write endpoints that create an assessment or version
    should accept an idempotency key.
-   Timeouts: AI provider calls must have bounded timeout and a retry
    policy with backoff.
-   AI retries: retries must not create duplicate assessments/decisions.
-   Concurrency: use optimistic locking or revision checks for
    conflicting updates.

## 2.6 AI integration design

### Use cases

1.  **Brief parsing:** convert long free text into a structured set of
    requirements, constraints, and open questions.
2.  **Reference analysis:** describe visible palette, lighting,
    composition, materials, mood, and notable elements.
3.  **Direction comparison:** summarize the differences between two
    direction revisions.
4.  **Asset impact assessment:** compare the new direction with an
    asset's recorded metadata and, optionally, an image input.
5.  **Revision guidance:** suggest what could be changed while
    preserving reusable elements.

### Important limitation

A language/vision model cannot reliably know the actual generation
history of an image unless the application provides it. It cannot
guarantee exact reproducibility, licensing status, or objective creative
quality. If the model has not received the image, it must not claim to
have visually inspected it.

### Provider abstraction

Define an internal interface such as:

``` ts
interface CreativeAnalysisProvider {
  analyzeBrief(input: BriefAnalysisInput): Promise<BriefAnalysisResult>;
  analyzeReference(input: ReferenceAnalysisInput): Promise<ReferenceAnalysisResult>;
  assessDirectionChange(input: ImpactAssessmentInput): Promise<ImpactAssessmentResult>;
}
```

Implement: - `MockCreativeAnalysisProvider`: deterministic seeded
results; no network. - `OpenAICreativeAnalysisProvider`: backend-only
integration. - Future providers can be added without changing domain
logic.

### AI request pipeline

1.  User explicitly starts an analysis.
2.  Server checks project access, limits, input size, and whether
    analysis is allowed.
3.  Server assembles the minimum relevant context.
4.  Provider adapter sends text and optional image input.
5.  Model returns structured output constrained by a schema where
    supported.
6.  Server validates output again with Zod.
7.  Domain validation checks referenced IDs and allowed enum values.
8.  Persist assessment and item results with provider/model/schema
    metadata.
9.  Return result to UI with uncertainty and limitations.
10. Log usage/cost metadata and redact sensitive fields.

### Structured output contract (illustrative)

``` ts
type Recommendation =
  | "REUSE_CANDIDATE"
  | "ADAPT_CANDIDATE"
  | "REVIEW_REQUIRED"
  | "RECREATE_CANDIDATE";

type UncertaintyLevel = "LOW" | "MEDIUM" | "HIGH";

interface AssetImpactResult {
  assetVersionId: string;
  recommendation: Recommendation;
  rationale: string;
  supportingEvidence: Array<{
    source: "BRIEF" | "DIRECTION" | "ASSET_METADATA" | "IMAGE_OBSERVATION" | "USER_NOTE";
    statement: string;
    sourceId: string | null;
  }>;
  conflictingEvidence: Array<{
    source: string;
    statement: string;
    sourceId: string | null;
  }>;
  missingInformation: string[];
  suggestedActions: string[];
  uncertaintyLevel: UncertaintyLevel;
  requiresHumanReview: boolean;
}
```

The actual JSON Schema must be compatible with the selected model/API.
Validate on the server even if the API promises schema-constrained
output.

### Prompt-injection and untrusted content

Briefs, filenames, image text, reference URLs, and imported documents
are untrusted data. The model instruction must treat them as content to
analyze, not as system instructions. Never allow the model to execute
arbitrary tools, read secrets, or choose arbitrary network destinations.
Avoid automatic URL fetching in the MVP.

### Model selection and cost

-   Make the model configurable server-side via environment variables.
-   Use a low-cost text model for simple brief parsing if its quality
    meets evaluation needs.
-   Use a vision-capable model only when image inspection is needed.
-   Send only relevant references/assets, not the entire project by
    default.
-   Limit image count and image resolution for each assessment.
-   Add per-user/project rate limits and an optional monthly budget
    ceiling.
-   Store provider usage information when returned; if unavailable,
    store `null` rather than inventing cost.
-   Never promise a fixed price per assessment without measuring actual
    usage and checking current provider pricing.

### ChatGPT Plus versus API

A ChatGPT Plus subscription and API usage are separate products/billing
systems. A friend having Plus does not, by itself, supply API access or
prepaid API credits for Branchframe. For an app integration, the account
owner must configure API access/billing separately, keep the API key on
a backend they control, and agree to the cost and data handling. Do not
ask the friend to share their personal login or embed their key in the
frontend. See official billing documentation:
https://help.openai.com/en/articles/9039756-managing-billing-settings-on-chatgpt-web-and-platform.

### Image understanding

For image analysis, use an API/model that explicitly supports image
inputs. Image input usage may contribute to API cost. Keep image
analysis optional and user-triggered. Official guide:
https://developers.openai.com/api/docs/guides/images-vision.

### Structured outputs

Use schema-constrained outputs when supported, but still validate the
response and handle refusals, incomplete responses, and provider errors.
Official guide:
https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses.

## 2.7 Impact assessment algorithm

Use a hybrid design. Deterministic checks provide stable, explainable
baseline behavior; AI may interpret ambiguous text or image content.

### Input

-   Project ID.
-   Old direction revision ID.
-   New direction revision ID.
-   Asset version IDs in scope.
-   Brief revision ID.
-   Asset metadata and user annotations.
-   Optional image inputs.
-   Assessment mode (`RULES_ONLY`, `AI_ASSISTED`).

### Deterministic rule examples

-   If a required attribute directly contradicts a forbidden attribute,
    flag the conflict.
-   If an asset is missing key metadata, return `REVIEW_REQUIRED`.
-   If the asset's recorded palette/material/lighting matches the new
    direction and no hard constraint conflicts, it may be a reuse
    candidate.
-   If composition/purpose is still useful but one or more style
    attributes differ, it may be an adapt candidate.
-   If the asset depends on an explicit requirement removed by the new
    brief, flag it for review or recreation.
-   Never infer that an asset is legally usable based on visual
    compatibility.

Rules must be configurable and versioned. They should not imply that a
simple keyword match understands nuanced art direction.

### AI-assisted layer

-   Compare structured old/new direction attributes.
-   Summarize differences.
-   Examine user-supplied asset metadata and optional image.
-   Return recommendation plus evidence and missing data.
-   Domain service validates that the model only refers to
    assets/versions in the request.
-   If evidence conflicts or uncertainty is high, prefer
    `REVIEW_REQUIRED`.

### Human resolution

-   `ACCEPT`: accept the suggested next step, not an irreversible
    automatic mutation.
-   `OVERRIDE`: user chooses another recommendation and provides
    optional/required rationale based on project policy.
-   `DEFER`: leave unresolved.
-   `DISMISS`: mark the recommendation as not applicable with a reason.

## 2.8 API design (backend target)

Prefix: `/api/v1`. JSON requests/responses. UUID identifiers. Auth
required except health check and public static demo routes if explicitly
configured.

  ------------------------------------------------------------------------------------------------------------
  Method                  Endpoint                                                     Purpose
  ----------------------- ------------------------------------------------------------ -----------------------
  GET                     `/health`                                                    Health check

  GET/POST                `/projects`                                                  List/create projects

  GET/PATCH/DELETE        `/projects/:projectId`                                       Read/update/archive
                                                                                       project

  GET/POST                `/projects/:projectId/brief-revisions`                       List/create brief
                                                                                       revisions

  GET/POST                `/projects/:projectId/directions`                            List/create directions

  GET/POST                `/directions/:directionId/revisions`                         List/create direction
                                                                                       revisions

  POST                    `/projects/:projectId/active-direction`                      Activate direction
                                                                                       revision

  GET/POST                `/projects/:projectId/references`                            List/register
                                                                                       references

  POST                    `/projects/:projectId/assets`                                Create asset

  GET                     `/projects/:projectId/assets`                                Search/filter assets

  GET/PATCH               `/assets/:assetId`                                           Read/update asset
                                                                                       metadata

  GET/POST                `/assets/:assetId/versions`                                  List/create asset
                                                                                       versions

  GET                     `/asset-versions/:versionId`                                 Read version detail

  POST                    `/projects/:projectId/impact-assessments`                    Start assessment

  GET                     `/impact-assessments/:assessmentId`                          Read assessment and
                                                                                       results

  POST                    `/impact-assessments/:assessmentId/items/:itemId/decision`   Resolve one
                                                                                       recommendation

  GET/POST                `/projects/:projectId/collections`                           List/create collections

  POST                    `/collections/:collectionId/revisions`                       Create collection
                                                                                       revision

  POST                    `/collection-revisions/:revisionId/items`                    Pin asset version

  POST                    `/collection-revisions/:revisionId/submit-review`            Submit for review

  POST                    `/collection-revisions/:revisionId/approve`                  Approve exact revision

  GET                     `/projects/:projectId/activity`                              Read activity log

  POST                    `/projects/:projectId/exports`                               Generate export

  GET                     `/settings/ai`                                               Read non-secret AI
                                                                                       configuration status

  POST                    `/settings/ai/test`                                          Test configured
                                                                                       provider without
                                                                                       exposing key
  ------------------------------------------------------------------------------------------------------------

API rules: - Validate path params, query params, and bodies. - Return
consistent error envelopes. - Use pagination for list endpoints. -
Enforce project membership and role permissions. - Use idempotency keys
for assessment/version creation. - Never return secret keys. - Use
signed upload/download URLs or backend streaming for private assets. -
Do not accept arbitrary remote URLs for server-side fetching without
SSRF protections.

Suggested error shape:

``` json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "requestId": "uuid",
    "details": []
  }
}
```

## 2.9 Authentication and authorization

For a single-user hackathon prototype, authentication can be omitted
only if the demo contains no private user data and is not publicly
exposed as a multi-user service. For a deployed product: - Use a vetted
authentication provider or secure server-side session implementation. -
Store password hashes only if managing passwords is necessary; never
store plaintext passwords. - Use secure, HttpOnly, SameSite cookies for
browser sessions. - Apply CSRF protections when cookie-based auth
requires them. - Enforce project-level roles: `OWNER`, `EDITOR`,
`REVIEWER`, `VIEWER`. - Reviewers can approve if granted permission;
viewers cannot mutate. - Recheck authorization on every backend
operation, not just in the UI.

## 2.10 File storage and upload security

-   Allowlist supported file types (initially PNG, JPEG, WebP; SVG only
    if sanitized and genuinely needed).
-   Validate actual file signatures/MIME, not only extensions.
-   Set maximum file size and image dimension limits.
-   Generate server-side storage names; do not trust user filenames as
    paths.
-   Keep private files private; use short-lived signed URLs.
-   Avoid executable file types and untrusted HTML.
-   Consider malware scanning for a production service.
-   Store checksum, MIME type, dimensions, byte size, storage key, and
    upload actor.
-   Do not commit uploaded user files to source control.
-   For local-only MVP, explain that local file paths are
    device-specific and not portable.

## 2.11 Security and privacy requirements

-   Provider API key exists only in server environment/secret manager.
-   `.env` is gitignored; `.env.example` contains placeholders only.
-   Redact API keys, authorization headers, and sensitive prompt data
    from logs.
-   Apply request-size limits, rate limits, and timeouts.
-   Use HTTPS in deployment.
-   Apply output encoding and avoid unsafe HTML rendering.
-   Sanitize Markdown if rendered as HTML.
-   Use parameterized queries/ORM protections.
-   Prevent SSRF if remote URL retrieval is implemented.
-   Validate all AI output as untrusted.
-   Keep a record of which data categories are sent to a provider.
-   Provide a user-facing notice before uploading sensitive or
    client-owned material to an external provider.
-   Support deleting user-owned project data according to a defined
    retention policy.
-   Define retention for provider request logs and exported files.
-   Do not use demo assets that expose private client work.

## 2.12 Performance and reliability targets

Initial targets to validate, not guarantees: - Local project view: p95
under 1 second for a small demo dataset. - Asset-library interaction: no
full-page reload for basic filters. - Rules-only impact assessment:
under 2 seconds for up to 100 asset versions in a local/dev
environment. - AI-assisted assessment: user sees immediate pending
state; actual completion depends on provider and payload. - UI remains
responsive while AI work runs. - Failed AI request does not corrupt
assets, versions, or approvals. - API uses timeouts and limited retries;
do not retry non-idempotent writes blindly. - Database backups and
recovery tests are required before production use.

## 2.13 Observability

Log: - request ID, endpoint, status, duration; - actor/project ID where
appropriate; - assessment ID, provider/model, input/output token usage
when returned; - error category and retry count; - state transition
event IDs.

Do not log: - API keys, session cookies, authorization headers; -
complete raw image payloads; - sensitive client briefs by default; -
unnecessary full prompts if they may contain confidential content.

Monitor: - API error rate and latency; - provider timeout/failure
rate; - assessment success/failure; - cost/usage by project and model
where available; - upload failures; - database connection saturation.

## 2.14 Testing strategy

### Unit tests

-   Recommendation classification rules.
-   Direction revision diffing.
-   Version-number allocation logic.
-   Collection pinning invariants.
-   Permission policy.
-   AI output schema validation.
-   Export redaction.

### Integration tests

-   Create project → create direction → create asset/version.
-   Start assessment → persist results → resolve recommendation.
-   Create version 2 → ensure collection remains pinned to version 1.
-   Approve collection revision → verify exact version references.
-   AI provider timeout → assessment becomes retryable/failed without
    corrupting data.
-   Unauthorized user cannot access another project.

### End-to-end tests

1.  Open demo.
2.  Activate Warm Organic direction.
3.  Run impact assessment.
4.  Inspect reasons.
5.  Override one recommendation.
6.  Create a new asset version.
7.  Confirm approved collection still points to prior version.
8.  Explicitly revise collection and pin new version.
9.  Confirm activity log.

### AI evaluation

Build a small curated test set of direction changes and asset metadata.
Evaluate: - recommendation class agreement with expert review; -
evidence relevance; - unsupported-claim rate; - `REVIEW_REQUIRED`
behavior on missing evidence; - consistency across repeated runs; -
human override reasons.

Do not optimize solely for agreement with one reviewer; document
disagreement and ambiguity.

## 2.15 Deployment and environment

Example variables (names are illustrative):

``` dotenv
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/branchframe
SESSION_SECRET=replace-with-long-random-secret
OPENAI_API_KEY=
OPENAI_MODEL=
AI_MODE=mock
AI_MAX_ASSETS_PER_ASSESSMENT=20
AI_MONTHLY_BUDGET_LIMIT_USD=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
```

Rules: - Never commit real values. - Validate required variables at
startup. - If `AI_MODE=mock`, the app must not require a provider key. -
Production secrets should come from the hosting provider's secret
manager. - Do not expose server-only variables with frontend prefixes
such as `VITE_`.

## 2.16 Technical decision log

  -----------------------------------------------------------------------
  Decision                Recommendation          Reason
  ----------------------- ----------------------- -----------------------
  Video generation        Exclude from MVP        High cost and not
                                                  required for the core
                                                  value

  Image generation        Exclude from MVP        The product is change
                                                  management, not
                                                  generation

  AI analysis             Optional,               Cost control and clear
                          user-triggered          consent

  Data model              Asset + immutable       Preserves history and
                          AssetVersion            lineage

  Approval                Pin to exact version ID Prevents silent changes
                                                  to approved work

  Impact assessment       Hybrid rules + optional Stable fallback and
                          model                   richer language
                                                  interpretation

  API key                 Backend only            Prevents exposure in
                                                  browser/source

  AI output               Structured schema +     Makes the response
                          server validation       safer to consume

  Demo                    Deterministic mock mode Reliable demonstration
                                                  without API cost

  Storage                 Object storage in       Portable and scalable
                          production              media management
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 3. ERD --- Entity Relationship Diagram and Data Dictionary

## 3.1 ERD assumptions

This ERD describes the backend-ready target model. A frontend-only
prototype may use equivalent TypeScript objects and local persistence,
but should preserve the same entity boundaries.

Core modeling choices: - `Asset` represents the logical work item. -
`AssetVersion` represents a specific immutable iteration. - `Direction`
is a logical branch; `DirectionRevision` stores its history. -
`BriefRevision` stores historical brief states. - `ImpactAssessment`
records one comparison of an old and new direction context. -
`ImpactAssessmentItem` stores the recommendation for one exact asset
version. - `Decision` records the human resolution. - `Collection` is a
logical deliverable/review collection; `CollectionRevision` is a
versioned snapshot. - `CollectionItem` pins a collection revision to an
exact asset version. - References are linked through join tables so one
reference can inform multiple directions/assets. - Audit/activity
records provide traceability.

## 3.2 Mermaid ERD

``` mermaid
erDiagram
  USER ||--o{ PROJECT_MEMBER : joins
  PROJECT ||--o{ PROJECT_MEMBER : has
  USER ||--o{ PROJECT : owns

  PROJECT ||--o{ BRIEF_REVISION : has
  USER ||--o{ BRIEF_REVISION : authors

  PROJECT ||--o{ DIRECTION : contains
  DIRECTION ||--o{ DIRECTION_REVISION : versions
  USER ||--o{ DIRECTION_REVISION : authors
  PROJECT ||--o| PROJECT_ACTIVE_DIRECTION : selects
  DIRECTION_REVISION ||--o{ PROJECT_ACTIVE_DIRECTION : selected_as

  PROJECT ||--o{ REFERENCE : contains
  USER ||--o{ REFERENCE : adds
  REFERENCE ||--o{ REFERENCE_ATTRIBUTE : describes
  REFERENCE ||--o{ DIRECTION_REFERENCE : informs
  DIRECTION_REVISION ||--o{ DIRECTION_REFERENCE : uses
  REFERENCE ||--o{ ASSET_REFERENCE : informs
  ASSET ||--o{ ASSET_REFERENCE : uses

  PROJECT ||--o{ ASSET : contains
  USER ||--o{ ASSET : creates
  ASSET ||--o{ ASSET_VERSION : versions
  ASSET_VERSION o|--o{ ASSET_VERSION : derives_from
  DIRECTION_REVISION o|--o{ ASSET_VERSION : created_under
  BRIEF_REVISION o|--o{ ASSET_VERSION : informed_by
  USER ||--o{ ASSET_VERSION : authors
  ASSET_VERSION ||--o{ ASSET_VERSION_REFERENCE : uses
  REFERENCE ||--o{ ASSET_VERSION_REFERENCE : attached_to

  PROJECT ||--o{ IMPACT_ASSESSMENT : assesses
  DIRECTION_REVISION ||--o{ IMPACT_ASSESSMENT : old_direction
  DIRECTION_REVISION ||--o{ IMPACT_ASSESSMENT : new_direction
  BRIEF_REVISION o|--o{ IMPACT_ASSESSMENT : context
  USER ||--o{ IMPACT_ASSESSMENT : starts
  IMPACT_ASSESSMENT ||--o{ IMPACT_ASSESSMENT_ITEM : contains
  ASSET_VERSION ||--o{ IMPACT_ASSESSMENT_ITEM : evaluated
  IMPACT_ASSESSMENT_ITEM ||--o{ DECISION : resolved_by
  USER ||--o{ DECISION : makes

  PROJECT ||--o{ COLLECTION : contains
  COLLECTION ||--o{ COLLECTION_REVISION : versions
  USER ||--o{ COLLECTION_REVISION : authors
  COLLECTION_REVISION ||--o{ COLLECTION_ITEM : contains
  ASSET_VERSION ||--o{ COLLECTION_ITEM : pins
  USER ||--o{ APPROVAL : records
  COLLECTION_REVISION ||--o{ APPROVAL : receives

  PROJECT ||--o{ ACTIVITY_EVENT : logs
  USER o|--o{ ACTIVITY_EVENT : performs
  PROJECT ||--o{ AI_USAGE_RECORD : tracks
  USER o|--o{ AI_USAGE_RECORD : initiates
  IMPACT_ASSESSMENT o|--o{ AI_USAGE_RECORD : uses
```

`PROJECT_ACTIVE_DIRECTION` may instead be represented by
`projects.active_direction_revision_id` with a foreign key. Use one
approach consistently; do not maintain two competing sources of truth.

## 3.3 Entity data dictionary

The field types below are logical PostgreSQL types. Add `created_at` and
`updated_at` where appropriate; immutable historical records may only
need `created_at`.

### USER

Represents a user identity. If using an external identity provider,
store its stable subject ID rather than credentials.

-   `id UUID PK`
-   `external_subject VARCHAR(255) UNIQUE NOT NULL`
-   `display_name VARCHAR(160) NOT NULL`
-   `email VARCHAR(320) NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   `deleted_at TIMESTAMPTZ NULL`

Do not store a plaintext password. If password auth is implemented, use
a proven auth library and secure password hashing.

### PROJECT

-   `id UUID PK`
-   `owner_user_id UUID FK -> USER.id NOT NULL`
-   `name VARCHAR(160) NOT NULL`
-   `slug VARCHAR(180) NOT NULL`
-   `description TEXT NULL`
-   `status PROJECT_STATUS NOT NULL DEFAULT 'ACTIVE'`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   `archived_at TIMESTAMPTZ NULL`

Constraints: - `UNIQUE(owner_user_id, slug)` for a simple single-owner
implementation. - If projects are shared, uniqueness policy should be
decided separately. - Index `(owner_user_id, status)`.

### PROJECT_MEMBER

-   `project_id UUID FK -> PROJECT.id`
-   `user_id UUID FK -> USER.id`
-   `role PROJECT_ROLE NOT NULL`
-   `joined_at TIMESTAMPTZ NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   Composite PK `(project_id, user_id)`

Roles: `OWNER`, `EDITOR`, `REVIEWER`, `VIEWER`.

### BRIEF_REVISION

Each row is a frozen version of the brief.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `revision_number INTEGER NOT NULL`
-   `title VARCHAR(200) NOT NULL`
-   `objective TEXT NOT NULL`
-   `target_audience TEXT NULL`
-   `deliverables JSONB NOT NULL DEFAULT '[]'`
-   `requirements JSONB NOT NULL DEFAULT '[]'`
-   `constraints JSONB NOT NULL DEFAULT '[]'`
-   `forbidden_attributes JSONB NOT NULL DEFAULT '[]'`
-   `acceptance_criteria JSONB NOT NULL DEFAULT '[]'`
-   `source_text TEXT NULL`
-   `change_summary TEXT NULL`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `UNIQUE(project_id, revision_number)`

Use JSONB for flexible requirement lists only when each item does not
need extensive relational querying. If requirements need assignments,
status, or cross-entity links, normalize them into a `REQUIREMENT`
table.

### DIRECTION

Logical named creative direction/branch.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `name VARCHAR(160) NOT NULL`
-   `description TEXT NULL`
-   `status DIRECTION_STATUS NOT NULL DEFAULT 'DRAFT'`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   `archived_at TIMESTAMPTZ NULL`

Possible statuses: `DRAFT`, `ACTIVE`, `SUPERSEDED`, `ARCHIVED`.

### DIRECTION_REVISION

Frozen attributes for one direction revision.

-   `id UUID PK`
-   `direction_id UUID FK -> DIRECTION.id NOT NULL`
-   `revision_number INTEGER NOT NULL`
-   `summary TEXT NOT NULL`
-   `palette JSONB NOT NULL DEFAULT '[]'`
-   `lighting JSONB NOT NULL DEFAULT '{}'`
-   `composition JSONB NOT NULL DEFAULT '{}'`
-   `materials JSONB NOT NULL DEFAULT '[]'`
-   `mood JSONB NOT NULL DEFAULT '[]'`
-   `typography JSONB NOT NULL DEFAULT '{}'`
-   `required_attributes JSONB NOT NULL DEFAULT '[]'`
-   `forbidden_attributes JSONB NOT NULL DEFAULT '[]'`
-   `style_prompt TEXT NULL`
-   `change_summary TEXT NULL`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `UNIQUE(direction_id, revision_number)`

A direction revision should be immutable after creation. Changes create
a new revision.

### PROJECT_ACTIVE_DIRECTION (optional design)

Use only if active-direction history is needed as a separate entity.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `direction_revision_id UUID FK -> DIRECTION_REVISION.id NOT NULL`
-   `activated_by UUID FK -> USER.id NOT NULL`
-   `activation_reason TEXT NULL`
-   `activated_at TIMESTAMPTZ NOT NULL`
-   `deactivated_at TIMESTAMPTZ NULL`

Ensure no more than one active row per project, e.g. a partial unique
index on `project_id WHERE deactivated_at IS NULL`. Alternatively, store
the current revision on PROJECT and write history to ACTIVITY_EVENT.

### REFERENCE

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `title VARCHAR(200) NOT NULL`
-   `description TEXT NULL`
-   `source_url TEXT NULL`
-   `storage_object_id UUID FK -> STORAGE_OBJECT.id NULL`
-   `source_type REFERENCE_SOURCE_TYPE NOT NULL`
-   `usage_rights_note TEXT NULL`
-   `added_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   `archived_at TIMESTAMPTZ NULL`

Source types might include `USER_UPLOAD`, `PUBLIC_URL`,
`INTERNAL_ASSET`, `DEMO_ASSET`. Validate URLs if accepted; do not fetch
arbitrary URLs server-side without SSRF protection.

### REFERENCE_ATTRIBUTE

-   `id UUID PK`
-   `reference_id UUID FK -> REFERENCE.id NOT NULL`
-   `attribute_type REFERENCE_ATTRIBUTE_TYPE NOT NULL`
-   `value JSONB NOT NULL`
-   `origin ATTRIBUTE_ORIGIN NOT NULL`
-   `review_status ATTRIBUTE_REVIEW_STATUS NOT NULL DEFAULT 'UNREVIEWED'`
-   `created_by UUID FK -> USER.id NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`

`origin`: `USER_PROVIDED`, `AI_INFERRED`, `SYSTEM_DERIVED`. Keep AI
observations distinct from confirmed user input.

### DIRECTION_REFERENCE

Many-to-many relation between a direction revision and reference.

-   `direction_revision_id UUID FK -> DIRECTION_REVISION.id`
-   `reference_id UUID FK -> REFERENCE.id`
-   `usage_note TEXT NULL`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   Composite PK `(direction_revision_id, reference_id)`

### ASSET

Logical visual work item, not a specific file/version.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `title VARCHAR(200) NOT NULL`
-   `description TEXT NULL`
-   `asset_type ASSET_TYPE NOT NULL`
-   `status ASSET_STATUS NOT NULL DEFAULT 'DRAFT'`
-   `owner_user_id UUID FK -> USER.id NULL`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   `archived_at TIMESTAMPTZ NULL`

Do not store the only copy of the current version as mutable columns on
this table. The latest version can be derived from
`ASSET_VERSION.version_number`, or cached with a carefully maintained
pointer.

### ASSET_VERSION

Immutable snapshot of one visual iteration.

-   `id UUID PK`
-   `asset_id UUID FK -> ASSET.id NOT NULL`
-   `version_number INTEGER NOT NULL`
-   `derived_from_version_id UUID FK -> ASSET_VERSION.id NULL`
-   `direction_revision_id UUID FK -> DIRECTION_REVISION.id NULL`
-   `brief_revision_id UUID FK -> BRIEF_REVISION.id NULL`
-   `storage_object_id UUID FK -> STORAGE_OBJECT.id NULL`
-   `external_file_url TEXT NULL`
-   `thumbnail_storage_object_id UUID FK -> STORAGE_OBJECT.id NULL`
-   `content_checksum VARCHAR(128) NULL`
-   `mime_type VARCHAR(100) NULL`
-   `width INTEGER NULL`
-   `height INTEGER NULL`
-   `prompt TEXT NULL`
-   `negative_prompt TEXT NULL`
-   `provider_name VARCHAR(100) NULL`
-   `model_name VARCHAR(160) NULL`
-   `model_version VARCHAR(160) NULL`
-   `generation_settings JSONB NOT NULL DEFAULT '{}'`
-   `recorded_attributes JSONB NOT NULL DEFAULT '{}'`
-   `revision_rationale TEXT NOT NULL`
-   `status ASSET_VERSION_STATUS NOT NULL DEFAULT 'DRAFT'`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `UNIQUE(asset_id, version_number)`

Validation: - `width` and `height`, when present, must be positive. - At
least one of `storage_object_id` or `external_file_url` should exist for
an image-backed version; metadata-only demo assets may be allowed under
an explicit mode. - `derived_from_version_id` must belong to the same
logical asset unless cross-asset derivation is intentionally
supported. - Avoid cascading deletes from asset to versions; archive
instead.

### ASSET_REFERENCE

Links references to the logical asset.

-   `asset_id UUID FK -> ASSET.id`
-   `reference_id UUID FK -> REFERENCE.id`
-   `relationship_type VARCHAR(80) NOT NULL`
-   `note TEXT NULL`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   Composite PK `(asset_id, reference_id, relationship_type)`

### ASSET_VERSION_REFERENCE

Links a reference to the exact asset version it informed.

-   `asset_version_id UUID FK -> ASSET_VERSION.id`
-   `reference_id UUID FK -> REFERENCE.id`
-   `usage_note TEXT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   Composite PK `(asset_version_id, reference_id)`

Use this table when exact lineage matters; `ASSET_REFERENCE` alone is
not sufficient to establish which version used a reference.

### IMPACT_ASSESSMENT

One analysis run comparing a specific old and new creative context.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `old_direction_revision_id UUID FK -> DIRECTION_REVISION.id NULL`
-   `new_direction_revision_id UUID FK -> DIRECTION_REVISION.id NOT NULL`
-   `brief_revision_id UUID FK -> BRIEF_REVISION.id NULL`
-   `mode ASSESSMENT_MODE NOT NULL`
-   `status ASSESSMENT_STATUS NOT NULL DEFAULT 'PENDING'`
-   `provider_name VARCHAR(100) NULL`
-   `model_name VARCHAR(160) NULL`
-   `prompt_template_version VARCHAR(80) NULL`
-   `output_schema_version VARCHAR(80) NOT NULL`
-   `input_snapshot JSONB NOT NULL`
-   `summary TEXT NULL`
-   `error_code VARCHAR(100) NULL`
-   `error_summary TEXT NULL`
-   `started_by UUID FK -> USER.id NOT NULL`
-   `started_at TIMESTAMPTZ NOT NULL`
-   `completed_at TIMESTAMPTZ NULL`
-   `idempotency_key VARCHAR(160) NULL`
-   `created_at TIMESTAMPTZ NOT NULL`

Statuses: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`.\
Modes: `RULES_ONLY`, `AI_ASSISTED`, `HYBRID`.

`input_snapshot` should preserve the minimal relevant input used for
audit/reproducibility. Avoid duplicating large image bytes or secrets.
The exact direction/brief/asset version IDs remain relational references
through assessment items and context fields.

### IMPACT_ASSESSMENT_ITEM

Recommendation for one exact asset version in one assessment.

-   `id UUID PK`
-   `assessment_id UUID FK -> IMPACT_ASSESSMENT.id NOT NULL`
-   `asset_version_id UUID FK -> ASSET_VERSION.id NOT NULL`
-   `recommendation RECOMMENDATION_TYPE NOT NULL`
-   `rationale TEXT NOT NULL`
-   `supporting_evidence JSONB NOT NULL DEFAULT '[]'`
-   `conflicting_evidence JSONB NOT NULL DEFAULT '[]'`
-   `missing_information JSONB NOT NULL DEFAULT '[]'`
-   `suggested_actions JSONB NOT NULL DEFAULT '[]'`
-   `uncertainty_level UNCERTAINTY_LEVEL NOT NULL`
-   `requires_human_review BOOLEAN NOT NULL DEFAULT TRUE`
-   `analysis_source ANALYSIS_SOURCE NOT NULL`
-   `resolution_status RESOLUTION_STATUS NOT NULL DEFAULT 'UNRESOLVED'`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   `UNIQUE(assessment_id, asset_version_id)`

A single asset version can be assessed in many assessments, but at most
once per assessment.

### DECISION

Immutable record of a human resolution or domain decision.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `assessment_item_id UUID FK -> IMPACT_ASSESSMENT_ITEM.id NULL`
-   `asset_id UUID FK -> ASSET.id NULL`
-   `asset_version_id UUID FK -> ASSET_VERSION.id NULL`
-   `direction_revision_id UUID FK -> DIRECTION_REVISION.id NULL`
-   `decision_type DECISION_TYPE NOT NULL`
-   `selected_action VARCHAR(100) NULL`
-   `rationale TEXT NOT NULL`
-   `previous_recommendation RECOMMENDATION_TYPE NULL`
-   `new_recommendation RECOMMENDATION_TYPE NULL`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `supersedes_decision_id UUID FK -> DECISION.id NULL`

Do not use a decision row as the only place to store current asset
status; decisions are history. Current state may be derived or
maintained separately with transactional rules.

### COLLECTION

Logical collection for a deliverable, review round, or presentation.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `name VARCHAR(200) NOT NULL`
-   `description TEXT NULL`
-   `collection_type COLLECTION_TYPE NOT NULL`
-   `status COLLECTION_STATUS NOT NULL DEFAULT 'DRAFT'`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `updated_at TIMESTAMPTZ NOT NULL`
-   `archived_at TIMESTAMPTZ NULL`

### COLLECTION_REVISION

Frozen snapshot of collection membership and its review state.

-   `id UUID PK`
-   `collection_id UUID FK -> COLLECTION.id NOT NULL`
-   `revision_number INTEGER NOT NULL`
-   `status COLLECTION_REVISION_STATUS NOT NULL DEFAULT 'DRAFT'`
-   `change_summary TEXT NULL`
-   `created_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `submitted_at TIMESTAMPTZ NULL`
-   `approved_at TIMESTAMPTZ NULL`
-   `UNIQUE(collection_id, revision_number)`

### COLLECTION_ITEM

Pins one exact asset version into a collection revision.

-   `id UUID PK`
-   `collection_revision_id UUID FK -> COLLECTION_REVISION.id NOT NULL`
-   `asset_version_id UUID FK -> ASSET_VERSION.id NOT NULL`
-   `position INTEGER NOT NULL`
-   `role VARCHAR(100) NULL`
-   `note TEXT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `UNIQUE(collection_revision_id, asset_version_id)`
-   `UNIQUE(collection_revision_id, position)`

This is a core integrity rule: collection items reference
`ASSET_VERSION`, not just `ASSET`.

### APPROVAL

Approval/review record for a specific collection revision or, if
desired, an asset version.

-   `id UUID PK`
-   `collection_revision_id UUID FK -> COLLECTION_REVISION.id NULL`
-   `asset_version_id UUID FK -> ASSET_VERSION.id NULL`
-   `decision APPROVAL_DECISION NOT NULL`
-   `comment TEXT NULL`
-   `reviewed_by UUID FK -> USER.id NOT NULL`
-   `reviewed_at TIMESTAMPTZ NOT NULL`

Constraint: exactly one of `collection_revision_id` or
`asset_version_id` must be non-null. If approval workflows become
complex, use separate `COLLECTION_APPROVAL` and `ASSET_VERSION_APPROVAL`
tables rather than a polymorphic reference.

### ACTIVITY_EVENT

Append-oriented activity/audit history.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `actor_user_id UUID FK -> USER.id NULL`
-   `event_type VARCHAR(120) NOT NULL`
-   `entity_type VARCHAR(80) NOT NULL`
-   `entity_id UUID NULL`
-   `summary TEXT NOT NULL`
-   `metadata JSONB NOT NULL DEFAULT '{}'`
-   `request_id VARCHAR(100) NULL`
-   `created_at TIMESTAMPTZ NOT NULL`

Do not put secrets or full sensitive payloads in `metadata`. For
critical financial/security audit requirements, use a stricter
append-only audit design.

### STORAGE_OBJECT

Metadata for a file stored locally or in object storage.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `storage_provider VARCHAR(80) NOT NULL`
-   `storage_key TEXT NOT NULL`
-   `original_filename VARCHAR(255) NULL`
-   `mime_type VARCHAR(100) NOT NULL`
-   `byte_size BIGINT NOT NULL`
-   `checksum VARCHAR(128) NULL`
-   `width INTEGER NULL`
-   `height INTEGER NULL`
-   `uploaded_by UUID FK -> USER.id NOT NULL`
-   `created_at TIMESTAMPTZ NOT NULL`
-   `deleted_at TIMESTAMPTZ NULL`

Do not expose `storage_key` if it reveals internal infrastructure.
Signed URLs should be generated by the server when required.

### AI_USAGE_RECORD

Tracks an AI provider call for cost control and troubleshooting.

-   `id UUID PK`
-   `project_id UUID FK -> PROJECT.id NOT NULL`
-   `user_id UUID FK -> USER.id NULL`
-   `impact_assessment_id UUID FK -> IMPACT_ASSESSMENT.id NULL`
-   `provider_name VARCHAR(100) NOT NULL`
-   `model_name VARCHAR(160) NOT NULL`
-   `operation VARCHAR(100) NOT NULL`
-   `status VARCHAR(40) NOT NULL`
-   `input_tokens BIGINT NULL`
-   `output_tokens BIGINT NULL`
-   `image_count INTEGER NULL`
-   `estimated_cost_usd NUMERIC(12,6) NULL`
-   `currency VARCHAR(8) NULL`
-   `duration_ms INTEGER NULL`
-   `provider_request_id VARCHAR(200) NULL`
-   `error_code VARCHAR(100) NULL`
-   `created_at TIMESTAMPTZ NOT NULL`

Cost is nullable because provider usage/cost details may not always be
available. Do not infer exact cost without actual usage and current
rates.

## 3.4 Enums

Suggested enums: - `PROJECT_STATUS`: `ACTIVE`, `ARCHIVED` -
`PROJECT_ROLE`: `OWNER`, `EDITOR`, `REVIEWER`, `VIEWER` -
`DIRECTION_STATUS`: `DRAFT`, `ACTIVE`, `SUPERSEDED`, `ARCHIVED` -
`ASSET_TYPE`: `HERO_IMAGE`, `PRODUCT_IMAGE`, `BACKGROUND`, `TEXTURE`,
`CHARACTER`, `CONCEPT_ART`, `LAYOUT`, `OTHER` - `ASSET_STATUS`: `DRAFT`,
`IN_PROGRESS`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, `ARCHIVED` -
`ASSET_VERSION_STATUS`: `DRAFT`, `CANDIDATE`, `NEEDS_REVIEW`,
`APPROVED`, `REJECTED`, `SUPERSEDED` - `RECOMMENDATION_TYPE`:
`REUSE_CANDIDATE`, `ADAPT_CANDIDATE`, `REVIEW_REQUIRED`,
`RECREATE_CANDIDATE` - `UNCERTAINTY_LEVEL`: `LOW`, `MEDIUM`, `HIGH` -
`ANALYSIS_SOURCE`: `RULES`, `AI`, `HYBRID` - `ASSESSMENT_MODE`:
`RULES_ONLY`, `AI_ASSISTED`, `HYBRID` - `ASSESSMENT_STATUS`: `PENDING`,
`RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` - `RESOLUTION_STATUS`:
`UNRESOLVED`, `ACCEPTED`, `OVERRIDDEN`, `DISMISSED`, `DEFERRED` -
`DECISION_TYPE`: `ACCEPT_RECOMMENDATION`, `OVERRIDE_RECOMMENDATION`,
`DISMISS_RECOMMENDATION`, `DEFER_RECOMMENDATION`, `APPROVE_VERSION`,
`REJECT_VERSION`, `REQUEST_REVISION`, `CHANGE_DIRECTION`,
`PIN_TO_COLLECTION`, `REPLACE_PINNED_VERSION` - `COLLECTION_TYPE`:
`DELIVERABLE`, `REVIEW_ROUND`, `PRESENTATION`, `OTHER` -
`COLLECTION_STATUS`: `DRAFT`, `IN_REVIEW`, `APPROVED`, `SUPERSEDED`,
`ARCHIVED` - `COLLECTION_REVISION_STATUS`: `DRAFT`, `IN_REVIEW`,
`APPROVED`, `REJECTED`, `SUPERSEDED` - `APPROVAL_DECISION`: `APPROVED`,
`CHANGES_REQUESTED`, `REJECTED` - `REFERENCE_SOURCE_TYPE`:
`USER_UPLOAD`, `PUBLIC_URL`, `INTERNAL_ASSET`, `DEMO_ASSET` -
`REFERENCE_ATTRIBUTE_TYPE`: `PALETTE`, `LIGHTING`, `COMPOSITION`,
`MATERIAL`, `MOOD`, `TYPOGRAPHY`, `SUBJECT`, `OTHER` -
`ATTRIBUTE_ORIGIN`: `USER_PROVIDED`, `AI_INFERRED`, `SYSTEM_DERIVED` -
`ATTRIBUTE_REVIEW_STATUS`: `UNREVIEWED`, `CONFIRMED`, `CORRECTED`,
`REJECTED`

## 3.5 Important indexes and constraints

-   Index all foreign-key columns used in joins and authorization
    filters.
-   `PROJECT(owner_user_id, status)`.
-   `ASSET(project_id, status, asset_type)`.
-   `ASSET_VERSION(asset_id, version_number DESC)`.
-   `IMPACT_ASSESSMENT(project_id, created_at DESC)`.
-   `IMPACT_ASSESSMENT_ITEM(assessment_id, recommendation)`.
-   `COLLECTION_REVISION(collection_id, revision_number DESC)`.
-   `COLLECTION_ITEM(collection_revision_id, position)`.
-   `ACTIVITY_EVENT(project_id, created_at DESC)`.
-   `AI_USAGE_RECORD(project_id, created_at DESC)`.
-   Unique `(asset_id, version_number)`.
-   Unique `(direction_id, revision_number)`.
-   Unique `(project_id, revision_number)` for brief revisions.
-   Unique `(collection_id, revision_number)`.
-   Enforce same-project relationships in application logic or with
    composite foreign keys where appropriate. A foreign key alone does
    not guarantee that an asset and a direction belong to the same
    project.
-   Use transactions for version creation and collection revision
    changes.
-   Add a partial unique index for one active direction per project if
    the active direction is modeled in a separate table.

## 3.6 Critical data integrity invariants

1.  **No silent approved-version replacement:** an approved collection
    revision pins exact asset-version IDs.
2.  **No mutable history:** direction revisions, brief revisions, asset
    versions, and decisions are historical records.
3.  **Assessment reproducibility:** every assessment records the exact
    input revision IDs and asset-version IDs it evaluated.
4.  **Human override preserved:** AI recommendations and human decisions
    are separate records/states.
5.  **No cross-project leakage:** every referenced entity must belong to
    the authorized project.
6.  **No fabricated provider metadata:** unknown model version, usage,
    or cost is stored as null/unknown.
7.  **AI output is untrusted:** model-supplied IDs must be validated
    against the assessment's input set.
8.  **Deletion does not erase accountability:** archive or soft-delete
    user-facing entities where practical; define retention/deletion
    policies for personal data separately.
9.  **Storage integrity:** every stored file record includes validated
    metadata and a project association.
10. **One source of truth:** if current direction/current version
    pointers are cached, they must be updated transactionally and
    verified against the historical records.

## 3.7 Example queries the schema must support

-   List all assets in a project and their latest version.
-   Show all versions of one asset ordered by version number.
-   Show the exact asset versions pinned in an approved collection
    revision.
-   Find assets that have a newer version than the version pinned in the
    latest approved collection.
-   Show the impact assessment for a direction change and all
    recommendations.
-   Show all decisions made to resolve recommendations in one
    assessment.
-   Trace a version to its parent version, direction revision, brief
    revision, and references.
-   Show activity events for a project over a time range.
-   Aggregate AI usage/cost by project, provider, model, and month.
-   Find assets with missing prompt, direction, or revision rationale
    metadata.

## 3.8 Recommended implementation order

1.  Define enums, IDs, and shared schemas.
2.  Implement projects and seeded demo data.
3.  Implement directions and immutable direction revisions.
4.  Implement assets and immutable asset versions.
5.  Implement collections and version pinning before AI integration.
6.  Implement rules-only impact assessments.
7.  Implement decisions and activity history.
8.  Implement mock provider with deterministic responses.
9.  Add OpenAI provider adapter and server-side secret configuration.
10. Add reference image analysis only after basic metadata flow works.
11. Add authentication, project roles, file storage, and deployment
    hardening before public production use.

------------------------------------------------------------------------

# 4. AI Coding Agent Instructions

Use these instructions when asking an AI coding agent to implement
Branchframe.

## 4.1 Required behavior

-   Read this specification before changing architecture.
-   Inspect the existing repository and report its current stack before
    modifying it.
-   Implement the MVP in small, testable slices.
-   Do not invent working API keys, backend services, or real AI
    behavior.
-   Use mock mode when no API credentials are configured.
-   Never expose provider secrets in frontend code.
-   Do not replace the whole project or install unnecessary dependencies
    without explaining why.
-   Preserve existing working features unless a requirement explicitly
    changes them.
-   Use strict TypeScript and validated domain types.
-   Add tests for business rules and approved-version pinning.
-   Run lint, typecheck, tests, and build where scripts exist.
-   Report which commands were run and their outcomes; never claim a
    command passed if it was not run.
-   Keep the README and `.env.example` aligned with actual
    implementation.
-   Mark simulated AI output as simulated in the UI.
-   Do not implement paid image generation in the MVP.

## 4.2 Required implementation milestones

**Milestone 1 --- Foundation** - Project structure, design system
primitives, domain types, seeded project. - Navigation and reset-demo
action. - No API integration.

**Milestone 2 --- Asset and version model** - Asset library, asset
detail, version history, create-version flow. - Tests proving immutable
version behavior.

**Milestone 3 --- Directions and references** - Brief/direction editor,
direction revision history, reference board. - Active direction switch
must not mutate existing versions.

**Milestone 4 --- Impact map** - Rules-only assessment service. -
Recommendation rationale, missing information, and human override. -
Assessment and decision history.

**Milestone 5 --- Approved collections** - Collections pin exact
asset-version IDs. - Warning when newer versions exist. - Test that
approval remains bound to the pinned versions.

**Milestone 6 --- AI provider abstraction** - Mock provider first. -
Optional server-side OpenAI adapter. - Structured output validation,
usage logging, timeout and error states.

**Milestone 7 --- Hardening** - Accessibility, error states, export,
security review, E2E test, build verification.

## 4.3 Final acceptance checklist

-   [ ] The product's main workflow is visible without opening a generic
    chat screen.
-   [ ] A direction change can be demonstrated end-to-end.
-   [ ] Every recommendation has a reason and uncertainty level.
-   [ ] User can override the recommendation.
-   [ ] New versions do not overwrite old versions.
-   [ ] Approved collection pins exact versions.
-   [ ] Mock mode runs without an API key.
-   [ ] AI mode uses a backend and server-side secret.
-   [ ] Invalid AI output is rejected safely.
-   [ ] Activity history shows consequential decisions.
-   [ ] README documents setup and limitations.
-   [ ] Tests cover the most important invariants.

------------------------------------------------------------------------

# 5. Product Decisions Still Requiring Validation

These are deliberate open decisions, not reasons to block the MVP.

1.  **Primary audience:** independent AI artists, small studios, or
    in-house marketing teams? Interview users before optimizing the
    product for all three.
2.  **First asset domain:** campaign/product imagery, concept art,
    character design, or general visual assets? Choose one for the demo.
3.  **Collaboration:** single-user prototype first, shared workspace
    later.
4.  **Persistence:** local-only demo first or backend immediately. The
    business model does not require a backend to validate the
    change-impact workflow.
5.  **AI value:** test whether users trust direction-diff and
    asset-impact recommendations more than a well-designed deterministic
    checklist.
6.  **Data model granularity:** normalize requirements into tables only
    if users need to assign, track, and query them individually.
7.  **Model and price:** choose only after checking current API
    capabilities, price, latency, and evaluation quality. Do not
    hard-code a model name as a permanent product decision.
8.  **Legal/rights workflow:** determine whether usage-rights metadata
    is enough for early users or if a more formal approval workflow is
    required.
9.  **Visual similarity:** defer embeddings/image similarity until the
    team can define a reliable evaluation dataset and user value.
10. **Market differentiation:** validate with competitor research and
    interviews; do not claim that no competitor has any related
    capability.

------------------------------------------------------------------------

# 6. Official Technical References

-   OpenAI API and ChatGPT billing are separate:
    https://help.openai.com/en/articles/9039756-managing-billing-settings-on-chatgpt-web-and-platform
-   OpenAI image input and generation guide:
    https://developers.openai.com/api/docs/guides/images-vision
-   OpenAI structured outputs guide:
    https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
-   OpenAI file input guide:
    https://developers.openai.com/api/docs/guides/file-inputs

Always re-check current provider documentation, model availability, rate
limits, and pricing before implementation or deployment.
