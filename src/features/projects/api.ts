import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, ProjectSchema } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'

// Preserve future enum strings for a generic display; mocks use strict canonical schemas.
export const ProjectViewSchema = ProjectSchema.extend({ status: z.string(), currentUserRole: z.string() })
export type ProjectView = z.infer<typeof ProjectViewSchema>
export function projectApi(client: ApiClient) {
  return {
    list: (query: { q?: string; status?: string; sort?: string; cursor?: string }, signal?: AbortSignal) => client.request('/projects', ApiListSchema(ProjectViewSchema), { query, signal }),
    get: (id: string, signal?: AbortSignal) => client.request(`/projects/${encodeURIComponent(id)}`, ApiResponseSchema(ProjectViewSchema), { signal }),
    create: (body: { name: string; description?: string; template: 'BLANK' }, key: string) => client.request('/projects', ApiResponseSchema(ProjectViewSchema), { method: 'POST', body, idempotencyKey: key }),
  }
}
