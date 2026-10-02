import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { parentMap, syncCollapse } from '@/components/mapas/proto/utils/tree'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

// Plegar y desplegar ramas con animación. Al plegar, la rama entera (nodos y líneas) se recoge
// hacia el centro del nodo que se pliega, escalándose alrededor de ese punto, y se desvanece al
// final; después se oculta de verdad. Al desplegar, sale desde ahí. Web Animations API sobre el
// contenedor de cada nodo y el <g> de cada línea: no se tocan posiciones ni la store.

const OUT_MS = 240
/** Escala a la que se recoge la rama (casi un punto en el centro del nodo que se pliega). */
const SMALL = 0.08
const IN_MS = 320
const EASE_IN = 'cubic-bezier(.4, 0, 1, 1)'
const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)'

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const nodeEl = (id: string) =>
  document.querySelector<HTMLElement>(`.mapa-root .react-flow__node[data-id="${id}"] .mindmap-node-root`)
const edgeEl = (id: string) => document.querySelector<SVGGElement>(`.mapa-root .react-flow__edge[data-id="${id}"]`)

const center = (n: MindMapNode) => ({
  x: n.position.x + (n.measured?.width ?? 160) / 2,
  y: n.position.y + (n.measured?.height ?? 50) / 2,
})

/** Qué quedaría oculto con estos cambios de plegado (simulado sobre copias). */
function hiddenAfter(nodes: MindMapNode[], edges: MindMapEdge[], changes: Map<string, boolean>): Set<string> {
  const ns = nodes.map((n) => ({ ...n, data: { ...n.data, collapsed: changes.get(n.id) ?? n.data.collapsed } }))
  const es = edges.map((e) => ({ ...e }))
  syncCollapse(ns, es)
  return new Set(ns.filter((n) => n.hidden).map((n) => n.id))
}

/** El antepasado más cercano que sea visible según `isVisible` (hacia él se pliega / desde él se despliega). */
function anchorOf(id: string, parents: Map<string, string>, isVisible: (id: string) => boolean): string | undefined {
  const seen = new Set<string>([id])
  for (let p = parents.get(id); p && !seen.has(p); p = parents.get(p)) {
    if (isVisible(p)) return p
    seen.add(p)
  }
  return undefined
}

function applyChanges(changes: Map<string, boolean>) {
  useMindMapStore.setState((s) => {
    for (const n of s.nodes) {
      const c = changes.get(n.id)
      if (c !== undefined && !!n.data.collapsed !== c) n.data.collapsed = c
    }
    syncCollapse(s.nodes, s.edges)
  })
}

let pending: { timer: ReturnType<typeof setTimeout>; changes: Map<string, boolean>; cleanup: (stillHidden: Set<string>) => void } | null = null

/**
 * Aplica cambios de plegado (id → plegado sí/no) con animación. No guarda historial: lo hace
 * quien llama. Si llega otro cambio mientras se anima un plegado, el anterior se aplica ya.
 */
