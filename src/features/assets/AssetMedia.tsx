import { useState } from 'react'
import { safeUrl } from '../references/display'
import { assetCopy as c } from './copy'
export function AssetMedia({ url, title }: { url: string | null; title: string }) {
  const [broken, setBroken] = useState(false)
  const href = safeUrl(url)
  return <div className="asset-preview">{href && !broken ? <img src={href} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <p>{broken ? c.brokenPreview : c.noPreview}</p>}</div>
}
export function AssetStatus({ status, version = false }: { status: string; version?: boolean }) {
  const labels: Record<string, string> = version ? c.versionStatuses : c.statuses
  const known = Object.hasOwn(labels, status)
  return <span className={`asset-status status-badge status-${status.toLowerCase()}`}><span className="status-dot" aria-hidden="true" /> {known ? labels[status] : c.unknown}</span>
}
