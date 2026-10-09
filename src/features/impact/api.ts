import { z } from 'zod'
import { ApiResponseSchema, ApiListSchema, ImpactAssessmentSchema, ImpactAssessmentItemSchema, EvidenceSchema, DecisionSchema } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
const evidence = EvidenceSchema.extend({ source: z.string() })
export const ItemViewSchema = ImpactAssessmentItemSchema.extend({ recommendation: z.string(), effectiveRecommendation: z.string(), resolutionStatus: z.string(), uncertaintyLevel: z.string(), analysisSource: z.string(), latestDecision: DecisionSchema.extend({ decisionType: z.string(), previousRecommendation: z.string().nullable(), newRecommendation: z.string().nullable() }).nullable(), assetVersion: ImpactAssessmentItemSchema.shape.assetVersion.extend({ status: z.string(), assetType: z.string() }), supportingEvidence: z.array(evidence), conflictingEvidence: z.array(evidence) })
export const AssessmentViewSchema = ImpactAssessmentSchema.extend({ status: z.string(), mode: z.string(), items: z.array(ItemViewSchema).nullable(), directionDiff: ImpactAssessmentSchema.shape.directionDiff.extend({ changes: z.array(ImpactAssessmentSchema.shape.directionDiff.shape.changes.element.extend({ category: z.string(), kind: z.string() })) }) })
export type AssessmentView = z.infer<typeof AssessmentViewSchema>
export type ItemView = z.infer<typeof ItemViewSchema>
export interface StartInput { oldDirectionRevisionId?: string | null; newDirectionRevisionId: string; briefRevisionId?: string; assetVersionIds?: string[]; mode: 'RULES_ONLY' | 'AI_ASSISTED' | 'HYBRID'; includeImages?: boolean }
export function impactApi(client: ApiClient) {
  return {
    list: (projectId: string, status?: string, cursor?: string, signal?: AbortSignal) => client.request(`/projects/${projectId}/impact-assessments`, ApiListSchema(AssessmentViewSchema), { query: { status, cursor, sort: 'startedAt:desc' }, signal }),
    get: (id: string, query: { recommendation?: string; resolutionStatus?: string }, signal?: AbortSignal) => client.request(`/impact-assessments/${id}`, ApiResponseSchema(AssessmentViewSchema), { query, signal }),
    start: (projectId: string, body: StartInput, key: string) => client.request(`/projects/${projectId}/impact-assessments`, ApiResponseSchema(AssessmentViewSchema), { method: 'POST', body, idempotencyKey: key }),
    retry: (id: string) => client.request(`/impact-assessments/${id}/retry`, ApiResponseSchema(AssessmentViewSchema), { method: 'POST' }),
    cancel: (id: string) => client.request(`/impact-assessments/${id}/cancel`, ApiResponseSchema(AssessmentViewSchema), { method: 'POST' }),
  }
}