export function setCollapsedAnimated(changes: Map<string, boolean>) {
  // Llega otro cambio a mitad de un plegado: el anterior se aplica ya. Sus animaciones de salida
  // se limpian más abajo, cuando se sabe qué vuelve a verse.
  const prev = pending
  if (prev) {
    clearTimeout(prev.timer)
    applyChanges(prev.changes)
    pending = null
  }
  const { nodes, edges } = useMindMapStore.getState()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const wasHidden = new Set(nodes.filter((n) => n.hidden).map((n) => n.id))
  const willHide = hiddenAfter(nodes, edges, changes)
  prev?.cleanup(willHide)
  const toHide = nodes.filter((n) => !wasHidden.has(n.id) && willHide.has(n.id)).map((n) => n.id)
  const toShow = nodes.filter((n) => wasHidden.has(n.id) && !willHide.has(n.id)).map((n) => n.id)

  if (reducedMotion() || (toHide.length === 0 && toShow.length === 0)) {
    applyChanges(changes)
    return
  }
  const parents = parentMap(nodes, edges)
  // Cada nodo que entra o sale se pliega hacia (o se despliega desde) el centro de su antepasado
  // visible, y sus líneas con él: todo se escala alrededor de ESE punto, así la rama entera se
  // recoge como una pieza y las líneas siguen a los nodos en vez de quedarse quietas.
  const anchorCenter = (id: string) => {
    const a = anchorOf(id, parents, (p) => !willHide.has(p) && !wasHidden.has(p))
      ?? anchorOf(id, parents, (p) => !willHide.has(p))
    const an = a ? byId.get(a) : undefined
    return an ? center(an) : null
  }
  const animateBranch = (ids: string[], dir: 'out' | 'in') => {
    const set = new Set(ids)
    const frames = (origin: string) => {
      const small = { transform: `scale(${SMALL})`, transformOrigin: origin, opacity: 0 }
      const mid = { opacity: 0.85, offset: 0.55 }
      const full = { transform: 'scale(1)', transformOrigin: origin, opacity: 1 }
      return dir === 'out' ? [full, mid, small] : [small, { ...mid, offset: 0.45 }, full]
    }
    const opts: KeyframeAnimationOptions =
      dir === 'out'
        ? { duration: OUT_MS, easing: EASE_IN, fill: 'forwards' }
        : { duration: IN_MS, easing: EASE_OUT }
    for (const id of ids) {
      const n = byId.get(id)
      const ac = anchorCenter(id)
      if (!n || !ac) continue
      // El contenedor del nodo está en su esquina: el origen va en coordenadas locales.
      nodeEl(id)?.animate(frames(`${ac.x - n.position.x}px ${ac.y - n.position.y}px`), opts)
    }
    for (const e of edges) {
      if (!set.has(e.target)) continue
      const ac = anchorCenter(e.target)
      if (!ac) continue
      // Las líneas se dibujan en coordenadas del lienzo: el origen va tal cual.
      edgeEl(e.id)?.animate(frames(`${ac.x}px ${ac.y}px`), opts)
    }
  }

  // Lo que reaparece se monta en uno o dos fotogramas (las líneas, después que los nodos). Se
  // oculta de antemano con una regla CSS para que nada se vea a tamaño completo antes de que
  // empiece su animación (si una línea aún no existía al animar, salía entera y quieta).
  const showSet = new Set(toShow)
  const showEdges = edges.filter((e) => showSet.has(e.target)).map((e) => e.id)
  const prehide = (): (() => void) => {
    if (toShow.length === 0) return () => {}
    const st = document.createElement('style')
    st.textContent =
      [
        ...toShow.map((id) => `.mapa-root .react-flow__node[data-id="${CSS.escape(id)}"] .mindmap-node-root`),
        ...showEdges.map((id) => `.mapa-root .react-flow__edge[data-id="${CSS.escape(id)}"]`),
      ].join(',') + '{opacity:0}'
    document.head.appendChild(st)
    return () => st.remove()
  }

  const showIn = (unhide: () => void) => {
    if (toShow.length === 0) return
    let tries = 0
    const run = () => {
      const missing = toShow.some((id) => !nodeEl(id)) || showEdges.some((id) => !edgeEl(id))
      if (missing && tries++ < 20) {
        setTimeout(run, 16)
        return
      }
      animateBranch(toShow, 'in')
      unhide()
    }
    setTimeout(run, 0)
  }

  if (toHide.length === 0) {
    const unhide = prehide()
    applyChanges(changes)
    showIn(unhide)
    return
  }

  animateBranch(toHide, 'out')
  // Las salidas llevan fill (se quedan en opacity 0 hasta desmontarse). Si otro cambio vuelve a
  // mostrar alguno de estos nodos antes de que se desmonte, hay que quitársela; a los que siguen
  // ocultos no (se verían un fotograma antes de desaparecer).
  const hideSet = new Set(toHide)
  const hiddenEdges = edges.filter((e) => hideSet.has(e.target)).map((e) => [e.id, e.target] as const)
  const cleanup = (stillHidden: Set<string>) => {
    for (const id of toHide) if (!stillHidden.has(id)) nodeEl(id)?.getAnimations().forEach((a) => a.cancel())
    for (const [eid, target] of hiddenEdges) if (!stillHidden.has(target)) edgeEl(eid)?.getAnimations().forEach((a) => a.cancel())
  }
  pending = {
    changes,
    cleanup,
    timer: setTimeout(() => {
      pending = null
      const unhide = prehide()
      applyChanges(changes)
      showIn(unhide)
    }, OUT_MS),
  }
}
