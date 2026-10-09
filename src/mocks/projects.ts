import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ApiErrorSchema, ApiListSchema, ApiResponseSchema, ProjectSchema, ProjectSummarySchema, UUIDSchema, type Project } from '../../packages/contracts/src'
import { solaraProjectFixture } from './fixtures'
import { summaryForProject } from './projectSummary'
import { createBriefHandlers } from './briefs'

const inputSchema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().optional(), template: z.enum(['BLANK', 'DEMO_SOLARA']) })
export function createProjectHandlers(baseUrl: string) {
  const projects: Project[] = [structuredClone(solaraProjectFixture)]
  const intents = new Map<string, { body: string; project: Project }>()
  function error(request: Request, status: number, code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'IDEMPOTENCY_KEY_REUSED', message: string, details: { path: string; message: string }[] = []) {
    const requestId = request.headers.get('X-Request-Id') ?? crypto.randomUUID()
    return HttpResponse.json(ApiErrorSchema.parse({ error: { code, message, requestId, details } }), { status, headers: { 'X-Request-Id': requestId } })
  }
  function headers(request: Request) { return { 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() } }
  return [
    ...createBriefHandlers(baseUrl, id => projects.find(project => project.id === id)),
    http.get(`${baseUrl}/projects/:projectId/summary`, ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
      const project = projects.find(value => value.id === params.projectId)
      if (!project) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      return HttpResponse.json(ApiResponseSchema(ProjectSummarySchema).parse({ data: summaryForProject(project) }), { headers: headers(request) })
    }),
    http.get(`${baseUrl}/projects`, ({ request }) => {
      const query = new URL(request.url).searchParams
      const limit = Number(query.get('limit') ?? 25)
      const status = query.get('status')
      const sort = query.get('sort') ?? 'updatedAt:desc'
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (status !== null && !['ACTIVE', 'ARCHIVED'].includes(status)) || !['updatedAt:desc', 'name:asc'].includes(sort)) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project filters.')
      const q = (query.get('q') ?? '').toLowerCase()
      const filtered = projects.filter(project => (!status || project.status === status) && `${project.name} ${project.description ?? ''}`.toLowerCase().includes(q)).sort((a, b) => sort === 'name:asc' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      const cursor = query.get('cursor')
      const index = cursor ? filtered.findIndex(project => `project:${project.id}` === cursor) : -1
      if (cursor && index < 0) return error(request, 400, 'VALIDATION_ERROR', 'Invalid page cursor.')
      const data = filtered.slice(index + 1, index + 1 + limit)
      const nextCursor = index + 1 + limit < filtered.length ? `project:${data[data.length - 1].id}` : null
      return HttpResponse.json(ApiListSchema(ProjectSchema).parse({ data, page: { limit, nextCursor } }), { headers: headers(request) })
    }),
    http.get(`${baseUrl}/projects/:projectId`, ({ request, params }) => {
      if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
      const project = projects.find(value => value.id === params.projectId)
      if (!project) return error(request, 404, 'NOT_FOUND', 'Project not found.')
      return HttpResponse.json(ApiResponseSchema(ProjectSchema).parse({ data: project }), { headers: headers(request) })
    }),
    http.post(`${baseUrl}/projects`, async ({ request }) => {
      let body: unknown
      try { body = await request.json() } catch { return error(request, 400, 'VALIDATION_ERROR', 'Provide a valid JSON request.') }
      const parsed = inputSchema.safeParse(body)
      if (!parsed.success) return error(request, 400, 'VALIDATION_ERROR', 'Check the project fields.', parsed.error.issues.map(issue => ({ path: `body.${issue.path.join('.')}`, message: issue.message })))
      // Demo cloning includes assets/directions and belongs to their subsequent feature slices.
      if (parsed.data.template !== 'BLANK') return error(request, 400, 'VALIDATION_ERROR', 'Demo cloning is not available in this mock feature yet.', [{ path: 'body.template', message: 'Use BLANK or open the existing Solara demo.' }])
      const key = request.headers.get('Idempotency-Key')
      if (key && (key.length < 8 || key.length > 160)) return error(request, 400, 'VALIDATION_ERROR', 'Invalid idempotency key.')
      const fingerprint = JSON.stringify(parsed.data)
      const previous = key ? intents.get(key) : undefined
      if (previous) {
        if (previous.body !== fingerprint) return error(request, 422, 'IDEMPOTENCY_KEY_REUSED', 'This request key was already used for a different project.')
        return HttpResponse.json(ApiResponseSchema(ProjectSchema).parse({ data: previous.project }), { headers: { ...headers(request), 'Idempotent-Replayed': 'true' } })
      }
      const now = new Date().toISOString()
      const project = ProjectSchema.parse({ ...solaraProjectFixture, id: crypto.randomUUID(), name: parsed.data.name, slug: `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}-${crypto.randomUUID().slice(0, 8)}`, description: parsed.data.description || null, activeDirectionRevisionId: null, createdAt: now, updatedAt: now })
      projects.unshift(project)
      if (key) intents.set(key, { body: fingerprint, project })
      return HttpResponse.json(ApiResponseSchema(ProjectSchema).parse({ data: project }), { status: 201, headers: headers(request) })
    }),
  ]
}
