import { useEffect, useState } from 'react'
import { ApiClientError } from '../../lib/api/client'
import type { AssessmentView, impactApi } from './api'
export function useAssessment(api: ReturnType<typeof impactApi>, id: string | undefined, recommendation: string, resolutionStatus: string, attempt: number) {
  const [data, setData] = useState<AssessmentView | null>(null); const [error, setError] = useState<ApiClientError | null>(null); const [loading, setLoading] = useState(Boolean(id)); const [stillRunning, setStillRunning] = useState(false)
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined; let interval = 1500; const started = Date.now()
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize exact assessment and item filters with server reads.
    setLoading(Boolean(id)); setData(null); setError(null); setStillRunning(false)
    async function read() {
      if (!id || controller.signal.aborted) return
      try {
        const result = await api.get(id, { recommendation: recommendation || undefined, resolutionStatus: resolutionStatus || undefined }, controller.signal)
        if (controller.signal.aborted) return
        setData(result.data); setLoading(false); setError(null)
        if (['PENDING', 'RUNNING'].includes(result.data.status)) { if (Date.now() - started >= 120000) { setStillRunning(true); return } timer = setTimeout(() => void read(), Math.min(interval, 120000 - (Date.now() - started))); interval = Math.min(5000, interval * 1.5) }
      } catch (value) { if (!controller.signal.aborted) { setError(value instanceof ApiClientError ? value : new ApiClientError('Unable to load assessment.', { code: 'UNKNOWN' })); setLoading(false) } }
    }
    void read(); return () => { controller.abort(); clearTimeout(timer) }
  }, [api, id, recommendation, resolutionStatus, attempt])
  return { data, error, loading, stillRunning }
}
