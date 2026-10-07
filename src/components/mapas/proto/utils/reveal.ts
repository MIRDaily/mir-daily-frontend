import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { getFlow, selectOnly } from '@/components/mapas/proto/utils/keyboard'
import { parentMap } from '@/components/mapas/proto/utils/tree'
import { setCollapsedAnimated } from '@/components/mapas/proto/utils/foldAnimation'

// Ir a un nodo que puede estar escondido en una rama plegada: lo usan el buscador (Ctrl+F) y la
// revisión guiada (N / Mayús+N).

/** Despliega las ramas plegadas que esconden al nodo. No es un paso de deshacer: solo se mira. */
export function unfoldTo(id: string) {
  const { nodes, edges } = useMindMapStore.getState()
  const parents = parentMap(nodes, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const toOpen = new Set<string>()
  const seen = new Set<string>([id])
  for (let p = parents.get(id); p && !seen.has(p); p = parents.get(p)) {
    seen.add(p)
    if (byId.get(p)?.data.collapsed) toOpen.add(p)
  }
  if (toOpen.size === 0) return
  setCollapsedAnimated(new Map([...toOpen].map((p) => [p, false])))
}

/** Centra la vista en el nodo (con al menos un zoom legible). */
export function centerOn(id: string) {
  const flow = getFlow()
  const node = useMindMapStore.getState().nodes.find((n) => n.id === id)
  if (!flow || !node || useUIStore.getState().cameraLocked) return
  const w = node.measured?.width ?? 160
  const h = node.measured?.height ?? 50
  const zoom = Math.max(flow.getViewport().zoom, 0.9)
  void flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom, duration: 400 })
}

/** Despliega lo necesario, selecciona el nodo y lleva la vista hasta él. */
export function goToNode(id: string) {
  unfoldTo(id)
  selectOnly(id)
  // Lo recién desplegado aún no está medido: se centra en el fotograma siguiente.
  requestAnimationFrame(() => centerOn(id))
}
