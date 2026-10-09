import { useRef, useState } from 'react'
import type { ResolveItemInput } from '../../../packages/contracts/src'
import type { ItemView } from '../impact/api'
import { DecisionForm } from './DecisionForm'
import { decisionCopy as c } from './copy'
export function DecisionActions({ item, save, refresh }: { item: ItemView; save: (item: ItemView, input: ResolveItemInput) => Promise<void>; refresh: () => void }) {
  const [editing, setEditing] = useState(false); const button = useRef<HTMLButtonElement>(null)
  return <section className="decision-actions"><button ref={button} onClick={() => setEditing(true)} hidden={editing}>{item.latestDecision ? c.update : c.record}</button>{editing && <DecisionForm item={item} cancel={() => { setEditing(false); queueMicrotask(() => button.current?.focus()) }} refresh={refresh} save={async input => { await save(item, input); setEditing(false) }} />}</section>
}
