import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ApiErrorSchema, ApiListSchema, ApiResponseSchema, DirectionSchema, DirectionRevisionSchema, DirectionRevisionInputSchema, DirectionDiffSchema, ActiveDirectionChangeResultSchema, DecisionSchema, ActivityEventSchema, UUIDSchema, type Project, type Direction, type DirectionRevision, type Decision, type DirectionDiffChange } from '../../packages/contracts/src'
import { coldIndustrialFixture } from './projectSummary'

export const warmOrganicFixture = DirectionSchema.parse({
  ...coldIndustrialFixture, id: '00000000-0000-4000-8000-000000000040', name: 'Warm Organic', description: 'Approachable product visuals with soft natural light and organic materials.', status: 'DRAFT', isActive: false,
  latestRevision: { ...coldIndustrialFixture.latestRevision, id: '00000000-0000-4000-8000-000000000041', directionId: '00000000-0000-4000-8000-000000000040', summary: 'Warm organic product imagery with soft natural light and a calm crafted mood.', palette: ['amber', 'cream', 'warm brown', 'muted green'].map(name => ({ name, hex: null, role: null })), lighting: { quality: 'soft', direction: 'natural', temperature: 'warm', notes: null }, materials: ['wood', 'paper', 'stone', 'natural textures'], mood: ['approachable', 'calm', 'crafted'] },
})

