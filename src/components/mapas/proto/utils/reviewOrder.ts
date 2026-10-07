import { childrenMap, parentMap } from '@/components/mapas/proto/utils/tree'

// Orden de la revisión guiada (N / Mayús+N). Funciones puras, sin stores: se prueban en Node.

type OrderNode = { id: string; position: { x: number; y: number }; data: { parentId?: string } }
type OrderEdge = { source: string; target: string }

/**
 * Orden de lectura: cada árbol en profundidad; los hijos de arriba abajo. En la raíz (mapa en
 * abanico) primero el lado derecho y luego el izquierdo, cada uno de arriba abajo.
 */
export function readingOrder(nodes: OrderNode[], edges: OrderEdge[]): string[] {
  const parents = parentMap(nodes, edges)
  const children = childrenMap(parents)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: string[] = []
  const seen = new Set<string>()
  const visit = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
    const me = byId.get(id)
    const kids = (children.get(id) ?? []).map((k) => byId.get(k)).filter((k): k is OrderNode => !!k)
    const isRoot = !parents.has(id)
    kids.sort((a, b) => {
      if (isRoot && me) {
        const sa = a.position.x < me.position.x ? 1 : 0
        const sb = b.position.x < me.position.x ? 1 : 0
        if (sa !== sb) return sa - sb
      }
      return a.position.y - b.position.y || a.position.x - b.position.x
    })
    for (const k of kids) visit(k.id)
  }
  // Raíces de arriba abajo (un mapa puede tener nodos sueltos).
  const roots = nodes.filter((n) => !parents.has(n.id)).sort((a, b) => a.position.y - b.position.y)
  for (const r of roots) visit(r.id)
  for (const n of nodes) visit(n.id) // ciclos: lo que no cuelga de ninguna raíz
  return out
}

/** El siguiente (dir 1) o anterior (dir −1) pendiente después de `fromId`, dando la vuelta. */
export function nextPending(
  order: string[],
  isPending: (id: string) => boolean,
  fromId: string | null,
  dir: 1 | -1,
): string | null {
  const n = order.length
  if (n === 0) return null
  const start = fromId ? order.indexOf(fromId) : -1
  for (let k = 1; k <= n; k++) {
    // Sin punto de partida, N empieza por el primero y Mayús+N por el último.
    const i = start === -1 ? (dir === 1 ? k - 1 : n - k) : (((start + dir * k) % n) + n) % n
    if (isPending(order[i])) return order[i]
  }
  return null
}
