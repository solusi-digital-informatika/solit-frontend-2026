export interface ApiConfig { baseUrl: string; useMockApi: boolean }
export function readConfig(env: Record<string, unknown>): ApiConfig {
  const toggle = env.VITE_USE_MOCK_API ?? 'false'
  if (toggle !== 'true' && toggle !== 'false') throw new Error('VITE_USE_MOCK_API must be true or false.')
  const baseUrl = String(env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '')
  const url = new URL(baseUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/api/v1')) throw new Error('VITE_API_BASE_URL must be an HTTP(S) API URL ending in /api/v1.')
  return { baseUrl, useMockApi: toggle === 'true' }
}
