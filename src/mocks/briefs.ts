import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ApiErrorSchema, ApiListSchema, ApiResponseSchema, AttributeRequirementSchema, BriefRevisionSchema, BriefRevisionInputSchema, UUIDSchema, type Project, type BriefRevision } from '../../packages/contracts/src'
import { solaraProjectFixture } from './fixtures'

export const solaraBriefFixture = BriefRevisionSchema.parse({
  id: '00000000-0000-4000-8000-000000000020', projectId: solaraProjectFixture.id, revisionNumber: 1,
  title: 'Solara product visual campaign', objective: 'Create a coherent set of product campaign visuals while preserving approved production history.',
  targetAudience: 'Creative campaign reviewers', deliverables: ['Hero product reveal', 'Product close-up', 'Factory background', 'Material texture detail'],
  requirements: [], constraints: [], forbiddenAttributes: [], acceptanceCriteria: ['Visuals follow the selected creative direction.'],
  sourceText: null, changeSummary: null, createdBy: solaraProjectFixture.owner, createdAt: solaraProjectFixture.createdAt,
})
const requestAttribute = AttributeRequirementSchema.extend({ id: UUIDSchema.optional() })
const requestSchema = BriefRevisionInputSchema.partial().extend({ title: z.string().trim().min(1), objective: z.string().trim().min(1), requirements: z.array(requestAttribute).optional(), forbiddenAttributes: z.array(requestAttribute).optional() })
export function createBriefHandlers(baseUrl: string, findProject: (id: string) => Project | undefined) {
  const revisions: BriefRevision[] = [structuredClone(solaraBriefFixture)]
  function headers(request: Request) { return { 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() } }
  function error(request: Request, status: number, code: 'VALIDATION_ERROR' | 'NOT_FOUND', message: string, details: { path: string; message: string }[] = []) {
    const requestId = headers(request)['X-Request-Id']
    return HttpResponse.json(ApiErrorSchema.parse({ error: { code, message, requestId, details } }), { status, headers: { 'X-Request-Id': requestId } })
  }
  function checkProject(request: Request, value: unknown) {
    const id = UUIDSchema.safeParse(value)
    if (!id.success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
    if (!findProject(id.data)) return error(request, 404, 'NOT_FOUND', 'Project not found.')
    return null
  }
  return [
    http.get(`${baseUrl}/projects/:projectId/brief-revisions/latest`, ({ request, params }) => {
      const failure = checkProject(request, params.projectId)
      if (failure) return failure
      const latest = revisions.find(value => value.projectId === params.projectId)
      return latest ? HttpResponse.json(ApiResponseSchema(BriefRevisionSchema).parse({ data: latest }), { headers: headers(request) }) : error(request, 404, 'NOT_FOUND', 'No brief revision yet.')
    }),
    http.get(`${baseUrl}/projects/:projectId/brief-revisions`, ({ request, params }) => {
      const failure = checkProject(request, params.projectId)
      if (failure) return failure
      const query = new URL(request.url).searchParams
      const limit = Number(query.get('limit') ?? 25)
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (query.has('sort') && query.get('sort') !== 'revisionNumber:desc')) return error(request, 400, 'VALIDATION_ERROR', 'Invalid brief history filters.')
      const list = revisions.filter(value => value.projectId === params.projectId)
      const cursor = query.get('cursor')
      const index = cursor ? list.findIndex(value => `brief:${value.id}` === cursor) : -1
      if (cursor && index < 0) return error(request, 400, 'VALIDATION_ERROR', 'Invalid page cursor.')
      const data = list.slice(index + 1, index + 1 + limit)
      return HttpResponse.json(ApiListSchema(BriefRevisionSchema).parse({ data, page: { limit, nextCursor: index + 1 + limit < list.length ? `brief:${data[data.length - 1].id}` : null } }), { headers: headers(request) })
    }),
    http.get(`${baseUrl}/brief-revisions/:revisionId`, ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.revisionId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid brief identifier.')
      const revision = revisions.find(value => value.id === params.revisionId && findProject(value.projectId))
      return revision ? HttpResponse.json(ApiResponseSchema(BriefRevisionSchema).parse({ data: revision }), { headers: headers(request) }) : error(request, 404, 'NOT_FOUND', 'Brief revision not found.')
    }),
    http.post(`${baseUrl}/projects/:projectId/brief-revisions`, async ({ request, params }) => {
      const failure = checkProject(request, params.projectId)
      if (failure) return failure
      let body: unknown
      try { body = await request.json() } catch { return error(request, 400, 'VALIDATION_ERROR', 'Provide a valid JSON request.') }
      const parsed = requestSchema.safeParse(body)
      if (!parsed.success) return error(request, 400, 'VALIDATION_ERROR', 'Check the brief fields.', parsed.error.issues.map(issue => ({ path: `body.${issue.path.join('.')}`, message: issue.message })))
      const previous = revisions.find(value => value.projectId === params.projectId)
      if (previous && !parsed.data.changeSummary?.trim()) return error(request, 400, 'VALIDATION_ERROR', 'A new revision needs a change summary.', [{ path: 'body.changeSummary', message: 'Explain what changed.' }])
      const project = findProject(String(params.projectId))!
      const input = parsed.data
      const revision = BriefRevisionSchema.parse({ ...input, deliverables: input.deliverables ?? [], constraints: input.constraints ?? [], acceptanceCriteria: input.acceptanceCriteria ?? [], requirements: (input.requirements ?? []).map(value => ({ ...value, id: value.id ?? crypto.randomUUID() })), forbiddenAttributes: (input.forbiddenAttributes ?? []).map(value => ({ ...value, id: value.id ?? crypto.randomUUID() })), targetAudience: input.targetAudience?.trim() || null, sourceText: input.sourceText?.trim() || null, changeSummary: input.changeSummary?.trim() || null, id: crypto.randomUUID(), projectId: project.id, revisionNumber: (previous?.revisionNumber ?? 0) + 1, createdBy: project.owner, createdAt: new Date().toISOString() })
      revisions.unshift(revision)
      return HttpResponse.json(ApiResponseSchema(BriefRevisionSchema).parse({ data: revision }), { status: 201, headers: headers(request) })
    }),
  ]
}
