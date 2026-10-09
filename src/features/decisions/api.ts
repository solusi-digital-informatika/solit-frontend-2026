import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, DecisionSchema, type ResolveItemInput } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
import { ItemViewSchema } from '../impact/api'
export const DecisionViewSchema = DecisionSchema.extend({ decisionType: z.string(), previousRecommendation: z.string().nullable(), newRecommendation: z.string().nullable() })
export type DecisionView = z.infer<typeof DecisionViewSchema>
export interface DecisionQuery { assessmentId?: string; assetId?: string; assetVersionId?: string; collectionRevisionId?: string; decisionType?: string; currentOnly?: boolean; cursor?: string }
export function decisionApi(client: ApiClient) { return {
  list: (id: string, query: DecisionQuery, signal?: AbortSignal) => client.request(`/projects/${id}/decisions`, ApiListSchema(DecisionViewSchema), { query: { ...query, sort: 'createdAt:desc' }, signal }),
  resolve: (assessmentId: string, itemId: string, body: ResolveItemInput) => client.request(`/impact-assessments/${assessmentId}/items/${itemId}/decision`, ApiResponseSchema(z.object({ decision: DecisionViewSchema, item: ItemViewSchema })), { method: 'POST', body }),
} }
