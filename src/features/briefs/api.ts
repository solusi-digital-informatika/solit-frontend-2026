import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, AttributeRequirementSchema, BriefRevisionSchema, type BriefRevisionInput } from '../../../packages/contracts/src'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
const requirementView = AttributeRequirementSchema.extend({ category: z.string() })
export const BriefViewSchema = BriefRevisionSchema.extend({ requirements: z.array(requirementView), forbiddenAttributes: z.array(requirementView) })
export type BriefView = z.infer<typeof BriefViewSchema>
export function briefApi(client: ApiClient) {
  return {
    list: (projectId: string, cursor?: string, signal?: AbortSignal) => client.request(`/projects/${encodeURIComponent(projectId)}/brief-revisions`, ApiListSchema(BriefViewSchema), { query: { sort: 'revisionNumber:desc', cursor }, signal }),
    latest: async (projectId: string, signal?: AbortSignal) => {
      try { return (await client.request(`/projects/${encodeURIComponent(projectId)}/brief-revisions/latest`, ApiResponseSchema(BriefViewSchema), { signal })).data }
      catch (error) { if (error instanceof ApiClientError && error.status === 404 && error.code === 'NOT_FOUND') return null; throw error }
    },
    get: (id: string, signal?: AbortSignal) => client.request(`/brief-revisions/${encodeURIComponent(id)}`, ApiResponseSchema(BriefViewSchema), { signal }),
    create: (projectId: string, body: BriefRevisionInput) => client.request(`/projects/${encodeURIComponent(projectId)}/brief-revisions`, ApiResponseSchema(BriefViewSchema), { method: 'POST', body }),
  }
}
