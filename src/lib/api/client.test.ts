import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { z } from 'zod'
import { ApiResponseSchema, HealthStatusSchema } from '../../../packages/contracts/src'
import { createHandlers } from '../../mocks/handlers'
import { healthFixture } from '../../mocks/fixtures'
import { assertCompatibleContract, createApiClient, createIntentKey } from './client'
import { readConfig } from '../config'

const base = 'http://localhost:3001/api/v1'
const server = setupServer(...createHandlers(base))
const client = createApiClient(base)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { server.resetHandlers(); vi.restoreAllMocks() })
afterAll(() => server.close())

describe('API foundation', () => {
  it('validates the actual MSW health response', async () => {
    expect(await client.health()).toEqual(healthFixture)
  })
  it('sends credentials and stable intent keys with repeated query filters', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const key = createIntentKey()
    const options = { method: 'POST' as const, body: { mode: 'RULES_ONLY' }, idempotencyKey: key, query: { status: ['DRAFT', 'APPROVED'] } }
    const api = createApiClient(base, transport)
    await api.request('/projects/demo/impact-assessments', z.object({ ok: z.boolean() }), options)
    transport.mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    await api.request('/projects/demo/impact-assessments', z.object({ ok: z.boolean() }), options)
    for (const [url, init] of transport.mock.calls) {
      expect(String(url)).toContain('status=DRAFT&status=APPROVED')
      expect(init?.credentials).toBe('include')
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(key)
      expect(new Headers(init?.headers).get('X-Request-Id')).toBeTruthy()
    }
  })
  it('requires an assessment intent key before making a request', async () => {
    await expect(client.request('/projects/demo/impact-assessments', z.unknown(), { method: 'POST' })).rejects.toThrow('idempotency key')
  })
  it('preserves validation fields and request IDs', async () => {
    server.use(http.get(`${base}/health`, () => HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid title.', requestId: 'request-1', details: [{ path: 'body.title', message: 'Required.' }] } }, { status: 400 })))
    await expect(client.health()).rejects.toMatchObject({ code: 'VALIDATION_ERROR', requestId: 'request-1', details: [{ path: 'body.title', message: 'Required.' }] })
  })
  it('preserves rate-limit retry delay without automatically retrying a write', async () => {
    const handler = vi.fn(() => HttpResponse.json({ error: { code: 'RATE_LIMITED', message: 'Try later.', requestId: 'request-2', details: [] } }, { status: 429, headers: { 'Retry-After': '12' } }))
    server.use(http.post(`${base}/settings/ai/test`, handler))
    await expect(client.request('/settings/ai/test', z.unknown(), { method: 'POST' })).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expect(handler).toHaveBeenCalledTimes(1)
  })
  it('rejects malformed responses without logging raw payloads', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(http.get(`${base}/health`, () => HttpResponse.json({ secret: 'never-log-this' })))
    await expect(client.health()).rejects.toMatchObject({ code: 'CONTRACT_MISMATCH' })
    expect(JSON.stringify(logger.mock.calls)).not.toContain('never-log-this')
  })
  it('ignores extra response fields', async () => {
    server.use(http.get(`${base}/health`, () => HttpResponse.json({ ...healthFixture, data: { ...healthFixture.data, futureField: 'extra' } })))
    expect(await client.health()).toEqual(healthFixture)
  })
  it('handles non-JSON failures', async () => {
    server.use(http.get(`${base}/health`, () => new HttpResponse('gateway error', { status: 502 })))
    await expect(client.health()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 })
  })
  it('handles network failure', async () => {
    server.use(http.get(`${base}/health`, () => HttpResponse.error()))
    await expect(client.health()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
  it('bounds waiting and distinguishes cancellation', async () => {
    const transport: typeof fetch = (_url, init) => new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) reject(new DOMException('Aborted', 'AbortError'))
      else init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
    const api = createApiClient(base, transport)
    await expect(api.request('/health', ApiResponseSchema(HealthStatusSchema), { timeoutMs: 5 })).rejects.toMatchObject({ code: 'TIMEOUT' })
    const controller = new AbortController()
    controller.abort()
    await expect(api.health(controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' })
  })
  it('lets the browser set multipart boundaries', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await createApiClient(base, transport).request('/projects/demo/uploads', z.object({}), { method: 'POST', body: new FormData() })
    expect(new Headers(transport.mock.calls[0][1]?.headers).has('Content-Type')).toBe(false)
  })
  it('rejects paths escaping the API base', async () => {
    await expect(client.request('/../../external', z.unknown())).rejects.toThrow('inside')
  })
  it('checks major version compatibility', () => {
    expect(() => assertCompatibleContract('1.12.0')).not.toThrow()
    expect(() => assertCompatibleContract('2.0.0')).toThrow('incompatible')
    expect(() => assertCompatibleContract('invalid')).toThrow('incompatible')
  })
  it('requires an explicit valid mock toggle and safe API URL', () => {
    expect(readConfig({}).useMockApi).toBe(false)
    expect(readConfig({ VITE_USE_MOCK_API: 'true' }).useMockApi).toBe(true)
    expect(() => readConfig({ VITE_USE_MOCK_API: 'yes' })).toThrow()
    expect(() => readConfig({ VITE_API_BASE_URL: 'https://user:secret@example.com/api/v1' })).toThrow()
  })
})
