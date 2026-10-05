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

type Caja = { x: number; y: number; w: number; h: number }

const cajaDe = (n: { position: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number; height?: number }): Caja => ({
  x: n.position.x,
  y: n.position.y,
  w: n.measured?.width ?? n.width ?? 160,
  h: n.measured?.height ?? n.height ?? 50,
})

const MARGEN_ESPEJO = 24

/** Caja que envuelve varias. */
function envolvente(cajas: Caja[]): Caja {
  const x = Math.min(...cajas.map((c) => c.x))
  const y = Math.min(...cajas.map((c) => c.y))
  return {
    x,
    y,
    w: Math.max(...cajas.map((c) => c.x + c.w)) - x,
    h: Math.max(...cajas.map((c) => c.y + c.h)) - y,
  }
}

const chocan = (a: Caja, b: Caja) =>
  a.x < b.x + b.w + MARGEN_ESPEJO && b.x < a.x + a.w + MARGEN_ESPEJO &&
  a.y < b.y + b.h + MARGEN_ESPEJO && b.y < a.y + a.h + MARGEN_ESPEJO

/**
 * Pasa cada rama seleccionada al otro lado de su padre, en espejo: el nodo y todos sus
 * descendientes se reflejan respecto al eje vertical que pasa por el centro del padre, de modo
 * que lo que se abría hacia la izquierda se abre hacia la derecha (y al revés) con la misma forma.
 * Las líneas cambian de lado solas (eligen el lado según las posiciones). Si al otro lado la rama
 * pisa nodos que ya estaban allí, se desplaza en vertical al hueco libre más cercano.
 * La raíz no se mueve. Un paso de deshacer. Devuelve cuántas ramas se han invertido.
 */
export function mirrorBranches(ids: string[]): number {
  const store = useMindMapStore.getState()
  const { nodes, edges } = store
  const parents = parentMap(nodes, edges)
  const children = childrenMap(parents)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  // Si se selecciona una rama y algo de dentro, se invierte solo la de fuera (si no, lo de dentro
  // daría la vuelta dos veces y quedaría donde estaba).
  const elegidos = new Set(ids.filter((id) => parents.has(id) && byId.has(parents.get(id) as string)))
  for (const id of [...elegidos]) {
    for (let p = parents.get(id); p; p = parents.get(p)) if (elegidos.has(p)) { elegidos.delete(id); break }
  }
  if (elegidos.size === 0) return 0

  const nuevas = new Map<string, { x: number; y: number }>()
  for (const id of elegidos) {
    const padre = cajaDe(byId.get(parents.get(id) as string)!)
    const eje = padre.x + padre.w / 2
    const rama = [id, ...descendantsOf([id], children)]
    const reflejadas = rama.map((nid) => {
      const c = cajaDe(byId.get(nid)!)
      return { id: nid, caja: { ...c, x: 2 * eje - c.x - c.w } }
    })
    // Hueco libre más cercano en vertical frente a lo visible que no es de la rama.
    const enRama = new Set(rama)
    const visibles = reflejadas.filter((r) => !byId.get(r.id)!.hidden).map((r) => r.caja)
    const bloque = envolvente(visibles.length ? visibles : reflejadas.map((r) => r.caja))
    const otros = nodes
      .filter((n) => !n.hidden && !enRama.has(n.id))
      .map((n) => (nuevas.has(n.id) ? { ...cajaDe(n), ...nuevas.get(n.id)! } : cajaDe(n)))
    const libre = (dy: number) => !otros.some((o) => chocan({ ...bloque, y: bloque.y + dy }, o))
    let dy = 0
    if (!libre(0)) {
      const candidatos = otros
        .flatMap((o) => [o.y + o.h + MARGEN_ESPEJO - bloque.y, o.y - MARGEN_ESPEJO - bloque.h - bloque.y])
        .sort((a, b) => Math.abs(a) - Math.abs(b))
      dy = candidatos.find((c) => libre(c)) ?? 0
    }
    for (const r of reflejadas) nuevas.set(r.id, { x: r.caja.x, y: r.caja.y + dy })
  }

  useHistoryStore.getState().pushSnapshot(nodes, edges)
  useMindMapStore.setState((s) => {
    for (const n of s.nodes) {
      const p = nuevas.get(n.id)
      if (p) n.position = p
    }
    // Las líneas guardaban el lado por el que salían: se dejan libres para que lo elija la posición.
    for (const e of s.edges) {
      if (nuevas.has(e.target)) {
        e.sourceHandle = null
        e.targetHandle = null
      }
    }
    syncCollapse(s.nodes, s.edges)
  })
  return elegidos.size
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
