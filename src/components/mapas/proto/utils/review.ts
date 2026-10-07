import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { nextPending, readingOrder } from '@/components/mapas/proto/utils/reviewOrder'
import { goToNode } from '@/components/mapas/proto/utils/reveal'
import { isPendingReview, type NodoIA } from '@/lib/mapas/ia/revision'

// Revisión guiada de un mapa de IA: ir al dudoso siguiente o al anterior (N / Mayús+N), en el
// orden en que se lee el mapa, y marcarlo como revisado (quita el ámbar).

/** Lleva la vista al dudoso siguiente o anterior a la selección. Devuelve su id. */
export function goToPending(dir: 1 | -1): string | null {
  const { nodes, edges } = useMindMapStore.getState()
  const pending = new Set(nodes.filter((n) => isPendingReview(n.data.ia)).map((n) => n.id))
  if (pending.size === 0) return null
  const sel = nodes.filter((n) => n.selected)
  const target = nextPending(readingOrder(nodes, edges), (id) => pending.has(id), sel.length === 1 ? sel[0].id : null, dir)
  if (target) goToNode(target)
  return target
}

/** Marca el nodo como revisado (un paso de deshacer). Con `advance`, va al siguiente pendiente. */
export function markReviewed(id: string, advance = false) {
  const store = useMindMapStore.getState()
  const node = store.nodes.find((n) => n.id === id)
  if (!node || !isPendingReview(node.data.ia)) return
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  store.updateNodeData(id, { ia: { ...(node.data.ia as NodoIA), revisado: true } })
  if (advance) goToPending(1)
}

/** Cuántos quedan por revisar y cuántos dudosos había (para el banner). */
export function useReviewCounts(): { pending: number; total: number } {
  const pending = useMindMapStore((s) => s.nodes.reduce((k, n) => k + (isPendingReview(n.data.ia) ? 1 : 0), 0))
  const total = useMindMapStore((s) => s.nodes.reduce((k, n) => k + (n.data.ia?.dudoso ? 1 : 0), 0))
  return { pending, total }
}
