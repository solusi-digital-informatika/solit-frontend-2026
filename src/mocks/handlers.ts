import { http, HttpResponse } from 'msw'
import { ApiResponseSchema, HealthStatusSchema } from '../../packages/contracts/src'
import { healthFixture } from './fixtures'
import { createProjectHandlers } from './projects'
export function createHandlers(baseUrl: string) {
  return [http.get(`${baseUrl}/health`, ({ request }) => HttpResponse.json(
    ApiResponseSchema(HealthStatusSchema).parse(healthFixture),
    { headers: { 'X-Request-Id': request.headers.get('X-Request-Id') ?? crypto.randomUUID() } },
  )), ...createProjectHandlers(baseUrl)]
}
