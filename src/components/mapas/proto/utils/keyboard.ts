import type { ReactFlowInstance } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { childrenMap, parentMap } from '@/components/mapas/proto/utils/tree'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

// Acciones de teclado del editor (Tab = hijo, Enter = hermano, flechas = moverse por el mapa).
// Viven aquí porque las usan tanto los atajos globales como el editor de texto del nodo.

type Flow = ReactFlowInstance<MindMapNode, MindMapEdge>
let flow: Flow | null = null

/** Lo registra el lienzo: hace falta para llevar la vista hasta un nodo. */
/** La vista de React Flow (para convertir coordenadas de pantalla o mover la cámara). */
export function getFlow(): Flow | null {
  return flow
}

export function registerFlow(instance: Flow | null) {
  flow = instance
}

/** Si el nodo queda fuera de la vista, la centra en él (sin cambiar el zoom). */
export function revealNode(id: string) {
  const node = useMindMapStore.getState().nodes.find((n) => n.id === id)
  const pane = document.querySelector('.mapa-root .react-flow')?.getBoundingClientRect()
  if (!flow || !node || !pane || useUIStore.getState().cameraLocked) return
  const w = node.measured?.width ?? 160
  const h = node.measured?.height ?? 50
  const { x, y, zoom } = flow.getViewport()
  const sx = node.position.x * zoom + x
  const sy = node.position.y * zoom + y
  const margin = 60
  const inside =
    sx >= margin && sy >= margin && sx + w * zoom <= pane.width - margin && sy + h * zoom <= pane.height - margin
  if (!inside) void flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom, duration: 300 })
}

/** Deja seleccionado solo ese nodo (y ninguna línea). */
export function selectOnly(id: string) {
  useMindMapStore.setState((s) => {
    for (const n of s.nodes) {
      const sel = n.id === id
      if (!!n.selected !== sel) n.selected = sel
    }
    for (const e of s.edges) if (e.selected) e.selected = false
  })
}

/** Crea un hijo, lo selecciona y lo deja en edición. Devuelve su id. */
export function addChildAndEdit(parentId: string): string {
  const store = useMindMapStore.getState()
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  const id = store.addNode(parentId)
  selectOnly(id)
  useMindMapStore.getState().setEditing(id)
  requestAnimationFrame(() => revealNode(id))
  return id
}

/** Crea un hermano (hijo del mismo padre); en la raíz, un hijo. */
export function addSiblingAndEdit(id: string): string {
  const { nodes, edges } = useMindMapStore.getState()
  const parent = parentMap(nodes, edges).get(id)
  return addChildAndEdit(parent ?? id)
}

export type Direction = 'up' | 'down' | 'left' | 'right'

/**
 * Salta al vecino conectado (padre, hijos o hermanos) que esté en esa dirección: el más cercano
 * a lo largo de ella, penalizando lo que se desvía hacia los lados.
 */
export function navigate(id: string, dir: Direction): string | null {
  const { nodes, edges } = useMindMapStore.getState()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const cur = byId.get(id)
  if (!cur) return null
  const parents = parentMap(nodes, edges)
  const children = childrenMap(parents)
  const parent = parents.get(id)
  const near = new Set<string>([
    ...(parent ? [parent] : []),
    ...(children.get(id) ?? []),
    ...(parent ? children.get(parent) ?? [] : []),
  ])
  near.delete(id)

  const center = (n: MindMapNode) => ({
    x: n.position.x + (n.measured?.width ?? 160) / 2,
    y: n.position.y + (n.measured?.height ?? 50) / 2,
  })
  const c = center(cur)
  let best: { id: string; score: number } | null = null
  for (const nid of near) {
    const n = byId.get(nid)
    if (!n || n.hidden) continue
    const p = center(n)
    const dx = p.x - c.x
    const dy = p.y - c.y
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy
    const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx)
    if (along <= 1) continue
    const score = along + side * 2
    if (!best || score < best.score) best = { id: nid, score }
  }
  if (!best) return null
  selectOnly(best.id)
  revealNode(best.id)
  return best.id
}
