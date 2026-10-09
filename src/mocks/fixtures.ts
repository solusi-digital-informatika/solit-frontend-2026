import { ApiResponseSchema, HealthStatusSchema, CONTRACT_VERSION } from '../../packages/contracts/src'
export const healthFixture = ApiResponseSchema(HealthStatusSchema).parse({ data: {
  status: 'ok', apiVersion: '1.0.0', contractVersion: CONTRACT_VERSION,
  aiMode: 'mock', demoMode: true, authMode: 'demo',
} })
