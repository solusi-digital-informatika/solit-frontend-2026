import { z } from 'zod'
import { ApiListSchema, ApiResponseSchema, CollectionSchema, CollectionDetailSchema, CollectionRevisionSchema, CollectionItemSchema, type CollectionType } from '../../../packages/contracts/src'
import type { ApiClient } from '../../lib/api/client'
const summary = CollectionSchema.shape.latestRevision.extend({ status: z.string() })
const ref = CollectionItemSchema.shape.pinnedVersion.extend({ status: z.string(), assetType: z.string() })
export const ItemViewSchema = CollectionItemSchema.extend({ pinnedVersion: ref, latestVersion: ref })
export const CollectionViewSchema = CollectionSchema.extend({ status: z.string(), collectionType: z.string(), latestRevision: summary })
export const DetailViewSchema = CollectionDetailSchema.extend({ ...CollectionViewSchema.shape, revisions: z.array(summary) })
export const RevisionViewSchema = CollectionRevisionSchema.extend({ status: z.string(), items: z.array(ItemViewSchema), approvals: z.array(CollectionRevisionSchema.shape.approvals.element.extend({ decision: z.string() })) })
export type CollectionView = z.infer<typeof CollectionViewSchema>; export type DetailView = z.infer<typeof DetailViewSchema>; export type RevisionView = z.infer<typeof RevisionViewSchema>; export type ItemView = z.infer<typeof ItemViewSchema>
export interface PinInput { assetVersionId: string; role?: string | null; note?: string | null; position?: number }
export interface CreateInput { name: string; description?: string; collectionType: CollectionType; items?: Omit<PinInput, 'position'>[] }
export interface MetadataInput { name?: string; description?: string | null; archived?: boolean; expectedUpdatedAt: string }
export function collectionApi(client: ApiClient) { return {
  list: (id: string, query: { status?: string; collectionType?: string; includeArchived?: boolean; cursor?: string }, signal?: AbortSignal) => client.request(`/projects/${id}/collections`, ApiListSchema(CollectionViewSchema), { query, signal }),
  get: (id: string, signal?: AbortSignal) => client.request(`/collections/${id}`, ApiResponseSchema(DetailViewSchema), { signal }),
  revision: (id: string, signal?: AbortSignal) => client.request(`/collection-revisions/${id}`, ApiResponseSchema(RevisionViewSchema), { signal }),
  revisions: async (id: string, signal?: AbortSignal) => { const values: z.infer<typeof summary>[] = []; let cursor: string | undefined; do { const result = await client.request(`/collections/${id}/revisions`, ApiListSchema(summary), { query: { cursor }, signal }); values.push(...result.data); cursor = result.page.nextCursor ?? undefined } while (cursor); return values },
  create: (id: string, body: CreateInput, key: string) => client.request(`/projects/${id}/collections`, ApiResponseSchema(DetailViewSchema), { method: 'POST', body, idempotencyKey: key }),
  edit: (id: string, body: MetadataInput) => client.request(`/collections/${id}`, ApiResponseSchema(CollectionViewSchema), { method: 'PATCH', body }),
  revise: (id: string, body: { basedOnRevisionId?: string; changeSummary: string }, key: string) => client.request(`/collections/${id}/revisions`, ApiResponseSchema(RevisionViewSchema), { method: 'POST', body, idempotencyKey: key }),
  add: (id: string, body: PinInput) => client.request(`/collection-revisions/${id}/items`, ApiResponseSchema(ItemViewSchema), { method: 'POST', body }),
  item: (id: string, body: Partial<PinInput> & { rationale?: string }) => client.request(`/collection-revision-items/${id}`, ApiResponseSchema(ItemViewSchema), { method: 'PATCH', body }),
  remove: (id: string) => client.request(`/collection-revision-items/${id}`, ApiResponseSchema(RevisionViewSchema), { method: 'DELETE' }),
  review: (id: string, action: 'submit-review' | 'approve' | 'reject', body?: { comment?: string; decision?: 'CHANGES_REQUESTED' | 'REJECTED' }) => client.request(`/collection-revisions/${id}/${action}`, ApiResponseSchema(RevisionViewSchema), { method: 'POST', body }),
} }
