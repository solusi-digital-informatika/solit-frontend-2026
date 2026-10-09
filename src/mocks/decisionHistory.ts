import { http, HttpResponse } from 'msw'
import { ApiErrorSchema, ApiListSchema, DecisionSchema, DecisionTypeSchema, UUIDSchema, type Decision } from '../../packages/contracts/src'
export function decisionHistoryHandler(base: string, projectExists: (id: string) => boolean, records: () => Decision[], itemAssessment: (id: string) => string | undefined) {
  return http.get(`${base}/projects/:projectId/decisions`, ({ request, params }) => {
    const requestId = request.headers.get('X-Request-Id') ?? crypto.randomUUID(); const headers = { 'X-Request-Id': requestId }
    function error(status: number, message: string) { return HttpResponse.json(ApiErrorSchema.parse({ error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message, details: [], requestId } }), { status, headers }) }
    if (!UUIDSchema.safeParse(params.projectId).success) return error(400, 'Invalid project identifier.')
    if (!projectExists(String(params.projectId))) return error(404, 'Project not found.')
    const query = new URL(request.url).searchParams; const limit = Number(query.get('limit') ?? 25)
    for (const field of ['assessmentId', 'assetId', 'assetVersionId', 'collectionRevisionId']) if (query.has(field) && !UUIDSchema.safeParse(query.get(field)).success) return error(400, 'Invalid decision filter identifier.')
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (query.has('sort') && query.get('sort') !== 'createdAt:desc') || (query.has('currentOnly') && !['true', 'false'].includes(query.get('currentOnly')!)) || (query.has('decisionType') && !DecisionTypeSchema.safeParse(query.get('decisionType')).success)) return error(400, 'Invalid decision filters.')
    const values = records().filter(value => value.projectId === params.projectId && (!query.get('assessmentId') || (value.assessmentItemId && itemAssessment(value.assessmentItemId) === query.get('assessmentId'))) && ['assetId', 'assetVersionId', 'collectionRevisionId', 'decisionType'].every(field => !query.get(field) || value[field as 'assetId' | 'assetVersionId' | 'collectionRevisionId' | 'decisionType'] === query.get(field)) && (query.get('currentOnly') !== 'true' || !value.supersededByDecisionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const cursor = query.get('cursor'); const index = cursor ? values.findIndex(value => `decision:${value.id}` === cursor) : -1
    if (cursor && index < 0) return error(400, 'Invalid decision cursor.')
    const data = values.slice(index + 1, index + limit + 1)
    return HttpResponse.json(ApiListSchema(DecisionSchema).parse({ data, page: { limit, nextCursor: index + limit + 1 < values.length ? `decision:${data[data.length - 1].id}` : null } }), { headers })
  })
}
