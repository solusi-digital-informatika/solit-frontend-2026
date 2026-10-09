import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, ProjectSchema, ProjectSummarySchema, DirectionSchema, DecisionSchema } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'

// Preserve future enum strings for a generic display; mocks use strict canonical schemas.
export const ProjectViewSchema = ProjectSchema.extend({ status: z.string(), currentUserRole: z.string() })
export type ProjectView = z.infer<typeof ProjectViewSchema>
export const ProjectSummaryViewSchema = ProjectSummarySchema.extend({
  project: ProjectViewSchema,
  activeDirection: ProjectSummarySchema.shape.activeDirection.unwrap().extend({ direction: DirectionSchema.extend({ status: z.string() }) }).nullable(),
  latestAssessment: ProjectSummarySchema.shape.latestAssessment.unwrap().extend({ status: z.string() }).nullable(),
  recentDecisions: z.array(DecisionSchema.extend({ decisionType: z.string() })),
})
export type ProjectSummaryView = z.infer<typeof ProjectSummaryViewSchema>
export function projectApi(client: ApiClient) {
  return {
    list: (query: { q?: string; status?: string; sort?: string; cursor?: string }, signal?: AbortSignal) => client.request('/projects', ApiListSchema(ProjectViewSchema), { query, signal }),
    get: (id: string, signal?: AbortSignal) => client.request(`/projects/${encodeURIComponent(id)}`, ApiResponseSchema(ProjectViewSchema), { signal }),
    summary: (id: string, signal?: AbortSignal) => client.request(`/projects/${encodeURIComponent(id)}/summary`, ApiResponseSchema(ProjectSummaryViewSchema), { signal }),
    create: (body: { name: string; description?: string; template: 'BLANK' }, key: string) => client.request('/projects', ApiResponseSchema(ProjectViewSchema), { method: 'POST', body, idempotencyKey: key }),
  }
}
