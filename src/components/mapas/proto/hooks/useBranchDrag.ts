import { useCallback, useEffect, useRef } from 'react'
import type { OnNodeDrag } from '@xyflow/react'
import { setDragFollower, useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { settleNodes } from '@/components/mapas/proto/hooks/usePhysics'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import { canReparent, reparentNode } from '@/components/mapas/proto/utils/branches'
import { getFlow } from '@/components/mapas/proto/utils/keyboard'
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

const DROP_CLASS = 'drop-target'

/** Marca de arrastre en el editor: el CSS oculta las barras de los nodos (+, paleta, papelera) y
 *  los botones de plegar, que si no tapaban el nodo destino y su aviso. */
function setDragFlag(on: boolean) {
  document.querySelector('.mapa-root')?.toggleAttribute('data-dragging', on)
}

function markDropTarget(id: string | null, prev: string | null) {
  if (id === prev) return
  if (prev) document.querySelector(`.react-flow__node[data-id="${prev}"]`)?.classList.remove(DROP_CLASS)
  if (id) document.querySelector(`.react-flow__node[data-id="${id}"]`)?.classList.add(DROP_CLASS)
}

/**
 * Arrastrar un nodo arrastra su rama entera (todos sus descendientes, también los de ramas
 * plegadas). Con Alt pulsado al empezar se mueve solo el nodo, como antes.
 *
 * Con Ctrl pulsado mientras se arrastra, el nodo bajo el puntero se resalta y, al soltar, la rama
 * pasa a colgar de él (cambiar de rama). Hace falta Ctrl a propósito: soltar un nodo cerca de
 * otro es lo normal al recolocar y no debe cambiar la jerarquía sin querer.
 *
 * Cada arrastre es un paso de deshacer (incluido el cambio de rama y lo que la física aparte al
 * soltar). La copia para el historial se hace una sola vez al soltar: al empezar basta con
 * guardar la referencia al estado, que la store no muta.
 */
export function useBranchDrag() {
  const drag = useRef<DragState | null>(null)
  const before = useRef<Before | null>(null)
  /** Nodos que no pueden ser el nuevo padre: el arrastrado y su rama (están bajo el puntero). */
  const excluded = useRef<Set<string>>(new Set())
  const dropTarget = useRef<string | null>(null)
  const draggedId = useRef<string | null>(null)

  const setDropTarget = (id: string | null) => {
    markDropTarget(id, dropTarget.current)
    // Con destino, lo arrastrado se vuelve translúcido para que se vea lo que hay debajo.
    if (draggedId.current) {
      document
        .querySelector(`.react-flow__node[data-id="${draggedId.current}"]`)
        ?.classList.toggle('reparenting', !!id)
    }
    dropTarget.current = id
  }

  const onNodeDragStart: OnNodeDrag<MindMapNode> = useCallback((e, node, dragged) => {
    useUIStore.getState().setDragging(true)
    setDragFlag(true)
    draggedId.current = node.id
    const { nodes, edges } = useMindMapStore.getState()
    before.current = { nodes, edges }
    drag.current = null
    setDragFollower(null)
    const draggedIds = new Set(dragged.map((n) => n.id))
    const desc = descendantsOf(draggedIds, childrenMap(parentMap(nodes, edges)))
    excluded.current = new Set([...draggedIds, ...desc])
    if (e.altKey || desc.size === 0) return
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

  // Solo busca un destino con Ctrl y arrastrando un único nodo; no toca la store (el resaltado
  // es una clase en el DOM), así que no cuesta nada a la fluidez del arrastre.
  const onNodeDrag: OnNodeDrag<MindMapNode> = useCallback((e, node, dragged) => {
    const flow = getFlow()
    if (!(e.ctrlKey || e.metaKey) || dragged.length !== 1 || !flow) {
      setDropTarget(null)
      return
    }
    const pt = 'touches' in e ? e.touches[0] : e
    if (!pt) {
      setDropTarget(null)
      return
    }
    const p = flow.screenToFlowPosition({ x: pt.clientX, y: pt.clientY })
    let hit: string | null = null
    for (const n of useMindMapStore.getState().nodes) {
      if (n.hidden || excluded.current.has(n.id)) continue
      const w = n.measured?.width ?? 160
      const h = n.measured?.height ?? 50
      if (p.x >= n.position.x && p.x <= n.position.x + w && p.y >= n.position.y && p.y <= n.position.y + h) {
        hit = n.id
        break
      }
    }
    setDropTarget(hit && canReparent(node.id, hit) ? hit : null)
  }, [])

  const onNodeDragStop: OnNodeDrag<MindMapNode> = useCallback((e, node, dragged) => {
    useUIStore.getState().setDragging(false)
    setDragFlag(false)
    setDragFollower(null)
    let moved = [...dragged.map((n) => n.id), ...(drag.current?.followers.keys() ?? [])]
    drag.current = null

    // Cambio de rama: Ctrl todavía pulsado al soltar y un destino válido resaltado.
    const target = dropTarget.current
    setDropTarget(null)
    let reparented = false
    if (target && (e.ctrlKey || e.metaKey) && dragged.length === 1) {
      const branch = reparentNode(node.id, target)
      if (branch) {
        reparented = true
        moved = branch
      }
    }

    const prev = before.current
    before.current = null
    if (prev) {
      const was = new Map(prev.nodes.map((n) => [n.id, n.position]))
      const now = useMindMapStore.getState().nodes
      const changed =
        reparented ||
        now.some((n) => {
          const p = was.get(n.id)
          return p && (p.x !== n.position.x || p.y !== n.position.y)
        })
      if (changed) useHistoryStore.getState().pushSnapshot(prev.nodes, prev.edges)
    }

    // Al cambiar de lado respecto a sus hijos, el botón de plegar debe cambiar de lado.
    useMindMapStore.getState().syncCollapse()
    // Con la física activa, lo que quede pisado se aparta. Lo soltado no se mueve; una rama que
    // acaba de cambiar de padre sí cede (se ha colocado sola en la columna de su nuevo padre).
    if (useUIStore.getState().physicsEnabled) {
      settleNodes(reparented ? { movers: moved } : { pinned: moved })
    }
  }, [])

  // Si el editor se desmonta a mitad de un arrastre, que no quede nada colgado.
  useEffect(
    () => () => {
      setDragFollower(null)
      markDropTarget(null, dropTarget.current)
      setDragFlag(false)
    },
    [],
  )

  return { onNodeDragStart, onNodeDrag, onNodeDragStop }
}
