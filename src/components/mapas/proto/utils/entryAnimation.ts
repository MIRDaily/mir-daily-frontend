import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { parentMap } from '@/components/mapas/proto/utils/tree'
import { reducedMotion } from '@/components/mapas/proto/utils/positionTween'
import { delaysEntrada } from '@/lib/mapas/entrada'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'

// Entrada de un mapa recién generado (o importado): crece desde la raíz. La raíz aparece con un
// pequeño rebote y cada nivel brota del centro de su padre —nodo y línea a la vez, como al
// desplegar una rama (foldAnimation)— en oleadas por profundidad. Web Animations API sobre el
// contenedor de cada nodo y el <g> de cada línea: no toca posiciones ni la store, y al terminar
// no queda nada aplicado.

const DUR_MS = 460
const RAIZ_MS = 520
const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)'
const PEQUENO = 0.12

const nodeEl = (id: string) =>
  document.querySelector<HTMLElement>(`.mapa-root .react-flow__node[data-id="${CSS.escape(id)}"] .mindmap-node-root`)
const edgeEl = (id: string) => document.querySelector<SVGGElement>(`.mapa-root .react-flow__edge[data-id="${CSS.escape(id)}"]`)

const centro = (n: MindMapNode) => ({
  x: n.position.x + (n.measured?.width ?? 160) / 2,
  y: n.position.y + (n.measured?.height ?? 50) / 2,
})

/** Lanza la animación de entrada de lo que se ve. Devuelve cuánto dura (ms), o 0 si no anima. */
export function animarEntrada(): number {
  if (reducedMotion()) return 0
  const { nodes, edges } = useMindMapStore.getState()
  const visibles = nodes.filter((n) => !n.hidden)
  if (visibles.length === 0) return 0
  const padres = parentMap(nodes, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const retardo = delaysEntrada(
    visibles.map((n) => ({ id: n.id, padre: padres.get(n.id) ?? null, y: n.position.y })),
  )

  let fin = 0
  for (const n of visibles) {
    const d = retardo.get(n.id) ?? 0
    const p = padres.get(n.id)
    const padre = p ? byId.get(p) : undefined
    const el = nodeEl(n.id)
    if (!el) continue
    if (!padre || padre.hidden) {
      // La raíz (o un nodo suelto): aparece en su sitio con un rebote corto.
      el.animate(
        [
          { transform: 'scale(0.6)', opacity: 0 },
          { transform: 'scale(1.04)', opacity: 1, offset: 0.7 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: RAIZ_MS, delay: d, easing: EASE_OUT, fill: 'backwards' },
      )
      fin = Math.max(fin, d + RAIZ_MS)
      continue
    }
    // Brota del centro del padre: el contenedor del nodo está en su esquina, el origen va en
    // coordenadas locales.
    const c = centro(padre)
    const origen = `${c.x - n.position.x}px ${c.y - n.position.y}px`
    el.animate(
      [
        { transform: `scale(${PEQUENO})`, transformOrigin: origen, opacity: 0 },
        { opacity: 1, offset: 0.45 },
        { transform: 'scale(1)', transformOrigin: origen, opacity: 1 },
      ],
      { duration: DUR_MS, delay: d, easing: EASE_OUT, fill: 'backwards' },
    )
    fin = Math.max(fin, d + DUR_MS)
  }
  // Cada línea, con su nodo hijo y desde el mismo punto (las líneas van en coordenadas del lienzo).
  for (const e of edges) {
    const hijo = byId.get(e.target)
    const padre = byId.get(e.source)
    if (!hijo || !padre || hijo.hidden || padre.hidden) continue
    const el = edgeEl(e.id)
    if (!el) continue
    const c = centro(padre)
    const origen = `${c.x}px ${c.y}px`
    el.animate(
      [
        { transform: `scale(${PEQUENO})`, transformOrigin: origen, opacity: 0 },
        { opacity: 1, offset: 0.45 },
        { transform: 'scale(1)', transformOrigin: origen, opacity: 1 },
      ],
      { duration: DUR_MS, delay: retardo.get(hijo.id) ?? 0, easing: EASE_OUT, fill: 'backwards' },
    )
  }
  return fin
}
