import { childSlot, useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { childrenMap, descendantsOf, parentMap, syncCollapse } from '@/components/mapas/proto/utils/tree'
import { setCollapsedAnimated } from '@/components/mapas/proto/utils/foldAnimation'

// Operaciones sobre ramas enteras: cambiar un nodo de padre, plegar por niveles.

/**
 * ¿Puede `id` pasar a colgar de `newParent`? No de sí mismo, ni de uno de sus descendientes
 * (sería un ciclo), ni del padre que ya tiene (no cambiaría nada).
 */
export function canReparent(id: string, newParent: string): boolean {
  if (id === newParent) return false
  const { nodes, edges } = useMindMapStore.getState()
  const parents = parentMap(nodes, edges)
  if (parents.get(id) === newParent) return false
  return !descendantsOf([id], childrenMap(parents)).has(newParent)
}

/**
 * Cuelga `id` (con toda su rama) de `newParent`: cambia el padre lógico, reaprovecha la línea que
 * llegaba desde el padre anterior (conserva su estilo) y coloca la rama en la columna de hijos del
 * nuevo padre, debajo del último. Si el nuevo padre estaba plegado, se despliega. No guarda
 * historial (lo hace quien llama). Devuelve los ids movidos, o null si no se podía.
 */
export function reparentNode(id: string, newParent: string): string[] | null {
  if (!canReparent(id, newParent)) return null
  const { nodes, edges } = useMindMapStore.getState()
  const parents = parentMap(nodes, edges)
  const oldParent = parents.get(id)
  const branch = descendantsOf([id], childrenMap(parents))
  const node = nodes.find((n) => n.id === id)
  const target = nodes.find((n) => n.id === newParent)
  if (!node || !target) return null

  // El hueco se calcula sin la rama que se mueve (si no, contaría como hermana de sí misma).
  const slot = childSlot(target, nodes.filter((n) => n.id !== id && !branch.has(n.id)))
  const dx = slot.x - node.position.x
  const dy = slot.y - node.position.y

  useMindMapStore.setState((s) => {
    for (const n of s.nodes) {
      if (n.id === id) {
        n.data.parentId = newParent
        n.position = { x: slot.x, y: slot.y }
      } else if (branch.has(n.id)) {
        n.position = { x: n.position.x + dx, y: n.position.y + dy }
      } else if (n.id === newParent && n.data.collapsed) {
        n.data.collapsed = false
      }
    }
    const edge = oldParent ? s.edges.find((e) => e.source === oldParent && e.target === id) : undefined
    if (edge) {
      edge.source = newParent
      edge.id = `e-${newParent}-${id}`
      edge.sourceHandle = null
      edge.targetHandle = null
    } else {
      s.edges.push({
        id: `e-${newParent}-${id}`,
        source: newParent,
        target: id,
        sourceHandle: null,
        targetHandle: null,
        type: 'animated',
        data: { isAnimating: true },
      })
    }
    syncCollapse(s.nodes, s.edges)
  })
  return [id, ...branch]
}

/** Profundidad de cada nodo (las raíces, 0). A prueba de ciclos. */
export function depths(): Map<string, number> {
  const { nodes, edges } = useMindMapStore.getState()
  const parents = parentMap(nodes, edges)
  const out = new Map<string, number>()
  for (const n of nodes) {
    let d = 0
    const seen = new Set<string>([n.id])
    for (let p = parents.get(n.id); p && !seen.has(p); p = parents.get(p)) {
      seen.add(p)
      d++
    }
    out.set(n.id, d)
  }
  return out
}

/**
 * Ver el mapa hasta un nivel: pliega todo nodo con hijos de ese nivel o más hondo y despliega los
 * de encima. `null` = desplegarlo todo. Un paso de deshacer.
 */
export function showUpToLevel(level: number | null) {
  const store = useMindMapStore.getState()
  const children = childrenMap(parentMap(store.nodes, store.edges))
  const depth = depths()
  const want = (id: string) => level !== null && children.has(id) && (depth.get(id) ?? 0) >= level
  if (store.nodes.every((n) => !!n.data.collapsed === want(n.id))) return
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  setCollapsedAnimated(new Map(store.nodes.map((n) => [n.id, want(n.id)])))
}

/** Pliega o despliega la rama de un nodo (si tiene hijos). Un paso de deshacer. */
export function toggleBranch(id: string) {
  const store = useMindMapStore.getState()
  const node = store.nodes.find((n) => n.id === id)
  if (!node?.data.childCount) return
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  setCollapsedAnimated(new Map([[id, !node.data.collapsed]]))
}

/**
 * Plegar/desplegar varias ramas a la vez (Espacio con varios seleccionados). Si alguna de las que
 * tienen hijos está desplegada, se pliegan todas; si ya estaban todas plegadas, se despliegan.
 * Un paso de deshacer.
 */
export function toggleBranches(ids: string[]) {
  const store = useMindMapStore.getState()
  const withKids = store.nodes.filter((n) => ids.includes(n.id) && n.data.childCount)
  if (withKids.length === 0) return
  const collapse = withKids.some((n) => !n.data.collapsed)
  useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
  setCollapsedAnimated(new Map(withKids.map((n) => [n.id, collapse])))
}
