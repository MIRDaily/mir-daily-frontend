import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { categoryAccent, styleForCategory, styleForNode, styleForTable } from '@/lib/mapas/graph'
import { depths } from '@/components/mapas/proto/utils/branches'
import type { MapCategoryId } from '@/lib/mapas/types'

/**
 * Asigna una categoría a uno o varios nodos: la guarda en el nodo, le da el color (y la
 * forma, si el usuario ha fijado una para esa categoría) y recolorea la línea que llega
 * a cada uno. Es UN paso para deshacer, sea cual sea el número de nodos.
 */
/**
 * Devuelve uno o varios nodos a su estilo de serie (el que les toca por nivel y categoría, con
 * los colores/formas que el usuario haya fijado para esa categoría). Un paso de deshacer.
 */
export function resetNodesStyle(ids: string[]) {
  const targets = new Set(ids)
  const { nodes, edges } = useMindMapStore.getState()
  if (!nodes.some((n) => targets.has(n.id))) return
  useHistoryStore.getState().pushSnapshot(nodes, edges)
  const overrides = useUIStore.getState().categoryStyles
  const depth = depths()
  useMindMapStore.setState((s) => ({
    nodes: s.nodes.map((n) => {
      if (!targets.has(n.id)) return n
      const category = (n.data.category ?? 'general') as MapCategoryId
      const plain = n.data.label.replace(/<[^>]*>/g, '')
      // Una tabla vuelve al estilo de tabla (contorno), esté al nivel que esté.
      const base = n.data.table ? styleForTable(category) : styleForNode(depth.get(n.id) ?? 1, category, plain)
      return { ...n, data: { ...n.data, style: styleForCategory(base, category, overrides) } }
    }),
  }))
}

export function applyCategoryToNodes(ids: string[], category: MapCategoryId) {
  const targets = new Set(ids)
  const { nodes, edges } = useMindMapStore.getState()
  if (!nodes.some((n) => targets.has(n.id))) return
  useHistoryStore.getState().pushSnapshot(nodes, edges)

  const overrides = useUIStore.getState().categoryStyles
  const accent = categoryAccent(category, overrides)
  const depth = depths()
  useMindMapStore.setState((s) => ({
    nodes: s.nodes.map((n) => {
      if (!targets.has(n.id)) return n
      // Lo que fijaba la categoría anterior y no fija la nueva vuelve a lo natural del nodo.
      const was = overrides[(n.data.category ?? 'general') as MapCategoryId]
      const natural = n.data.table
        ? styleForTable(category)
        : styleForNode(depth.get(n.id) ?? 1, category, n.data.label.replace(/<[^>]*>/g, ''))
      return {
        ...n,
        data: { ...n.data, category, style: styleForCategory(n.data.style, category, overrides, { prev: was, natural }) },
      }
    }),
    edges: s.edges.map((e) => (targets.has(e.target) ? { ...e, data: { ...e.data, color: accent } } : e)),
  }))
}
