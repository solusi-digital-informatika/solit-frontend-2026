import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, ActivityEventSchema, ExportResultSchema, type ExportResult } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
export interface ActivityQuery { from?: string; to?: string; actorId?: string; eventType?: string; entityType?: string; entityId?: string; cursor?: string; limit?: number }
export const ExportViewSchema = ExportResultSchema.extend({ format: z.string(), warnings: z.array(ExportResultSchema.shape.warnings.element.extend({ code: z.string() })) })
export type ExportView = z.infer<typeof ExportViewSchema>
export function activityApi(client: ApiClient) { return {
  list: (id: string, query: ActivityQuery, signal?: AbortSignal) => client.request(`/projects/${id}/activity`, ApiListSchema(ActivityEventSchema), { query: { ...query, sort: 'createdAt:desc' }, signal }),
  export: (id: string, format: ExportResult['format']) => client.request(`/projects/${id}/exports`, ApiResponseSchema(ExportViewSchema), { method: 'POST', body: { format } }),
} }
