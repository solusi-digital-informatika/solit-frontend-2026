import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, DirectionSchema, DirectionRevisionSchema, DirectionDiffSchema, ActiveDirectionChangeResultSchema, type DirectionRevisionInput } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
export const DirectionViewSchema = DirectionSchema.extend({ status: z.string() })
export type DirectionView = z.infer<typeof DirectionViewSchema>
export type Revision = z.infer<typeof DirectionRevisionSchema>
export const DiffViewSchema = DirectionDiffSchema.extend({ changes: z.array(DirectionDiffSchema.shape.changes.element.extend({ category: z.string(), kind: z.string() })) })
export type DiffView = z.infer<typeof DiffViewSchema>
export function directionApi(client: ApiClient) {
  async function all<T extends { id: string }>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) {
    const values: T[] = []; let cursor: string | undefined
    do { const result = await client.request(path, ApiListSchema(schema), { signal, query: { cursor } }); values.push(...result.data); cursor = result.page.nextCursor ?? undefined } while (cursor)
    return values
  }
  return {
    list: (id: string, signal?: AbortSignal) => all(`/projects/${id}/directions`, DirectionViewSchema, signal),
    revisions: (id: string, signal?: AbortSignal) => all(`/directions/${id}/revisions`, DirectionRevisionSchema, signal),
    create: (id: string, body: { name: string; description?: string; revision: DirectionRevisionInput; cloneFromDirectionRevisionId?: string }) => client.request(`/projects/${id}/directions`, ApiResponseSchema(DirectionViewSchema), { method: 'POST', body }),
    revise: (id: string, body: DirectionRevisionInput) => client.request(`/directions/${id}/revisions`, ApiResponseSchema(DirectionRevisionSchema), { method: 'POST', body }),
    diff: (from: string | undefined, to: string) => client.request('/direction-revisions/diff', ApiResponseSchema(DiffViewSchema), { query: { from, to } }),
    activate: (id: string, directionRevisionId: string, reason: string) => client.request(`/projects/${id}/active-direction`, ApiResponseSchema(ActiveDirectionChangeResultSchema), { method: 'POST', body: { directionRevisionId, reason } }),
  }
}
