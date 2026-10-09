import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, ApiErrorSchema, AssetSchema, AssetDetailSchema, AssetVersionSummarySchema, AssetVersionInputSchema, AssetTypeSchema, AssetStatusSchema, UUIDSchema, ActivityEventSchema, type Project, type AssetDetail } from '../../packages/contracts/src'
import { assetTargetFixtures } from './assetFixtures'
import { createVersionStore, type VersionContext, type AssetRecord } from './versions'
export function createAssetStore(baseUrl: string, findProject: (id: string) => Project | undefined, referenceLinks: (id: string) => AssetDetail['referenceLinks'], context: VersionContext) {
  const records = structuredClone(assetTargetFixtures)
  const versionStore = createVersionStore(baseUrl, records, findProject, context)
  const events: z.infer<typeof ActivityEventSchema>[] = []
  const intents = new Map<string, { fingerprint: string; result: AssetDetail }>()
  const headers = (request: Request) => ({ 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() })
  function error(request: Request, status: number, code: string, message: string, details: { path: string; message: string }[] = []) { const requestId = headers(request)['X-Request-Id']; return HttpResponse.json(ApiErrorSchema.parse({ error: { code, message, requestId, details } }), { status, headers: { 'X-Request-Id': requestId } }) }
  function invalid(request: Request, result: z.ZodSafeParseError<unknown>) { return error(request, 400, 'VALIDATION_ERROR', 'Check the asset fields.', result.error.issues.map(issue => ({ path: `body.${issue.path.join('.')}`, message: issue.message }))) }
  async function body(request: Request) { try { return await request.json() as unknown } catch { return null } }
  function find(request: Request, id: unknown) { if (!UUIDSchema.safeParse(id).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid asset identifier.'); return records.find(value => value.asset.id === id) ?? error(request, 404, 'NOT_FOUND', 'Asset not found.') }
  function detail(record: typeof records[number]) { return AssetDetailSchema.parse({ ...record.asset, versions: record.versions, referenceLinks: referenceLinks(record.asset.id), recentDecisions: [] }) }
  function audit(request: Request, record: typeof records[number], eventType: string) { events.push(ActivityEventSchema.parse({ id: crypto.randomUUID(), projectId: record.asset.projectId, actor: findProject(record.asset.projectId)?.owner ?? null, eventType, entityType: 'ASSET', entityId: record.asset.id, summary: `${eventType === 'ASSET_CREATED' ? 'Created' : 'Updated'} ${record.asset.title}.`, metadata: {}, requestId: headers(request)['X-Request-Id'], createdAt: new Date().toISOString() })) }
  function page<T extends { id: string }>(request: Request, schema: z.ZodType<T>, values: T[]) {
    const query = new URL(request.url).searchParams; const limit = Number(query.get('limit') ?? 25); const cursor = query.get('cursor'); const index = cursor ? values.findIndex(value => `asset:${value.id}` === cursor) : -1
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (cursor && index < 0)) return error(request, 400, 'VALIDATION_ERROR', 'Invalid pagination.')
    const data = values.slice(index + 1, index + 1 + limit)
    return HttpResponse.json(ApiListSchema(schema).parse({ data, page: { limit, nextCursor: index + 1 + limit < values.length ? `asset:${data[data.length - 1].id}` : null } }), { headers: headers(request) })
  }
  const metadata = z.object({ title: z.string().trim().min(1), description: z.string().trim().nullable().optional(), assetType: AssetTypeSchema, tags: z.array(z.string().trim().min(1)).optional(), ownerUserId: UUIDSchema.optional() })
  const handlers = [
    ...versionStore.handlers,
    http.get(`${baseUrl}/projects/:projectId/assets`, ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
      if (!findProject(String(params.projectId))) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      const query = new URL(request.url).searchParams; const status = query.get('status'); const type = query.get('assetType'); const direction = query.get('directionId'); const owner = query.get('ownerUserId'); const sort = query.get('sort') ?? 'updatedAt:desc'
      if ((status && !AssetStatusSchema.safeParse(status).success) || (type && !AssetTypeSchema.safeParse(type).success) || (direction && !UUIDSchema.safeParse(direction).success) || (owner && !UUIDSchema.safeParse(owner).success) || (query.has('includeArchived') && !['true', 'false'].includes(query.get('includeArchived')!)) || !['updatedAt:desc', 'title:asc', 'status:asc', 'versionCount:desc'].includes(sort)) return error(request, 400, 'VALIDATION_ERROR', 'Invalid asset filters.')
      const q = (query.get('q') ?? '').toLowerCase()
      const values = records.filter(record => !direction || versionStore.directionOfLatest(record) === direction).map(value => value.asset).filter(asset => asset.projectId === params.projectId && (!asset.archivedAt || query.get('includeArchived') === 'true') && (!status || asset.status === status) && (!type || asset.assetType === type) && (!query.get('tag') || asset.tags.includes(query.get('tag')!)) && (!owner || asset.owner?.id === owner) && `${asset.title} ${asset.description ?? ''} ${asset.tags.join(' ')}`.toLowerCase().includes(q)).sort((a, b) => {
        const difference = sort === 'title:asc' ? a.title.localeCompare(b.title) : sort === 'status:asc' ? a.status.localeCompare(b.status) : sort === 'versionCount:desc' ? b.versionCount - a.versionCount : b.updatedAt.localeCompare(a.updatedAt)
        return difference || a.id.localeCompare(b.id)
      })
      return page(request, AssetSchema, values)
    }),
    http.get(`${baseUrl}/assets/:assetId`, ({ request, params }) => { const record = find(request, params.assetId); return record instanceof Response ? record : HttpResponse.json(ApiResponseSchema(AssetDetailSchema).parse({ data: detail(record) }), { headers: headers(request) }) }),
    http.get(`${baseUrl}/assets/:assetId/versions`, ({ request, params }) => { const record = find(request, params.assetId); return record instanceof Response ? record : page(request, AssetVersionSummarySchema, record.versions) }),
    http.post(`${baseUrl}/projects/:projectId/assets`, async ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
      const project = findProject(String(params.projectId)); if (!project) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      const parsed = metadata.extend({ initialVersion: AssetVersionInputSchema.optional() }).safeParse(await body(request)); if (!parsed.success) return invalid(request, parsed)
      if (parsed.data.ownerUserId && parsed.data.ownerUserId !== project.owner.id) return error(request, 404, 'NOT_FOUND', 'Owner is not available in this project mock.')
      const key = request.headers.get('Idempotency-Key'); if (key && (key.length < 8 || key.length > 160)) return error(request, 400, 'VALIDATION_ERROR', 'Invalid idempotency key.')
      const fingerprint = JSON.stringify(parsed.data); const scopedKey = `${project.id}:${key}`; const previous = key ? intents.get(scopedKey) : undefined
      if (previous) return previous.fingerprint !== fingerprint ? error(request, 422, 'IDEMPOTENCY_KEY_REUSED', 'This key was used with different asset fields.') : HttpResponse.json(ApiResponseSchema(AssetDetailSchema).parse({ data: previous.result }), { status: 201, headers: { ...headers(request), 'Idempotent-Replayed': 'true' } })
      const now = new Date().toISOString(); const record: AssetRecord = { asset: AssetSchema.parse({ id: crypto.randomUUID(), projectId: project.id, title: parsed.data.title, description: parsed.data.description || null, assetType: parsed.data.assetType, status: 'DRAFT', tags: parsed.data.tags ?? [], owner: parsed.data.ownerUserId ? project.owner : null, versionCount: 0, latestVersion: null, createdBy: project.owner, createdAt: now, updatedAt: now, archivedAt: null }), versions: [] }
      if (parsed.data.initialVersion) { const failure = versionStore.validate(request, record, parsed.data.initialVersion); if (failure) return failure }
      records.push(record); if (parsed.data.initialVersion) versionStore.append(request, record, parsed.data.initialVersion)
      audit(request, record, 'ASSET_CREATED'); const result = detail(record); if (key) intents.set(scopedKey, { fingerprint, result: structuredClone(result) })
      return HttpResponse.json(ApiResponseSchema(AssetDetailSchema).parse({ data: result }), { status: 201, headers: headers(request) })
    }),
    http.patch(`${baseUrl}/assets/:assetId`, async ({ request, params }) => {
      const record = find(request, params.assetId); if (record instanceof Response) return record
      const parsed = metadata.partial().extend({ status: AssetStatusSchema.optional(), expectedUpdatedAt: z.iso.datetime() }).safeParse(await body(request)); if (!parsed.success) return invalid(request, parsed)
      if (parsed.data.status === 'APPROVED') return error(request, 409, 'INVALID_STATE_TRANSITION', 'Approve a specific asset version through a review decision.')
      if (parsed.data.expectedUpdatedAt !== record.asset.updatedAt) return error(request, 409, 'CONFLICT', 'Asset metadata changed. Load the latest metadata before reapplying your draft.')
      const project = findProject(record.asset.projectId)!
      if (parsed.data.ownerUserId && parsed.data.ownerUserId !== project.owner.id) return error(request, 404, 'NOT_FOUND', 'Owner is not available in this project mock.')
      const { expectedUpdatedAt: _timestamp, ownerUserId, ...updates } = parsed.data
      Object.assign(record.asset, updates)
      if (ownerUserId) record.asset.owner = project.owner
      if (updates.description === '') record.asset.description = null
      if (updates.status) record.asset.archivedAt = updates.status === 'ARCHIVED' ? new Date().toISOString() : null
      record.asset.updatedAt = new Date(Math.max(Date.now(), Date.parse(record.asset.updatedAt) + 1)).toISOString(); audit(request, record, 'ASSET_UPDATED')
      return HttpResponse.json(ApiResponseSchema(AssetSchema).parse({ data: record.asset }), { headers: headers(request) })
    }),
  ]
  return { handlers, events,
    version: (id: string) => versionStore.all().find(value => value.id === id),
    latestVersions: (projectId: string) => versionStore.all().filter(version => version.isLatest && records.some(record => record.asset.id === version.assetId && record.asset.projectId === projectId && !record.asset.archivedAt)).map(version => ({ version, asset: records.find(record => record.asset.id === version.assetId)!.asset })),
    asset: (id: string) => records.find(record => record.asset.id === id)?.asset,
    projectFor(type: string, id: string) { return records.find(value => type === 'ASSET' ? value.asset.id === id : value.versions.some(version => version.id === id))?.asset.projectId },
    counts(projectId: string) { const values = records.map(value => value.asset).filter(asset => asset.projectId === projectId); return { total: values.length, byStatus: Object.fromEntries(AssetStatusSchema.options.map(status => [status, values.filter(asset => asset.status === status).length])) } },
  }
}
