import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, AssetSchema, AssetDetailSchema, AssetVersionSummarySchema, AssetVersionSchema, AssetStatusSchema, DecisionSchema, type AssetType, type AssetVersionInput } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
export const VersionSummaryViewSchema = AssetVersionSummarySchema.extend({ status: z.string() })
export const AssetViewSchema = AssetSchema.extend({ assetType: z.string(), status: z.string(), latestVersion: VersionSummaryViewSchema.nullable() })
export const AssetDetailViewSchema = AssetDetailSchema.extend({ ...AssetViewSchema.shape, versions: z.array(VersionSummaryViewSchema), recentDecisions: z.array(DecisionSchema.extend({ decisionType: z.string() })) })
export type AssetView = z.infer<typeof AssetViewSchema>
export type AssetDetailView = z.infer<typeof AssetDetailViewSchema>
export const VersionViewSchema = AssetVersionSchema.extend({ status: z.string(), lineage: z.object({ derivedFrom: VersionSummaryViewSchema.nullable(), derivedVersions: z.array(VersionSummaryViewSchema) }), pinnedIn: z.array(AssetVersionSchema.shape.pinnedIn.element.extend({ revisionStatus: z.string() })) })
export type VersionView = z.infer<typeof VersionViewSchema>
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
    version: (id: string, signal?: AbortSignal) => client.request(`/asset-versions/${id}`, ApiResponseSchema(VersionViewSchema), { signal }),
    createVersion: (id: string, body: AssetVersionInput, key: string) => client.request(`/assets/${id}/versions`, ApiResponseSchema(VersionViewSchema), { method: 'POST', body, idempotencyKey: key }),
    versions: async (id: string, signal?: AbortSignal) => { const values: z.infer<typeof VersionSummaryViewSchema>[] = []; let cursor: string | undefined; do { const result = await client.request(`/assets/${id}/versions`, ApiListSchema(VersionSummaryViewSchema), { signal, query: { cursor } }); values.push(...result.data); cursor = result.page.nextCursor ?? undefined } while (cursor); return values },
  }
}
