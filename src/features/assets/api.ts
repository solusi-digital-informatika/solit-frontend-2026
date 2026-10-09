import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, AssetSchema, AssetDetailSchema, AssetVersionSummarySchema, AssetStatusSchema, DecisionSchema, type AssetType } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
export const VersionSummaryViewSchema = AssetVersionSummarySchema.extend({ status: z.string() })
export const AssetViewSchema = AssetSchema.extend({ assetType: z.string(), status: z.string(), latestVersion: VersionSummaryViewSchema.nullable() })
export const AssetDetailViewSchema = AssetDetailSchema.extend({ ...AssetViewSchema.shape, versions: z.array(VersionSummaryViewSchema), recentDecisions: z.array(DecisionSchema.extend({ decisionType: z.string() })) })
export type AssetView = z.infer<typeof AssetViewSchema>
export type AssetDetailView = z.infer<typeof AssetDetailViewSchema>
export interface AssetInput { title: string; description: string | null; assetType: AssetType; tags: string[]; ownerUserId?: string }
export const EditableAssetStatusSchema = AssetStatusSchema.exclude(['APPROVED'])
export interface AssetEdit extends AssetInput { expectedUpdatedAt: string; status?: z.infer<typeof EditableAssetStatusSchema> }
export interface AssetQuery { q?: string; status?: string; assetType?: string; directionId?: string; tag?: string; ownerUserId?: string; includeArchived?: boolean; sort?: string; cursor?: string; limit?: number }
export function assetApi(client: ApiClient) {
  return {
    list: (projectId: string, query: AssetQuery, signal?: AbortSignal) => client.request(`/projects/${projectId}/assets`, ApiListSchema(AssetViewSchema), { query: { ...query }, signal }),
    get: (id: string, signal?: AbortSignal) => client.request(`/assets/${id}`, ApiResponseSchema(AssetDetailViewSchema), { signal }),
    create: (projectId: string, body: AssetInput, key: string) => client.request(`/projects/${projectId}/assets`, ApiResponseSchema(AssetDetailViewSchema), { method: 'POST', body, idempotencyKey: key }),
    edit: (id: string, body: AssetEdit) => client.request(`/assets/${id}`, ApiResponseSchema(AssetViewSchema), { method: 'PATCH', body }),
    status: (asset: AssetView, status: 'DRAFT' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'REJECTED' | 'ARCHIVED') => client.request(`/assets/${asset.id}`, ApiResponseSchema(AssetViewSchema), { method: 'PATCH', body: { status, expectedUpdatedAt: asset.updatedAt } }),
  }
}
