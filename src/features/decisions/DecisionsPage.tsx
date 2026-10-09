import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import { projectApi } from '../projects/api'
import { DecisionHistory } from './DecisionHistory'
export function DecisionsPage({ client, projectId }: { client: ApiClient; projectId: string }) {
  const api = useMemo(() => projectApi(client), [client]); const [name, setName] = useState(''); const [error, setError] = useState<ApiClientError | null>(null); const [attempt, setAttempt] = useState(0)
  useEffect(() => { const controller = new AbortController(); api.get(projectId, controller.signal).then(result => { if (!controller.signal.aborted) { setName(result.data.name); setError(null) } }).catch(value => { if (!controller.signal.aborted) setError(value instanceof ApiClientError ? value : new ApiClientError('Unable to load project.', { code: 'UNKNOWN' })) }); return () => controller.abort() }, [api, projectId, attempt])
  return <><nav><a href={`#/projects/${projectId}`}>Project overview</a> · <a href={`#/projects/${projectId}/impact`}>View impact map</a></nav><h2>Human decisions</h2><p>{name}</p>{error && <div role="alert"><p>{error.message}</p>{error.requestId && <p>Request ID: {error.requestId}</p>}<button onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}<p>Decisions record human intent and preserve earlier decisions, asset versions and collection pins.</p><DecisionHistory client={client} projectId={projectId} /></>
}
