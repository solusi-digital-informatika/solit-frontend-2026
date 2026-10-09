import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ActivityEventSchema, ApiErrorSchema, ApiListSchema, ApiResponseSchema, ExportResultSchema, UUIDSchema, type ActivityEvent, type Project, type AssetVersion, type AssetDetail, type BriefRevision, type Direction, type DirectionRevision, type Reference, type ImpactAssessment, type Decision, type CollectionDetail, type CollectionRevision, type ExportResult } from '../../packages/contracts/src'

export interface ProjectSnapshot {
  project: Project
  briefRevisions: BriefRevision[]
  directions: (Direction & { revisions: DirectionRevision[] })[]
  references: Reference[]
  assets: (Omit<AssetDetail, 'versions'> & { versions: AssetVersion[] })[]
  assessments: ImpactAssessment[]
  decisions: Decision[]
  collections: (Omit<CollectionDetail, 'revisions'> & { revisions: CollectionRevision[] })[]
}

// Export serialization belongs to the mock server; the frontend downloads the response verbatim.
function sensitiveKey(key: string) {
  const normalized = key.replace(/[_-]/g, '')
  return /secret|password|authorization|cookie|storagekey|apikey|accesskey|credential|signature/i.test(normalized) || /^(?:token|accessToken|refreshToken|idToken|sessionToken)$/i.test(normalized)
}
function portable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(portable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKey(key)).map(([key, entry]) => [key, ['fileUrl', 'thumbnailUrl', 'url'].includes(key) ? null : portable(entry)]))
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    try { const url = new URL(value); if (url.username || url.password || [...url.searchParams.keys()].some(key => /sign|token|key|credential|auth/i.test(key))) return null } catch { return null }
  }
  return value
}
function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`
}
function md(value: string) { return value.replace(/[\\`*_{}[\]<>#|]/g, '\\$&').replace(/\r?\n/g, ' ') }
export function serializeExport(snapshot: ProjectSnapshot, format: ExportResult['format']): ExportResult {
  const clean = portable(snapshot) as ProjectSnapshot
  const versions = snapshot.assets.flatMap(asset => asset.versions)
  const warnings: ExportResult['warnings'] = []
  if (versions.some(version => [version.externalFileUrl, version.fileUrl].some(url => url && !/^https?:\/\//i.test(url)))) warnings.push({ code: 'LOCAL_ONLY_FILE_PATHS', message: 'Some media uses local demo paths that will not resolve outside this installation.' })
  if (versions.some(version => version.isMetadataOnly)) warnings.push({ code: 'METADATA_ONLY_VERSIONS', message: 'Some versions contain metadata only and have no media file.' })
  let content: string
  if (format === 'JSON') content = JSON.stringify(clean, null, 2)
  else if (format === 'CSV') content = [
    ['Asset ID', 'Title', 'Type', 'Status', 'Latest version ID', 'Version number', 'Version status', 'Direction revision ID', 'Revision rationale'],
    ...clean.assets.map(asset => { const version = asset.versions.find(value => value.id === asset.latestVersion?.id); return [asset.id, asset.title, asset.assetType, asset.status, version?.id, version?.versionNumber, version?.status, version?.directionRevisionId, version?.revisionRationale] }),
  ].map(row => row.map(csvCell).join(',')).join('\r\n')
  else content = [
    `# ${md(clean.project.name)}`, '', md(clean.project.description ?? ''), '',
    '## Brief revisions', ...clean.briefRevisions.map(value => `- Revision ${value.revisionNumber} (${value.id}): ${md(value.title)} — ${md(value.objective)}`), '',
    '## Directions', ...clean.directions.flatMap(value => [`- ${md(value.name)} (${value.status})`, ...value.revisions.map(revision => `  - Revision ${revision.revisionNumber} (${revision.id}): ${md(revision.summary)}`)]), '',
    '## References', ...clean.references.map(value => `- ${md(value.title)} (${value.id}): ${md(value.usageRightsNote ?? 'No usage rights note recorded.')}`), '',
    '## Assets and versions', ...clean.assets.flatMap(asset => [`- ${md(asset.title)} (${asset.status})`, ...asset.versions.map(version => `  - Version ${version.versionNumber} (${version.id}, ${version.status}): ${md(version.revisionRationale)}`)]), '',
    '## Assessments', ...clean.assessments.flatMap(value => [`- ${value.id}: ${value.status}${value.isSimulated ? ' · Simulated' : ''}`, ...(value.items ?? []).map(item => `  - ${md(item.assetVersion.assetTitle)}: ${item.recommendation}, ${item.uncertaintyLevel} uncertainty — ${md(item.rationale)}`)]), '',
    '## Human decisions', ...clean.decisions.map(value => `- ${value.decisionType} (${value.id}): ${md(value.rationale)}`), '',
    '## Collections and exact pins', ...clean.collections.flatMap(value => [`- ${md(value.name)}`, ...value.revisions.flatMap(revision => [`  - Revision ${revision.revisionNumber} (${revision.id}, ${revision.status})`, ...revision.items.map(item => `    - ${item.position}. ${md(item.pinnedVersion.assetTitle)}: version ${item.pinnedVersion.versionNumber} (${item.pinnedVersion.id})`), ...revision.approvals.map(approval => `    - ${approval.decision}: ${md(approval.comment ?? '')}`)])]), '',
    '## Export warnings', ...warnings.map(value => `- ${md(value.message)}`), '',
  ].join('\n')
  const extension = { JSON: 'json', MARKDOWN: 'md', CSV: 'csv' }[format]
  return ExportResultSchema.parse({ id: crypto.randomUUID(), format, filename: `branchframe-${snapshot.project.id}.${extension}`, contentType: { JSON: 'application/json', MARKDOWN: 'text/markdown', CSV: 'text/csv' }[format], content, warnings, createdAt: new Date().toISOString() })
}

export function activityExportHandlers(base: string, projectFor: (id: string) => Project | undefined, records: () => ActivityEvent[], snapshot: (id: string) => ProjectSnapshot, exportEvents: ActivityEvent[]) {
  function error(request: Request, status: number, message: string, details: { path: string; message: string }[] = []) {
    const requestId = request.headers.get('X-Request-Id') ?? crypto.randomUUID()
    return HttpResponse.json(ApiErrorSchema.parse({ error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message, details, requestId } }), { status, headers: { 'X-Request-Id': requestId } })
  }
  function project(request: Request, id: unknown) { if (!UUIDSchema.safeParse(id).success) return error(request, 400, 'Invalid project identifier.'); return projectFor(String(id)) ?? error(request, 404, 'Project not found.') }
  return [
    http.get(`${base}/projects/:projectId/activity`, ({ request, params }) => {
      const found = project(request, params.projectId); if (found instanceof Response) return found
      const query = new URL(request.url).searchParams; const limit = Number(query.get('limit') ?? 25)
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (query.has('sort') && query.get('sort') !== 'createdAt:desc')) return error(request, 400, 'Invalid activity pagination or sort.')
      for (const field of ['actorId', 'entityId']) if (query.has(field) && !UUIDSchema.safeParse(query.get(field)).success) return error(request, 400, 'Invalid activity identifier.', [{ path: `query.${field}`, message: 'Use a valid UUID.' }])
      for (const field of ['from', 'to']) if (query.has(field) && !z.iso.datetime().safeParse(query.get(field)).success) return error(request, 400, 'Invalid activity date.', [{ path: `query.${field}`, message: 'Use an ISO UTC timestamp.' }])
      if (query.get('from') && query.get('to') && Date.parse(query.get('from')!) > Date.parse(query.get('to')!)) return error(request, 400, 'The start date must precede the end date.')
      const values = records().filter(value => value.projectId === found.id && (!query.get('actorId') || value.actor?.id === query.get('actorId')) && ['eventType', 'entityType', 'entityId'].every(field => !query.get(field) || value[field as 'eventType' | 'entityType' | 'entityId'] === query.get(field)) && (!query.get('from') || Date.parse(value.createdAt) >= Date.parse(query.get('from')!)) && (!query.get('to') || Date.parse(value.createdAt) <= Date.parse(query.get('to')!))).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      const cursor = query.get('cursor'); const index = cursor ? values.findIndex(value => `activity:${value.id}` === cursor) : -1
      if (cursor && index < 0) return error(request, 400, 'Invalid activity cursor.')
      const data = values.slice(index + 1, index + 1 + limit)
      return HttpResponse.json(ApiListSchema(ActivityEventSchema).parse({ data, page: { limit, nextCursor: index + 1 + limit < values.length ? `activity:${data[data.length - 1].id}` : null } }), { headers: { 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() } })
    }),
    http.post(`${base}/projects/:projectId/exports`, async ({ request, params }) => {
      const found = project(request, params.projectId); if (found instanceof Response) return found
      let input: unknown; try { input = await request.json() } catch { return error(request, 400, 'Provide a valid JSON request.') }
      const parsed = z.object({ format: ExportResultSchema.shape.format }).safeParse(input)
      if (!parsed.success) return error(request, 400, 'Choose JSON, Markdown or CSV.', [{ path: 'body.format', message: 'Choose a supported export format.' }])
      const result = serializeExport(snapshot(found.id), parsed.data.format); const requestId = request.headers.get('X-Request-Id') ?? crypto.randomUUID()
      exportEvents.push(ActivityEventSchema.parse({ id: crypto.randomUUID(), projectId: found.id, actor: found.owner, eventType: 'EXPORT_CREATED', entityType: 'EXPORT', entityId: result.id, summary: `Created ${result.format} project export.`, metadata: { format: result.format }, requestId, createdAt: result.createdAt }))
      return HttpResponse.json(ApiResponseSchema(ExportResultSchema).parse({ data: result }), { status: 201, headers: { 'X-Request-Id': requestId } })
    }),
  ]
}
