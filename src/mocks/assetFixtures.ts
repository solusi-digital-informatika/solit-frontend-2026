import { http, HttpResponse } from 'msw'
import { ApiListSchema, ApiErrorSchema, AssetSchema, AssetVersionSummarySchema, UUIDSchema, type Project } from '../../packages/contracts/src'
import { solaraProjectFixture as project } from './fixtures'
const definitions = [ ['050', 'Hero Product Reveal', 'HERO_IMAGE', 'APPROVED', ['060', '061']], ['051', 'Product Close-up', 'PRODUCT_IMAGE', 'APPROVED', ['062']], ['052', 'Factory Background', 'BACKGROUND', 'APPROVED', ['063']], ['053', 'Metal Texture Detail', 'TEXTURE', 'DRAFT', ['064']] ] as const
const uuid = (suffix: string) => `00000000-0000-4000-8000-000000000${suffix}`
export const assetTargetFixtures = definitions.map(([suffix, title, assetType, status, versionIds]) => {
  const assetId = uuid(suffix)
  const versions = versionIds.map((value, index) => AssetVersionSummarySchema.parse({ id: uuid(value), assetId, versionNumber: index + 1, status: value === '060' ? 'SUPERSEDED' : value === '064' ? 'CANDIDATE' : 'APPROVED', thumbnailUrl: null, createdAt: project.createdAt })).reverse()
  const asset = AssetSchema.parse({ id: assetId, projectId: project.id, title, description: null, assetType, status, tags: [], owner: project.owner, versionCount: versions.length, latestVersion: versions[0], createdBy: project.owner, createdAt: project.createdAt, updatedAt: project.updatedAt, archivedAt: null })
  return { asset, versions }
})
export function createAssetTargetHandlers(baseUrl: string, findProject: (id: string) => Project | undefined) {
  function error(request: Request, status: number, code: string, message: string) { const requestId = request.headers.get('X-Request-Id') ?? crypto.randomUUID(); return HttpResponse.json(ApiErrorSchema.parse({ error: { code, message, requestId, details: [] } }), { status, headers: { 'X-Request-Id': requestId } }) }
  return [http.get(`${baseUrl}/projects/:projectId/assets`, ({ request, params }) => {
    if (!UUIDSchema.safeParse(params.projectId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid project identifier.')
    if (!findProject(String(params.projectId))) return error(request, 404, 'NOT_FOUND', 'Project not found.')
    const query = new URL(request.url).searchParams; const limit = Number(query.get('limit') ?? 25)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return error(request, 400, 'VALIDATION_ERROR', 'Invalid page size.')
    const values = assetTargetFixtures.map(value => value.asset).filter(asset => asset.projectId === params.projectId && (!query.get('q') || asset.title.toLowerCase().includes(query.get('q')!.toLowerCase())))
    const cursor = query.get('cursor'); const index = cursor ? values.findIndex(value => `asset:${value.id}` === cursor) : -1
    if (cursor && index < 0) return error(request, 400, 'VALIDATION_ERROR', 'Invalid page cursor.')
    const data = values.slice(index + 1, index + 1 + limit)
    return HttpResponse.json(ApiListSchema(AssetSchema).parse({ data, page: { limit, nextCursor: index + 1 + limit < values.length ? `asset:${data[data.length - 1].id}` : null } }), { headers: { 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() } })
  }), http.get(`${baseUrl}/assets/:assetId/versions`, ({ request, params }) => {
    if (!UUIDSchema.safeParse(params.assetId).success) return error(request, 400, 'VALIDATION_ERROR', 'Invalid asset identifier.')
    const value = assetTargetFixtures.find(item => item.asset.id === params.assetId)
    if (!value) return error(request, 404, 'NOT_FOUND', 'Asset not found.')
    return HttpResponse.json(ApiListSchema(AssetVersionSummarySchema).parse({ data: value.versions, page: { limit: 25, nextCursor: null } }), { headers: { 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() } })
  })]
}
