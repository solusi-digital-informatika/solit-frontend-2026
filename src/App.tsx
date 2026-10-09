import { useEffect, useState } from 'react'
import { ApiClientError, assertCompatibleContract, type ApiClient } from './lib/api/client'
import { copy } from './copy/en'
import './App.css'

type Connection = { kind: 'loading' } | { kind: 'ready'; contractVersion: string } | { kind: 'error'; error: ApiClientError }

function App({ client, isMockApi }: { client: ApiClient; isMockApi: boolean }) {
  const [connection, setConnection] = useState<Connection>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    client.health(controller.signal).then(({ data }) => {
      assertCompatibleContract(data.contractVersion)
      if (!controller.signal.aborted) setConnection({ kind: 'ready', contractVersion: data.contractVersion })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setConnection({ kind: 'error', error: error instanceof ApiClientError ? error : new ApiClientError('Workspace initialization failed.', { code: 'INITIALIZATION_ERROR' }) })
    })
    return () => controller.abort()
  }, [client, attempt])
  return (
    <main className="welcome">
      <p className="eyebrow">{copy.brand}</p>
      <h1>{copy.title}</h1>
      <p className="description">{copy.description}</p>
      <p className="mode">{isMockApi ? copy.mock : copy.live}</p>
      {offline && !isMockApi && <p role="status">{copy.offline}</p>}
      {connection.kind === 'loading' && <p role="status">{copy.loading}</p>}
      {connection.kind === 'ready' && <section aria-label="API connection" className="connection" role="status">
        <p className="setup-status">{copy.connected}</p>
        <p>Contract v{connection.contractVersion}</p>
        <p className="note">{copy.note}</p>
      </section>}
      {connection.kind === 'error' && <section role="alert" className="connection error">
        <h2>{copy.failed}</h2>
        <p>{connection.error.message}</p>
        {connection.error.requestId && <p>{copy.requestId}: <code>{connection.error.requestId}</code></p>}
        <button type="button" onClick={() => { setConnection({ kind: 'loading' }); setAttempt(value => value + 1) }}>{copy.retry}</button>
      </section>}
    </main>
  )
}
export default App
