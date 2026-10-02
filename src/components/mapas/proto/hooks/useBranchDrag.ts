import { useCallback, useEffect, useRef } from 'react'
import type { OnNodeDrag } from '@xyflow/react'
import { setDragFollower, useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { settleNodes } from '@/components/mapas/proto/hooks/usePhysics'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

type DragState = {
  anchorId: string
  start: { x: number; y: number }
  /** Descendientes que siguen al arrastre, con su posición al empezar. */
  followers: Map<string, { x: number; y: number }>
}

/** El mapa tal como estaba al empezar a arrastrar (referencias: la store es inmutable). */
type Before = { nodes: MindMapNode[]; edges: MindMapEdge[] }

/**
 * Arrastrar un nodo arrastra su rama entera (todos sus descendientes, también los de ramas
 * plegadas). Con Alt pulsado al empezar se mueve solo el nodo, como antes.
 *
 * Cada arrastre es un paso de deshacer (incluido lo que la física aparte al soltar). La copia
 * para el historial se hace una sola vez al soltar y solo si algo se movió: al empezar basta
 * con guardar la referencia al estado, que la store no muta.
 */
export function useBranchDrag() {
  const drag = useRef<DragState | null>(null)
  const before = useRef<Before | null>(null)

  const onNodeDragStart: OnNodeDrag<MindMapNode> = useCallback((e, node, dragged) => {
    useUIStore.getState().setDragging(true)
    const { nodes, edges } = useMindMapStore.getState()
    before.current = { nodes, edges }
    drag.current = null
    setDragFollower(null)
    if (e.altKey) return
    const draggedIds = new Set(dragged.map((n) => n.id))
    const desc = descendantsOf(draggedIds, childrenMap(parentMap(nodes, edges)))
    if (desc.size === 0) return
    const followers = new Map<string, { x: number; y: number }>()
    for (const n of nodes) if (desc.has(n.id)) followers.set(n.id, { ...n.position })
    const d: DragState = { anchorId: node.id, start: { ...node.position }, followers }
    drag.current = d
    // Los descendientes se mueven dentro de la misma actualización que mueve el nodo (la de
    // React Flow): un solo render por fotograma.
    setDragFollower((draft) => {
      const anchor = draft.find((n) => n.id === d.anchorId)
      if (!anchor) return
      const dx = anchor.position.x - d.start.x
      const dy = anchor.position.y - d.start.y
      for (const n of draft) {
        const p = d.followers.get(n.id)
        if (p && (n.position.x !== p.x + dx || n.position.y !== p.y + dy)) n.position = { x: p.x + dx, y: p.y + dy }
      }
    })
  }, [])

  const onNodeDragStop: OnNodeDrag<MindMapNode> = useCallback((_, __, dragged) => {
    useUIStore.getState().setDragging(false)
    setDragFollower(null)
    const moved = [...dragged.map((n) => n.id), ...(drag.current?.followers.keys() ?? [])]
    drag.current = null

    const prev = before.current
    before.current = null
    if (prev) {
      const was = new Map(prev.nodes.map((n) => [n.id, n.position]))
      const now = useMindMapStore.getState().nodes
      const changed = now.some((n) => {
        const p = was.get(n.id)
        return p && (p.x !== n.position.x || p.y !== n.position.y)
      })
      if (changed) useHistoryStore.getState().pushSnapshot(prev.nodes, prev.edges)
    }

    // Al cambiar de lado respecto a sus hijos, el botón de plegar debe cambiar de lado.
    useMindMapStore.getState().syncCollapse()
    // Con la física activa, lo que quede pisado por lo soltado se aparta (lo soltado no se mueve).
    if (useUIStore.getState().physicsEnabled) settleNodes({ pinned: moved })
  }, [])

  // Si el editor se desmonta a mitad de un arrastre, que no quede el seguidor colgado.
  useEffect(() => () => setDragFollower(null), [])

  return { onNodeDragStart, onNodeDragStop }
}
