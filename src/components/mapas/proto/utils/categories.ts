import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { categoryAccent, LABEL_FONT_SIZE, styleForCategory, styleForNode, styleForTable, type LabelStyle } from '@/lib/mapas/graph'
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
/** Tamaño de letra de los rótulos de este mapa (pestaña «Rótulos» de Categorías). */
export const labelFont = () => useUIStore.getState().labelStyle.fontSize ?? LABEL_FONT_SIZE

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
      return { ...n, data: { ...n.data, style: styleForCategory(base, category, overrides, undefined, labelFont()) } }
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
        data: { ...n.data, category, style: styleForCategory(n.data.style, category, overrides, { prev: was, natural }, labelFont()) },
      }
    }),
    edges: s.edges.map((e) => (targets.has(e.target) ? { ...e, data: { ...e.data, color: accent } } : e)),
  }))
}

/**
 * Cambia cómo se ven los rótulos de este mapa (pestaña «Rótulos» de Categorías). `undefined` quita
 * un ajuste; `null` los restablece todos. El tamaño se aplica también a los rótulos que ya hay (un
 * paso de deshacer); los colores y las mayúsculas son de dibujo y no tocan los nodos.
 */
export function changeLabelStyle(patch: Partial<Record<keyof LabelStyle, LabelStyle[keyof LabelStyle] | undefined>> | null) {
  const ui = useUIStore.getState()
  const next: LabelStyle = patch === null ? {} : { ...ui.labelStyle }
  if (patch !== null) {
    for (const [k, v] of Object.entries(patch) as [keyof LabelStyle, unknown][]) {
      if (v === undefined) delete next[k]
      else (next as Record<string, unknown>)[k] = v
    }
  }
  const before = ui.labelStyle.fontSize ?? LABEL_FONT_SIZE
  const after = next.fontSize ?? LABEL_FONT_SIZE
  ui.setLabelStyle(next)
  if (before === after) return
  const { nodes, edges } = useMindMapStore.getState()
  if (!nodes.some((n) => n.data.style.shape === 'label')) return
  useHistoryStore.getState().pushSnapshot(nodes, edges)
  useMindMapStore.setState((s) => ({
    nodes: s.nodes.map((n) =>
      n.data.style.shape === 'label' ? { ...n, data: { ...n.data, style: { ...n.data.style, fontSize: after } } } : n,
    ),
  }))
}
