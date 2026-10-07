import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { isSubgroup } from '@/lib/mapas/subgroups'
import { toLabelStyle } from '@/lib/mapas/graph'
import { plainText } from '@/lib/mapas/export/richtext'

// «Convertir subgrupos en rótulos» para los mapas que ya estaban hechos: la regla de
// lib/mapas/subgroups.ts PROPONE los candidatos y el usuario confirma. Los mapas nuevos de IA ya
// traen los subgrupos marcados por el servidor y nacen como rótulo.

export type SubgroupCandidate = { id: string; label: string; parent: string }

/** Nodos que parecen subgrupos y aún no son rótulo, en el orden del mapa. */
export function subgroupCandidates(): SubgroupCandidate[] {
  const { nodes } = useMindMapStore.getState()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const kids = new Map<string, typeof nodes>()
  for (const n of nodes) {
    if (!n.data.parentId) continue
    const list = kids.get(n.data.parentId)
    if (list) list.push(n)
    else kids.set(n.data.parentId, [n])
  }
  const out: SubgroupCandidate[] = []
  for (const n of nodes) {
    if (n.data.table || n.data.style.shape === 'label') continue
    const label = plainText(n.data.label)
    const children = kids.get(n.id) ?? []
    const childrenAreLeaves = children.length > 0 && children.every((c) => !(kids.get(c.id) ?? []).length)
    const ok = isSubgroup(
      { label, parentId: n.data.parentId, childCount: children.length, outlined: n.data.style.borderWidth > 0 },
      childrenAreLeaves,
    )
    if (ok) out.push({ id: n.id, label, parent: plainText(byId.get(n.data.parentId ?? '')?.data.label ?? '') })
  }
  return out
}

/** Pasa esos nodos a rótulo (un solo paso de deshacer). Devuelve cuántos ha cambiado. */
export function convertToLabels(ids: string[]): number {
  const store = useMindMapStore.getState()
  const targets = new Set(ids)
  const changed = store.nodes.filter((n) => targets.has(n.id) && n.data.style.shape !== 'label')
  if (changed.length === 0) return 0
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  useMindMapStore.setState((s) => {
    for (const n of s.nodes) {
      if (targets.has(n.id) && n.data.style.shape !== 'label') n.data.style = toLabelStyle(n.data.style)
    }
  })
  return changed.length
}
