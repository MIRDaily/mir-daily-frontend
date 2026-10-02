import { useCallback, useRef } from 'react'
import type { OnNodeDrag } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { settleNodes } from '@/components/mapas/proto/hooks/usePhysics'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'

type DragState = {
  anchorId: string
  start: { x: number; y: number }
  /** Descendientes que siguen al arrastre, con su posición al empezar. */
  followers: Map<string, { x: number; y: number }>
}

/**
 * Arrastrar un nodo arrastra su rama entera (todos sus descendientes, también los de ramas
 * plegadas). Con Alt pulsado al empezar se mueve solo el nodo, como antes.
 */
export function useBranchDrag() {
  const drag = useRef<DragState | null>(null)

  const onNodeDragStart: OnNodeDrag<MindMapNode> = useCallback((e, node, dragged) => {
    useUIStore.getState().setDragging(true)
    drag.current = null
    if (e.altKey) return
    const { nodes, edges } = useMindMapStore.getState()
    const draggedIds = new Set(dragged.map((n) => n.id))
    const desc = descendantsOf(draggedIds, childrenMap(parentMap(nodes, edges)))
    if (desc.size === 0) return
    const followers = new Map<string, { x: number; y: number }>()
    for (const n of nodes) if (desc.has(n.id)) followers.set(n.id, { ...n.position })
    drag.current = { anchorId: node.id, start: { ...node.position }, followers }
  }, [])

  const onNodeDrag: OnNodeDrag<MindMapNode> = useCallback((_, node) => {
    const d = drag.current
    if (!d || node.id !== d.anchorId) return
    const dx = node.position.x - d.start.x
    const dy = node.position.y - d.start.y
    useMindMapStore.setState((s) => {
      for (const n of s.nodes) {
        const p = d.followers.get(n.id)
        if (p) n.position = { x: p.x + dx, y: p.y + dy }
      }
    })
  }, [])

  const onNodeDragStop: OnNodeDrag<MindMapNode> = useCallback((_, __, dragged) => {
    useUIStore.getState().setDragging(false)
    const moved = [...dragged.map((n) => n.id), ...(drag.current?.followers.keys() ?? [])]
    drag.current = null
    // Al cambiar de lado respecto a sus hijos, el botón de plegar debe cambiar de lado.
    useMindMapStore.getState().syncCollapse()
    // Con la física activa, lo que quede pisado por lo soltado se aparta (lo soltado no se mueve).
    if (useUIStore.getState().physicsEnabled) settleNodes({ pinned: moved })
  }, [])

  return { onNodeDragStart, onNodeDrag, onNodeDragStop }
}
