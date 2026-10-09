import { useEffect, useRef, useState } from 'react'
import type { ExportResult } from '../../../packages/contracts/src'
import { ApiClientError } from '../../lib/api/client'
import type { activityApi, ExportView } from './api'
import { activityCopy as c } from './copy'
import { downloadExport } from './download'
export function ActivityError({ error, retry }: { error: ApiClientError; retry?: () => void }) {
  return <div className="project-error" role="alert"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: <code>{error.requestId}</code></p>}{error.details.map((value, index) => <p key={index}>{value.message}</p>)}{error.retryAfterSeconds !== null && <p>Try again after {error.retryAfterSeconds} seconds.</p>}{retry && <button onClick={retry}>{c.retry}</button>}</div>
}
export function ExportPanel({ api, projectId, canExport, created }: { api: ReturnType<typeof activityApi>; projectId: string; canExport: boolean; created: () => void }) {
  const [format, setFormat] = useState<ExportResult['format']>('JSON'); const [result, setResult] = useState<ExportView | null>(null); const [error, setError] = useState<ApiClientError | null>(null); const [busy, setBusy] = useState(false)
  const writing = useRef(false); const mounted = useRef(false); const ready = useRef<HTMLParagraphElement>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (result) ready.current?.focus() }, [result])
  async function create() {
    if (writing.current || !canExport) return
    writing.current = true; setBusy(true); setError(null); setResult(null)
    try { const response = await api.export(projectId, format); if (mounted.current) { setResult(response.data); created() } }
    catch (value) { if (mounted.current) setError(value instanceof ApiClientError ? value : new ApiClientError('Unable to create export.', { code: 'UNKNOWN' })) }
    finally { writing.current = false; if (mounted.current) setBusy(false) }
  }
  return <section className="home-panel" aria-labelledby="export-heading"><h3 id="export-heading">{c.exportHeading}</h3><p>{c.exportIntro}</p><label>{c.format}<select aria-label={c.format} value={format} disabled={busy} onChange={event => setFormat(event.target.value as ExportResult['format'])}><option value="JSON">JSON — full project records</option><option value="MARKDOWN">Markdown — project report</option><option value="CSV">CSV — assets and latest versions</option></select></label><button disabled={busy || !canExport} onClick={() => void create()}>{busy ? c.creating : c.create}</button>
    {error && <><ActivityError error={error} /><p>{c.failedWrite}</p></>}{result && <div><p ref={ready} tabIndex={-1} role="status">{c.ready}</p><p>{result.filename} · <time dateTime={result.createdAt}>{new Date(result.createdAt).toLocaleString()}</time></p>{result.warnings.length > 0 && <section aria-label={c.warnings}><h4>{c.warnings}</h4><ul>{result.warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}</ul></section>}<button onClick={() => downloadExport(result)}>{c.download}</button></div>}
  </section>
}
