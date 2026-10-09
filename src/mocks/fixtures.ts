import { ApiResponseSchema, HealthStatusSchema, ProjectSchema, CONTRACT_VERSION } from '../../packages/contracts/src'
export const healthFixture = ApiResponseSchema(HealthStatusSchema).parse({ data: {
  status: 'ok', apiVersion: '1.0.0', contractVersion: CONTRACT_VERSION,
  aiMode: 'mock', demoMode: true, authMode: 'demo',
} })
export const solaraProjectFixture = ProjectSchema.parse({
  id: '00000000-0000-4000-8000-000000000010', name: 'Solara — Product Visual Campaign',
  slug: 'solara-product-visual-campaign', description: 'A fictional product campaign for exploring creative direction changes.',
  status: 'ACTIVE', owner: { id: '00000000-0000-4000-8000-000000000001', displayName: 'Demo Owner' },
  currentUserRole: 'OWNER', activeDirectionRevisionId: '00000000-0000-4000-8000-000000000031',
  createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z', archivedAt: null,
})
