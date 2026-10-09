import type { ApiClient } from '../../lib/api/client'
import { directionApi } from '../directions/api'
import { briefApi } from '../briefs/api'
import { referenceApi } from '../references/api'
export type VersionOptions = Awaited<ReturnType<ReturnType<typeof versionContextApi>['options']>>
export function versionContextApi(client: ApiClient) {
  return { options: async (projectId: string, signal?: AbortSignal) => {
    const directions = directionApi(client); const briefs = briefApi(client); const refs = referenceApi(client)
    const [branches, briefValues, refValues] = await Promise.all([directions.list(projectId, signal), (async () => { const values = []; let cursor: string | undefined; do { const result = await briefs.list(projectId, cursor, signal); values.push(...result.data); cursor = result.page.nextCursor ?? undefined } while (cursor); return values })(), (async () => { const values = []; let cursor: string | undefined; do { const result = await refs.list(projectId, { includeArchived: true, cursor }, signal); values.push(...result.data); cursor = result.page.nextCursor ?? undefined } while (cursor); return values })()])
    const revisions = (await Promise.all(branches.map(async branch => (await directions.revisions(branch.id, signal)).map(revision => ({ id: revision.id, label: `${branch.name} · Revision ${revision.revisionNumber}` }))))).flat()
    return { directions: revisions, briefs: briefValues.map(brief => ({ id: brief.id, label: `${brief.title} · Revision ${brief.revisionNumber}` })), references: refValues }
  } }
}
