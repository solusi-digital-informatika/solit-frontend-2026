import { useState } from 'react'
import { referenceCopy as c } from './copy'
import { safeUrl } from './display'
export function ReferencePreview({ url, title }: { url: string | null; title: string }) {
  const [broken, setBroken] = useState(false); const src = safeUrl(url)
  return <div className="reference-preview">{src && !broken ? <img loading="lazy" src={src} alt={title} onError={() => setBroken(true)} referrerPolicy="no-referrer" /> : <p>{broken ? c.brokenImage : c.noImage}</p>}</div>
}
