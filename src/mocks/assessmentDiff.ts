import { DirectionDiffSchema, type DirectionRevision, type DirectionDiffChange } from '../../packages/contracts/src'
export function assessmentDiff(from: DirectionRevision | undefined, to: DirectionRevision) {
  const changes: DirectionDiffChange[] = []
  const fields = ['summary', 'palette', 'lighting', 'composition', 'materials', 'mood', 'typography', 'stylePrompt', 'requiredAttributes', 'forbiddenAttributes'] as const
  const categories = { summary: 'SUMMARY', palette: 'PALETTE', lighting: 'LIGHTING', composition: 'COMPOSITION', materials: 'MATERIAL', mood: 'MOOD', typography: 'TYPOGRAPHY', stylePrompt: 'STYLE_PROMPT', requiredAttributes: 'OTHER', forbiddenAttributes: 'OTHER' } as const
  function readable(value: unknown): string | null { if (value === null || value === undefined) return null; if (typeof value === 'string') return value; if (Array.isArray(value)) return value.map(part => typeof part === 'string' ? part : Object.entries(part).filter(([, v]) => v !== null).map(([key, v]) => `${key}: ${v}`).join(', ')).join('; ') || null; return Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && (!Array.isArray(v) || v.length)).map(([key, v]) => `${key}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') || null }
  for (const field of fields) { const before = readable(from?.[field]); const after = readable(to[field]); if (before !== after) changes.push({ category: categories[field], field, from: before, to: after, kind: before === null ? 'ADDED' : after === null ? 'REMOVED' : 'CHANGED' }) }
  return DirectionDiffSchema.parse({ fromRevisionId: from?.id ?? null, toRevisionId: to.id, summary: changes.length ? `${changes.length} direction attribute groups differ.` : 'No recorded direction attributes differ.', changes })
}
