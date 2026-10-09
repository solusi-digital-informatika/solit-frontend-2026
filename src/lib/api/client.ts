import { z } from 'zod'
import { ApiErrorSchema, ApiResponseSchema, HealthStatusSchema, CONTRACT_VERSION, type ErrorDetail } from '../../../packages/contracts/src'

export class ApiClientError extends Error {
  readonly code: string
  readonly status: number
  readonly requestId: string | null
  readonly details: ErrorDetail[]
  readonly retryAfterSeconds: number | null
  constructor(message: string, options: { code: string; status?: number; requestId?: string | null; details?: ErrorDetail[]; retryAfterSeconds?: number | null }) {
    super(message)
    this.name = 'ApiClientError'
    this.code = options.code
    this.status = options.status ?? 0
    this.requestId = options.requestId ?? null
    this.details = options.details ?? []
    this.retryAfterSeconds = options.retryAfterSeconds ?? null
  }
}
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  idempotencyKey?: string
  timeoutMs?: number
  query?: Record<string, string | number | boolean | string[] | undefined>
}
export function createIntentKey() { return crypto.randomUUID() }
export function createApiClient(baseUrl: string, transport?: typeof fetch) {
  async function request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path)) throw new Error('Use an API path and the query option.')
    const url = new URL(baseUrl.replace(/\/+$/, '') + path)
    if (!url.pathname.startsWith(new URL(baseUrl).pathname + '/')) throw new Error('API path must stay inside the configured base URL.')
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) for (const part of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(part))
    }
    const method = options.method ?? 'GET'
    if (method === 'POST' && /^\/projects\/[^/]+\/impact-assessments$/.test(path) && !options.idempotencyKey) throw new Error('An assessment requires an idempotency key for this user intent.')
    if (options.idempotencyKey && (options.idempotencyKey.length < 8 || options.idempotencyKey.length > 160)) throw new Error('Invalid idempotency key length.')
    const requestId = crypto.randomUUID()
    const headers = new Headers({ Accept: 'application/json', 'X-Request-Id': requestId })
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)
    const multipart = options.body instanceof FormData
    if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json')
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, options.timeoutMs ?? 15_000)
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) controller.abort()
    try {
      const response = await (transport ?? fetch)(url, { method, credentials: 'include', headers, body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body), signal: controller.signal })
      const responseRequestId = response.headers.get('X-Request-Id') ?? requestId
      let payload: unknown
      try { payload = await response.json() } catch { throw new ApiClientError('The server returned an unreadable response.', { code: 'INVALID_RESPONSE', status: response.status, requestId: responseRequestId }) }
      if (!response.ok) {
        const parsed = ApiErrorSchema.safeParse(payload)
        const retryHeader = response.headers.get('Retry-After')
        const seconds = retryHeader === null ? NaN : Number(retryHeader)
        throw new ApiClientError(parsed.success ? parsed.data.error.message : 'The request failed. Please try again.', { code: parsed.success ? parsed.data.error.code : 'HTTP_ERROR', status: response.status, requestId: parsed.success ? parsed.data.error.requestId : responseRequestId, details: parsed.success ? parsed.data.error.details : [], retryAfterSeconds: Number.isFinite(seconds) && seconds >= 0 ? seconds : null })
      }
      const parsed = schema.safeParse(payload)
      if (!parsed.success) {
        if (import.meta.env.DEV) console.error('API contract mismatch', { path, requestId: responseRequestId, fields: parsed.error.issues.map(issue => issue.path.join('.')) })
        throw new ApiClientError('The server response does not match the integration contract.', { code: 'CONTRACT_MISMATCH', status: response.status, requestId: responseRequestId })
      }
      return parsed.data
    } catch (error) {
      if (error instanceof ApiClientError) throw error
      if (controller.signal.aborted) throw new ApiClientError(timedOut ? 'The request timed out. Please try again.' : 'The request was cancelled.', { code: timedOut ? 'TIMEOUT' : 'CANCELLED', requestId })
      throw new ApiClientError('Unable to reach the API. Check your connection and try again.', { code: 'NETWORK_ERROR', requestId })
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', onAbort) }
  }
  return { request, health: (signal?: AbortSignal) => request('/health', ApiResponseSchema(HealthStatusSchema), { signal }) }
}
export type ApiClient = ReturnType<typeof createApiClient>
export function assertCompatibleContract(version: string) {
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\w.-]+)?(?:\+[\w.-]+)?$/
  if (!semver.test(version) || version.split('.')[0] !== CONTRACT_VERSION.split('.')[0]) throw new ApiClientError(`API contract ${version} is incompatible with frontend contract ${CONTRACT_VERSION}.`, { code: 'INCOMPATIBLE_CONTRACT' })
}