export function createDirectionStore(baseUrl: string, findProject: (id: string) => Project | undefined) {
  const directions: Direction[] = structuredClone([coldIndustrialFixture, warmOrganicFixture])
  const revisions: DirectionRevision[] = directions.map(value => structuredClone(value.latestRevision))
  const decisions: Decision[] = []
  const events: z.infer<typeof ActivityEventSchema>[] = []
  const headers = (request: Request) => ({ 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() })
  function error(request: Request, status: number, code: string, message: string, details: { path: string; message: string }[] = []) { const requestId = headers(request)['X-Request-Id']; return HttpResponse.json(ApiErrorSchema.parse({ error: { code, message, requestId, details } }), { status, headers: { 'X-Request-Id': requestId } }) }
  function validate(request: Request, schema: z.ZodType, body: unknown) { const parsed = schema.safeParse(body); return parsed.success ? null : error(request, 400, 'VALIDATION_ERROR', 'Check the direction fields.', parsed.error.issues.map(issue => ({ path: `body.${issue.path.join('.')}`, message: issue.message }))) }
  async function readBody(request: Request): Promise<unknown> { try { return await request.json() } catch { return null } }
  function event(request: Request, project: Project, type: string, entityId: string, summary: string) { events.unshift(ActivityEventSchema.parse({ id: crypto.randomUUID(), projectId: project.id, actor: project.owner, eventType: type, entityType: type === 'ACTIVE_DIRECTION_CHANGED' ? 'PROJECT' : 'DIRECTION', entityId, summary, metadata: {}, requestId: headers(request)['X-Request-Id'], createdAt: new Date().toISOString() })) }
  function page<T>(request: Request, schema: z.ZodType<T>, values: (T & { id: string })[]) {
    const query = new URL(request.url).searchParams; const limit = Number(query.get('limit') ?? 25); const cursor = query.get('cursor'); const index = cursor ? values.findIndex(value => `direction:${value.id}` === cursor) : -1
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (cursor && index < 0)) return error(request, 400, 'VALIDATION_ERROR', 'Invalid pagination.')
    const data = values.slice(index + 1, index + 1 + limit)
    return HttpResponse.json(ApiListSchema(schema).parse({ data, page: { limit, nextCursor: index + 1 + limit < values.length ? `direction:${data[data.length - 1].id}` : null } }), { headers: headers(request) })
  }
  const revisionInput = DirectionRevisionInputSchema.extend({ summary: z.string().trim().min(1) })
  const handlers = [
    http.get(`${baseUrl}/projects/:projectId/directions`, ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
      if (!findProject(String(params.projectId))) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      const query = new URL(request.url).searchParams; const statuses = query.getAll('status')
      if (statuses.some(status => !['DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED'].includes(status)) || (query.has('includeArchived') && !['true', 'false'].includes(query.get('includeArchived')!))) return error(request, 400, 'VALIDATION_ERROR', 'Invalid direction filters.')
      return page(request, DirectionSchema, directions.filter(value => value.projectId === params.projectId && (query.get('includeArchived') === 'true' || value.status !== 'ARCHIVED') && (!statuses.length || statuses.includes(value.status))))
    }),
    http.get(`${baseUrl}/directions/:directionId`, ({ request, params }) => { if (!UUIDSchema.safeParse(params.directionId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid direction identifier.'); const direction = directions.find(value => value.id === params.directionId); return direction ? HttpResponse.json(ApiResponseSchema(DirectionSchema).parse({ data: direction }), { headers: headers(request) }) : error(request, 404, 'NOT_FOUND', 'Direction not found.') }),
    http.get(`${baseUrl}/directions/:directionId/revisions`, ({ request, params }) => { if (!UUIDSchema.safeParse(params.directionId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid direction identifier.'); if (!directions.some(value => value.id === params.directionId)) return error(request, 404, 'NOT_FOUND', 'Direction not found.'); return page(request, DirectionRevisionSchema, revisions.filter(value => value.directionId === params.directionId).toSorted((a, b) => b.revisionNumber - a.revisionNumber)) }),
    http.get(`${baseUrl}/direction-revisions/diff`, ({ request }) => {
      const query = new URL(request.url).searchParams; const fromId = query.get('from'); const toId = query.get('to')
      if (!UUIDSchema.safeParse(toId).success || (fromId && !UUIDSchema.safeParse(fromId).success)) return error(request, 400, 'VALIDATION_ERROR', 'Provide valid revision identifiers.')
      const from = fromId ? revisions.find(value => value.id === fromId) : undefined; const to = revisions.find(value => value.id === toId)
      if (!to || (fromId && !from)) return error(request, 404, 'NOT_FOUND', 'Direction revision not found.')
      const targetDirection = directions.find(value => value.id === to.directionId)!
      if (from && directions.find(value => value.id === from.directionId)?.projectId !== targetDirection.projectId) return error(request, 404, 'NOT_FOUND', 'Direction revision not found.')
      const changes: DirectionDiffChange[] = []
      const fields = ['summary', 'palette', 'lighting', 'composition', 'materials', 'mood', 'typography', 'stylePrompt', 'requiredAttributes', 'forbiddenAttributes'] as const
      const categories = { summary: 'SUMMARY', palette: 'PALETTE', lighting: 'LIGHTING', composition: 'COMPOSITION', materials: 'MATERIAL', mood: 'MOOD', typography: 'TYPOGRAPHY', stylePrompt: 'STYLE_PROMPT', requiredAttributes: 'OTHER', forbiddenAttributes: 'OTHER' } as const
      function readable(value: unknown): string | null { if (value === null || value === undefined) return null; if (typeof value === 'string') return value; if (Array.isArray(value)) return value.map(part => typeof part === 'string' ? part : Object.entries(part).filter(([, v]) => v !== null).map(([key, v]) => `${key}: ${v}`).join(', ')).join('; ') || null; return Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && (!Array.isArray(v) || v.length)).map(([key, v]) => `${key}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') || null }
      for (const field of fields) { const before = readable(from?.[field]); const after = readable(to[field]); if (before !== after) changes.push({ category: categories[field], field, from: before, to: after, kind: before === null ? 'ADDED' : after === null ? 'REMOVED' : 'CHANGED' }) }
      return HttpResponse.json(ApiResponseSchema(DirectionDiffSchema).parse({ data: { fromRevisionId: from?.id ?? null, toRevisionId: to.id, summary: changes.length ? `${changes.length} direction attribute groups differ.` : 'No recorded direction attributes differ.', changes } }), { headers: headers(request) })
    }),
    http.get(`${baseUrl}/direction-revisions/:revisionId`, ({ request, params }) => { if (!UUIDSchema.safeParse(params.revisionId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid revision identifier.'); const revision = revisions.find(value => value.id === params.revisionId); return revision ? HttpResponse.json(ApiResponseSchema(DirectionRevisionSchema).parse({ data: revision }), { headers: headers(request) }) : error(request, 404, 'NOT_FOUND', 'Direction revision not found.') }),
    http.post(`${baseUrl}/projects/:projectId/directions`, async ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.');
      const project = findProject(String(params.projectId)); if (!project) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      const schema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().optional(), revision: revisionInput.partial().optional(), cloneFromDirectionRevisionId: UUIDSchema.optional() })
      const body = await readBody(request); const failure = validate(request, schema, body); if (failure) return failure
      const input = schema.parse(body); const source = input.cloneFromDirectionRevisionId ? revisions.find(value => value.id === input.cloneFromDirectionRevisionId) : undefined
      if (input.cloneFromDirectionRevisionId && !source) return error(request, 404, 'NOT_FOUND', 'Source revision not found.')
      if (source && directions.find(value => value.id === source.directionId)?.projectId !== project.id) return error(request, 422, 'CROSS_PROJECT_REFERENCE', 'Source revision belongs to another project.')
      if (!input.revision && !source) return error(request, 400, 'VALIDATION_ERROR', 'Provide direction attributes or a source revision.')
      const merged = revisionInput.safeParse({ ...source, ...input.revision })
      if (!merged.success) return error(request, 400, 'VALIDATION_ERROR', 'Provide complete direction attributes.', merged.error.issues.map(issue => ({ path: `body.revision.${issue.path.join('.')}`, message: issue.message })))
      const now = new Date().toISOString(); const directionId = crypto.randomUUID()
      const revision = DirectionRevisionSchema.parse({ ...merged.data, id: crypto.randomUUID(), directionId, revisionNumber: 1, createdBy: project.owner, createdAt: now })
      const direction = DirectionSchema.parse({ id: directionId, projectId: project.id, name: input.name, description: input.description || null, status: 'DRAFT', isActive: false, latestRevision: revision, revisionCount: 1, createdBy: project.owner, createdAt: now, updatedAt: now, archivedAt: null })
      revisions.push(revision); directions.push(direction); event(request, project, 'DIRECTION_CREATED', direction.id, `Created direction ${direction.name}.`)
      return HttpResponse.json(ApiResponseSchema(DirectionSchema).parse({ data: direction }), { status: 201, headers: headers(request) })
    }),
    http.post(`${baseUrl}/directions/:directionId/revisions`, async ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.directionId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid direction identifier.');
      const direction = directions.find(value => value.id === params.directionId); if (!direction) return error(request, 404, 'NOT_FOUND', 'Direction not found.')
      const schema = revisionInput.extend({ changeSummary: z.string().trim().min(1) }); const body = await readBody(request); const failure = validate(request, schema, body); if (failure) return failure
      const revision = DirectionRevisionSchema.parse({ ...schema.parse(body), id: crypto.randomUUID(), directionId: direction.id, revisionNumber: direction.latestRevision.revisionNumber + 1, createdBy: direction.createdBy, createdAt: new Date().toISOString() })
      revisions.push(revision); direction.latestRevision = revision; direction.revisionCount += 1; direction.updatedAt = revision.createdAt
      event(request, findProject(direction.projectId)!, 'DIRECTION_REVISION_CREATED', direction.id, `Created revision ${revision.revisionNumber} of ${direction.name}.`)
      return HttpResponse.json(ApiResponseSchema(DirectionRevisionSchema).parse({ data: revision }), { status: 201, headers: headers(request) })
    }),
    http.patch(`${baseUrl}/directions/:directionId`, async ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.directionId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid direction identifier.');
      const direction = directions.find(value => value.id === params.directionId); if (!direction) return error(request, 404, 'NOT_FOUND', 'Direction not found.')
      const schema = z.object({ name: z.string().trim().min(1).optional(), description: z.string().trim().nullable().optional(), status: z.enum(['DRAFT', 'ARCHIVED']).optional(), expectedUpdatedAt: z.string() }); const body = await readBody(request); const failure = validate(request, schema, body); if (failure) return failure
      const input = schema.parse(body); if (input.expectedUpdatedAt !== direction.updatedAt) return error(request, 409, 'CONFLICT', 'This direction changed. Reload before editing.')
      if (input.status && direction.isActive) return error(request, 409, 'INVALID_STATE_TRANSITION', 'The active direction cannot be archived or made draft.')
      if (input.status === 'DRAFT' && direction.status !== 'ARCHIVED' && direction.status !== 'DRAFT') return error(request, 409, 'INVALID_STATE_TRANSITION', 'This direction cannot be made draft.')
      Object.assign(direction, input.name !== undefined ? { name: input.name } : {}, input.description !== undefined ? { description: input.description || null } : {}, input.status ? { status: input.status, archivedAt: input.status === 'ARCHIVED' ? new Date().toISOString() : null } : {}, { updatedAt: new Date().toISOString() })
      event(request, findProject(direction.projectId)!, 'DIRECTION_METADATA_UPDATED', direction.id, `Updated direction ${direction.name}.`)
      return HttpResponse.json(ApiResponseSchema(DirectionSchema).parse({ data: direction }), { headers: headers(request) })
    }),
    http.post(`${baseUrl}/projects/:projectId/active-direction`, async ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.');
      const project = findProject(String(params.projectId)); if (!project) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      const schema = z.object({ directionRevisionId: UUIDSchema, reason: z.string().trim().min(3).max(1000) }); const body = await readBody(request); const failure = validate(request, schema, body); if (failure) return failure
      const input = schema.parse(body); const revision = revisions.find(value => value.id === input.directionRevisionId); const direction = directions.find(value => value.id === revision?.directionId)
      if (!revision || !direction) return error(request, 404, 'NOT_FOUND', 'Direction revision not found.')
      if (direction.projectId !== project.id) return error(request, 422, 'CROSS_PROJECT_REFERENCE', 'The direction belongs to another project.')
      if (direction.status === 'ARCHIVED') return error(request, 409, 'INVALID_STATE_TRANSITION', 'An archived direction cannot be activated.')
      const previousDirectionRevisionId = project.activeDirectionRevisionId; const now = new Date().toISOString()
      const decision = DecisionSchema.parse({ id: crypto.randomUUID(), projectId: project.id, assessmentItemId: null, assetId: null, assetVersionId: null, collectionRevisionId: null, directionRevisionId: revision.id, decisionType: 'CHANGE_DIRECTION', selectedAction: 'ACTIVATE_DIRECTION', rationale: input.reason, previousRecommendation: null, newRecommendation: null, supersedesDecisionId: null, supersededByDecisionId: null, createdBy: project.owner, createdAt: now })
      for (const value of directions.filter(value => value.projectId === project.id)) { if (value.isActive && value.id !== direction.id) { value.status = 'SUPERSEDED'; value.updatedAt = now }; value.isActive = value.id === direction.id }
      direction.status = 'ACTIVE'; direction.updatedAt = now; project.activeDirectionRevisionId = revision.id; project.updatedAt = now; decisions.unshift(decision); event(request, project, 'ACTIVE_DIRECTION_CHANGED', project.id, `Activated ${direction.name} revision ${revision.revisionNumber}.`)
      return HttpResponse.json(ApiResponseSchema(ActiveDirectionChangeResultSchema).parse({ data: { project, previousDirectionRevisionId, decisionId: decision.id } }), { headers: headers(request) })
    }),
  ]
  return { handlers, activeContext(project: Project) { const revision = revisions.find(value => value.id === project.activeDirectionRevisionId); const direction = directions.find(value => value.id === revision?.directionId); return revision && direction ? { direction, revision } : null }, recentDecisions: (id: string) => decisions.filter(value => value.projectId === id).slice(0, 5), activity: events }
}
