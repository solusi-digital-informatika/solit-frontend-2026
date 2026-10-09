import { referenceCopy as c } from './copy'
export function label(labels: Record<string, string>, value: string) { return Object.hasOwn(labels, value) ? labels[value] : c.unknown }
export function safeUrl(value: string | null): string | null {
  if (!value) return null
  try { const url = new URL(value, window.location.origin); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
