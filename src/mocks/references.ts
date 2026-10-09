import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ApiErrorSchema, ApiListSchema, ApiResponseSchema, ReferenceSchema, ReferenceAttributeSchema, ReferenceLinkInputSchema, AttributeCategorySchema, AttributeReviewStatusSchema, ReferenceSourceTypeSchema, ActivityEventSchema, UUIDSchema, type Project, type Reference, type ReferenceLink } from '../../packages/contracts/src'
import { solaraProjectFixture } from './fixtures'
export const referenceFixtures = ['steel', 'timber'].map((name, index) => ReferenceSchema.parse({
  id: `00000000-0000-4000-8000-00000000008${index}`, projectId: solaraProjectFixture.id, title: index ? 'Warm timber studio' : 'Brushed steel macro', description: 'Procedural sample texture for the fictional Solara demo.', sourceType: 'DEMO_ASSET', sourceUrl: `/demo-assets/ref-${name}.jpg`, usageRightsNote: 'Procedural demo placeholder created for Branchframe; not a third-party reference.', tags: [index ? 'organic' : 'industrial'], fileUrl: `/demo-assets/ref-${name}.jpg`, thumbnailUrl: `/demo-assets/ref-${name}.jpg`, attributes: [], links: [{ targetType: 'DIRECTION_REVISION', targetId: index ? '00000000-0000-4000-8000-000000000041' : '00000000-0000-4000-8000-000000000031', relationshipType: null, usageNote: 'Sample material inspiration.' }], addedBy: solaraProjectFixture.owner, createdAt: solaraProjectFixture.createdAt, updatedAt: solaraProjectFixture.updatedAt, archivedAt: null,
}))
export function createReferenceStore(baseUrl: string, findProject: (id: string) => Project | undefined, revisionProject: (id: string) => string | undefined, assetProject: (type: string, id: string) => string | undefined) {
  const references: Reference[] = structuredClone(referenceFixtures)
  const events: z.infer<typeof ActivityEventSchema>[] = []
  const headers = (request: Request) => ({ 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() })
  function error(request: Request, status: number, code: string, message: string, details: { path: string; message: string }[] = []) { const requestId = headers(request)['X-Request-Id']; return HttpResponse.json(ApiErrorSchema.parse({ error: { code, message, requestId, details } }), { status, headers: { 'X-Request-Id': requestId } }) }
  async function body(request: Request) { try { return await request.json() as unknown } catch { return null } }
  function invalid(request: Request, result: z.ZodSafeParseError<unknown>) { return error(request, 400, 'VALIDATION_ERROR', 'Check the reference fields.', result.error.issues.map(issue => ({ path: `body.${issue.path.join('.')}`, message: issue.message }))) }
  const text = z.string().trim(); const hex = text.regex(/^#[0-9a-fA-F]{6}$/).nullable().optional()
  const attributeInput = z.object({ attributeType: AttributeCategorySchema, value: z.object({ text: text.min(1), hex }) })
  function linkProject(link: ReferenceLink) { return link.targetType === 'DIRECTION_REVISION' ? revisionProject(link.targetId) : assetProject(link.targetType, link.targetId) }
  function checkLink(request: Request, projectId: string, link: ReferenceLink) { const targetProject = linkProject(link); return !targetProject ? error(request, 404, 'NOT_FOUND', 'Link target not found.') : targetProject !== projectId ? error(request, 422, 'CROSS_PROJECT_REFERENCE', 'Link target belongs to another project.') : null }
  function normalizedLink(input: z.infer<typeof ReferenceLinkInputSchema>): ReferenceLink { return { ...input, relationshipType: input.targetType === 'ASSET' ? input.relationshipType || 'INSPIRATION' : null, usageNote: input.usageNote?.trim() || null } }
  function touch(reference: Reference) { reference.updatedAt = new Date(Math.max(Date.now(), Date.parse(reference.updatedAt) + 1)).toISOString() }
  function audit(request: Request, reference: Reference, eventType: string, summary: string) { events.push(ActivityEventSchema.parse({ id: crypto.randomUUID(), projectId: reference.projectId, actor: reference.addedBy, eventType, entityType: 'REFERENCE', entityId: reference.id, summary, metadata: {}, requestId: headers(request)['X-Request-Id'], createdAt: new Date().toISOString() })) }
  function response(request: Request, reference: Reference, status = 200) { return HttpResponse.json(ApiResponseSchema(ReferenceSchema).parse({ data: reference }), { status, headers: headers(request) }) }
  function find(request: Request, id: unknown) { if (!UUIDSchema.safeParse(id).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid reference identifier.'); return references.find(value => value.id === id) ?? error(request, 404, 'NOT_FOUND', 'Reference not found.') }
  const handlers = [
    http.get(`${baseUrl}/projects/:projectId/references`, ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
      if (!findProject(String(params.projectId))) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      const query = new URL(request.url).searchParams; const limit = Number(query.get('limit') ?? 25); const sourceType = query.get('sourceType'); const category = query.get('attributeType')
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (sourceType && !ReferenceSourceTypeSchema.safeParse(sourceType).success) || (category && !AttributeCategorySchema.safeParse(category).success) || (query.has('sort') && query.get('sort') !== 'createdAt:desc') || (query.has('includeArchived') && !['true', 'false'].includes(query.get('includeArchived')!))) return error(request, 400, 'VALIDATION_ERROR', 'Invalid reference filters.')
      const q = (query.get('q') ?? '').toLowerCase()
      const list = references.filter(value => value.projectId === params.projectId && (!value.archivedAt || query.get('includeArchived') === 'true') && (!sourceType || value.sourceType === sourceType) && (!category || value.attributes.some(attribute => attribute.attributeType === category)) && (!query.get('tag') || value.tags.includes(query.get('tag')!)) && `${value.title} ${value.description ?? ''} ${value.tags.join(' ')} ${value.usageRightsNote ?? ''} ${value.attributes.map(attribute => attribute.value.text).join(' ')}`.toLowerCase().includes(q)).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      const cursor = query.get('cursor'); const index = cursor ? list.findIndex(value => `reference:${value.id}` === cursor) : -1
      if (cursor && index < 0) return error(request, 400, 'VALIDATION_ERROR', 'Invalid page cursor.')
      const data = list.slice(index + 1, index + 1 + limit)
      return HttpResponse.json(ApiListSchema(ReferenceSchema).parse({ data, page: { limit, nextCursor: index + 1 + limit < list.length ? `reference:${data[data.length - 1].id}` : null } }), { headers: headers(request) })
    }),
    http.get(`${baseUrl}/references/:referenceId`, ({ request, params }) => { const reference = find(request, params.referenceId); return reference instanceof Response ? reference : response(request, reference) }),
    http.post(`${baseUrl}/projects/:projectId/references`, async ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
      const project = findProject(String(params.projectId)); if (!project) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      const schema = z.object({ title: text.min(1), description: text.nullable().optional(), sourceType: ReferenceSourceTypeSchema, sourceUrl: text.nullable().optional(), storageObjectId: UUIDSchema.nullable().optional(), usageRightsNote: text.nullable().optional(), tags: z.array(text).optional(), attributes: z.array(attributeInput).optional(), links: z.array(ReferenceLinkInputSchema).optional() })
      const parsed = schema.safeParse(await body(request)); if (!parsed.success) return invalid(request, parsed)
      const input = parsed.data
      if (input.storageObjectId || ['USER_UPLOAD', 'INTERNAL_ASSET'].includes(input.sourceType)) return error(request, 404, 'NOT_FOUND', 'Storage object not available in this mock feature. Register a public URL instead.')
      if (input.sourceType === 'PUBLIC_URL') { try { const url = new URL(input.sourceUrl ?? ''); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() } catch { return error(request, 400, 'VALIDATION_ERROR', 'Use an HTTP(S) source URL.', [{ path: 'body.sourceUrl', message: 'Enter a valid HTTP(S) URL.' }]) } }
      if (input.sourceType === 'DEMO_ASSET' && !input.sourceUrl?.startsWith('/demo-assets/')) return error(request, 400, 'VALIDATION_ERROR', 'Use a local demo source URL.')
      const links = (input.links ?? []).map(normalizedLink); for (const link of links) { const failure = checkLink(request, project.id, link); if (failure) return failure }
      const id = crypto.randomUUID(); const now = new Date().toISOString()
      const reference = ReferenceSchema.parse({ id, projectId: project.id, title: input.title, description: input.description || null, sourceType: input.sourceType, sourceUrl: input.sourceUrl || null, usageRightsNote: input.usageRightsNote || null, tags: input.tags ?? [], fileUrl: input.sourceType === 'DEMO_ASSET' ? input.sourceUrl : null, thumbnailUrl: input.sourceType === 'DEMO_ASSET' ? input.sourceUrl : null, attributes: (input.attributes ?? []).map(value => ({ ...value, id: crypto.randomUUID(), referenceId: id, value: { text: value.value.text, hex: value.value.hex ?? null }, origin: 'USER_PROVIDED', reviewStatus: 'CONFIRMED', createdBy: project.owner, createdAt: now, updatedAt: now })), links, addedBy: project.owner, createdAt: now, updatedAt: now, archivedAt: null })
      references.push(reference); audit(request, reference, 'REFERENCE_ADDED', `Added ${reference.title}.`); return response(request, reference, 201)
    }),
    http.patch(`${baseUrl}/references/:referenceId`, async ({ request, params }) => {
      const reference = find(request, params.referenceId); if (reference instanceof Response) return reference
      const schema = z.object({ title: text.min(1).optional(), description: text.nullable().optional(), usageRightsNote: text.nullable().optional(), tags: z.array(text).optional(), archived: z.boolean().optional(), expectedUpdatedAt: z.iso.datetime() })
      const parsed = schema.safeParse(await body(request)); if (!parsed.success) return invalid(request, parsed)
      if (parsed.data.expectedUpdatedAt !== reference.updatedAt) return error(request, 409, 'CONFLICT', 'This reference changed. Reload the latest metadata before reapplying your edits.')
      const { archived, ...updates } = parsed.data
      for (const field of ['title', 'description', 'usageRightsNote', 'tags'] as const) if (updates[field] !== undefined) Object.assign(reference, { [field]: updates[field] === '' ? null : updates[field] })
      if (archived !== undefined) reference.archivedAt = archived ? new Date().toISOString() : null
      touch(reference); audit(request, reference, 'REFERENCE_UPDATED', `Updated ${reference.title}.`); return response(request, reference)
    }),
    http.post(`${baseUrl}/references/:referenceId/attributes`, async ({ request, params }) => {
      const reference = find(request, params.referenceId); if (reference instanceof Response) return reference
      const parsed = attributeInput.safeParse(await body(request)); if (!parsed.success) return invalid(request, parsed)
      const now = new Date().toISOString(); const attribute = ReferenceAttributeSchema.parse({ ...parsed.data, id: crypto.randomUUID(), referenceId: reference.id, value: { text: parsed.data.value.text, hex: parsed.data.value.hex ?? null }, origin: 'USER_PROVIDED', reviewStatus: 'CONFIRMED', createdBy: reference.addedBy, createdAt: now, updatedAt: now })
      reference.attributes.push(attribute); touch(reference); audit(request, reference, 'REFERENCE_UPDATED', 'Added a user-provided attribute.'); return HttpResponse.json(ApiResponseSchema(ReferenceAttributeSchema).parse({ data: attribute }), { status: 201, headers: headers(request) })
    }),
    http.patch(`${baseUrl}/reference-attributes/:attributeId`, async ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.attributeId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid attribute identifier.')
      const reference = references.find(value => value.attributes.some(attribute => attribute.id === params.attributeId)); const attribute = reference?.attributes.find(value => value.id === params.attributeId)
      if (!reference || !attribute) return error(request, 404, 'NOT_FOUND', 'Attribute not found.')
      const schema = z.object({ value: z.object({ text: text.min(1), hex }).optional(), reviewStatus: AttributeReviewStatusSchema.exclude(['UNREVIEWED']).optional() }); const parsed = schema.safeParse(await body(request)); if (!parsed.success) return invalid(request, parsed)
      if (parsed.data.value) { attribute.value = { ...parsed.data.value, hex: parsed.data.value.hex ?? null }; attribute.reviewStatus = parsed.data.reviewStatus ?? 'CORRECTED' } else if (parsed.data.reviewStatus) attribute.reviewStatus = parsed.data.reviewStatus
      attribute.updatedAt = new Date().toISOString(); touch(reference); audit(request, reference, 'REFERENCE_ATTRIBUTE_REVIEWED', 'Reviewed reference attribute.')
      return HttpResponse.json(ApiResponseSchema(ReferenceAttributeSchema).parse({ data: attribute }), { headers: headers(request) })
    }),
    http.post(`${baseUrl}/references/:referenceId/links`, async ({ request, params }) => {
      const reference = find(request, params.referenceId); if (reference instanceof Response) return reference
      const parsed = ReferenceLinkInputSchema.safeParse(await body(request)); if (!parsed.success) return invalid(request, parsed)
      const link = normalizedLink(parsed.data); const failure = checkLink(request, reference.projectId, link); if (failure) return failure
      if (!reference.links.some(value => value.targetType === link.targetType && value.targetId === link.targetId && value.relationshipType === link.relationshipType)) { reference.links.push(link); touch(reference); audit(request, reference, 'REFERENCE_LINKED', 'Linked reference to a project entity.') }
      return response(request, reference, 201)
    }),
    http.delete(`${baseUrl}/references/:referenceId/links`, ({ request, params }) => {
      const reference = find(request, params.referenceId); if (reference instanceof Response) return reference
      const query = new URL(request.url).searchParams; const targetType = ReferenceLinkInputSchema.shape.targetType.safeParse(query.get('targetType')); const targetId = UUIDSchema.safeParse(query.get('targetId'))
      if (!targetType.success || !targetId.success) return error(request, 400, 'VALIDATION_ERROR', 'Provide a valid link target.')
      const failure = checkLink(request, reference.projectId, { targetType: targetType.data, targetId: targetId.data, relationshipType: null, usageNote: null }); if (failure) return failure
      reference.links = reference.links.filter(value => value.targetType !== targetType.data || value.targetId !== targetId.data); touch(reference); audit(request, reference, 'REFERENCE_UPDATED', 'Removed a reference link.'); return response(request, reference)
    }),
  ]
  return { handlers, linksToAsset(id: string) { return references.flatMap(reference => reference.links.filter(link => link.targetType === 'ASSET' && link.targetId === id).map(link => ({ referenceId: reference.id, relationshipType: link.relationshipType ?? 'INSPIRATION', note: link.usageNote }))) } }
}
