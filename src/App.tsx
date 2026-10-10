import { useEffect, useState } from 'react'
import { ApiClientError, assertCompatibleContract, type ApiClient } from './lib/api/client'
import { copy } from './copy/en'
import './App.css'
import { Projects } from './features/projects/Projects'

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
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content" onClick={event => { event.preventDefault(); document.getElementById('workspace-content')?.focus() }}>Skip to workspace</a>
      <header className="app-topbar"><a className="app-brand" href="#/projects" aria-label="Branchframe workspace"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span><h1>{copy.brand}</h1><span className="brand-subtitle">Creative workspace</span></span></a><div className="topbar-message">Ideas evolve. Good work stays.</div></header>
      <main className="welcome" id="workspace-content" tabIndex={-1}>
      {offline && !isMockApi && <p role="status" className="offline-notice">{copy.offline}</p>}
      {connection.kind === 'loading' && <div className="boot-state"><span className="loading-orbit" aria-hidden="true" /><p role="status">{copy.loading}</p></div>}
      {connection.kind === 'ready' && <Projects client={client} isMockApi={isMockApi} />}
      {connection.kind === 'error' && <section role="alert" className="connection error">
        <h2>{copy.failed}</h2>
        <p>{connection.error.message}</p>
        {connection.error.requestId && <p>{copy.requestId}: <code>{connection.error.requestId}</code></p>}
        <button type="button" onClick={() => { setConnection({ kind: 'loading' }); setAttempt(value => value + 1) }}>{copy.retry}</button>
      </section>}
      </main>
    </div>
  )
}
export default App
