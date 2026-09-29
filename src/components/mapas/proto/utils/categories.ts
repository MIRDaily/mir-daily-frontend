import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { categoryAccent, styleForCategory } from '@/lib/mapas/graph'
import type { MapCategoryId } from '@/lib/mapas/types'

/**
 * Asigna una categoría a uno o varios nodos: la guarda en el nodo, le da el color (y la
 * forma, si el usuario ha fijado una para esa categoría) y recolorea la línea que llega
 * a cada uno. Es UN paso para deshacer, sea cual sea el número de nodos.
 */
export function applyCategoryToNodes(ids: string[], category: MapCategoryId) {
  const targets = new Set(ids)
  const { nodes, edges } = useMindMapStore.getState()
  if (!nodes.some((n) => targets.has(n.id))) return
  useHistoryStore.getState().pushSnapshot(nodes, edges)

  const overrides = useUIStore.getState().categoryStyles
  const accent = categoryAccent(category, overrides)
  useMindMapStore.setState((s) => ({
    nodes: s.nodes.map((n) =>
      targets.has(n.id)
        ? { ...n, data: { ...n.data, category, style: styleForCategory(n.data.style, category, overrides) } }
        : n,
    ),
    edges: s.edges.map((e) => (targets.has(e.target) ? { ...e, data: { ...e.data, color: accent } } : e)),
  }))
}
