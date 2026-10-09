import { createApiClient } from './api/client'
import { readConfig } from './config'
export async function bootstrap() {
  const config = readConfig(import.meta.env)
  if (config.useMockApi) {
    const [{ setupWorker }, { createHandlers }] = await Promise.all([import('msw/browser'), import('../mocks/handlers')])
    const worker = setupWorker(...createHandlers(config.baseUrl))
    await worker.start({ quiet: true, serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` }, onUnhandledRequest(request, print) {
      if (request.url.startsWith(`${config.baseUrl}/`)) print.error()
    } })
  }
  return { client: createApiClient(config.baseUrl), isMockApi: config.useMockApi }
}
