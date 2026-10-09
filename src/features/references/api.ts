import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, ReferenceSchema, ReferenceAttributeSchema, ReferenceLinkSchema, AssetSchema, AssetVersionSummarySchema, type ReferenceLinkInput, type AttributeCategory } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
import { directionApi } from '../directions/api'
export const AttributeViewSchema = ReferenceAttributeSchema.extend({ attributeType: z.string(), origin: z.string(), reviewStatus: z.string() })
export const ReferenceViewSchema = ReferenceSchema.extend({ sourceType: z.string(), attributes: z.array(AttributeViewSchema), links: z.array(ReferenceLinkSchema.extend({ targetType: z.string() })) })
export type ReferenceView = z.infer<typeof ReferenceViewSchema>
export interface ReferenceInput { title: string; description?: string | null; usageRightsNote?: string | null; tags?: string[]; sourceType: 'PUBLIC_URL'; sourceUrl: string }
export interface MetadataInput { title: string; description: string | null; usageRightsNote: string | null; tags: string[]; expectedUpdatedAt: string }
export interface LinkTarget { type: ReferenceLinkInput['targetType']; id: string; label: string }
export function referenceApi(client: ApiClient) {
  async function all<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) { const values: T[] = []; let cursor: string | undefined; do { const result = await client.request(path, ApiListSchema(schema), { signal, query: { cursor } }); values.push(...result.data); cursor = result.page.nextCursor ?? undefined } while (cursor); return values }
  return {
    list: (projectId: string, query: Record<string, string | boolean | undefined>, signal?: AbortSignal) => client.request(`/projects/${projectId}/references`, ApiListSchema(ReferenceViewSchema), { query, signal }),
    get: (id: string) => client.request(`/references/${id}`, ApiResponseSchema(ReferenceViewSchema)),
    create: (projectId: string, body: ReferenceInput) => client.request(`/projects/${projectId}/references`, ApiResponseSchema(ReferenceViewSchema), { method: 'POST', body }),
    edit: (id: string, body: MetadataInput) => client.request(`/references/${id}`, ApiResponseSchema(ReferenceViewSchema), { method: 'PATCH', body }),
    archive: (reference: ReferenceView, archived: boolean) => client.request(`/references/${reference.id}`, ApiResponseSchema(ReferenceViewSchema), { method: 'PATCH', body: { archived, expectedUpdatedAt: reference.updatedAt } }),
    addAttribute: (id: string, attributeType: AttributeCategory, text: string, hex: string | null) => client.request(`/references/${id}/attributes`, ApiResponseSchema(AttributeViewSchema), { method: 'POST', body: { attributeType, value: { text, hex } } }),
    reviewAttribute: (id: string, value: { text: string; hex: string | null }, reviewStatus: 'CONFIRMED' | 'CORRECTED' | 'REJECTED') => client.request(`/reference-attributes/${id}`, ApiResponseSchema(AttributeViewSchema), { method: 'PATCH', body: { value, reviewStatus } }),
    link: (id: string, body: ReferenceLinkInput) => client.request(`/references/${id}/links`, ApiResponseSchema(ReferenceViewSchema), { method: 'POST', body }),
    unlink: (id: string, targetType: string, targetId: string) => client.request(`/references/${id}/links`, ApiResponseSchema(ReferenceViewSchema), { method: 'DELETE', query: { targetType, targetId } }),
    targets: async (projectId: string, signal?: AbortSignal): Promise<LinkTarget[]> => {
      const directions = directionApi(client)
      const [branches, assets] = await Promise.all([directions.list(projectId, signal), all(`/projects/${projectId}/assets`, AssetSchema, signal)])
      const [revisions, versions] = await Promise.all([
        Promise.all(branches.map(async branch => (await directions.revisions(branch.id, signal)).map(revision => ({ type: 'DIRECTION_REVISION' as const, id: revision.id, label: `${branch.name} · Revision ${revision.revisionNumber}` })))),
        Promise.all(assets.map(async asset => (await all(`/assets/${asset.id}/versions`, AssetVersionSummarySchema, signal)).map(version => ({ type: 'ASSET_VERSION' as const, id: version.id, label: `${asset.title} · Version ${version.versionNumber}` })))),
      ])
      return [...revisions.flat(), ...assets.map(asset => ({ type: 'ASSET' as const, id: asset.id, label: asset.title })), ...versions.flat()]
    },
  }
}
