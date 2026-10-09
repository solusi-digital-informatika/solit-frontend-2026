import type { ExportResult } from '../../../packages/contracts/src'
export function downloadExport(result: Pick<ExportResult, 'content' | 'contentType' | 'filename'>) {
  const url = URL.createObjectURL(new Blob([result.content], { type: `${result.contentType};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = Array.from(result.filename, character => /[\\/]/.test(character) || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '_' : character).join('')
  document.body.append(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
