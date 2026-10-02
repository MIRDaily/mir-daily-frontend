import type { MindMapNode } from '@/components/mapas/proto/types/node.types'

// Obstáculos de cada línea sin que cada línea escuche TODOS los nodos. Antes cada arista usaba
// `useNodes()`: mover un solo nodo re-renderizaba las ~100 líneas y cada una recorría los ~100
// nodos. Ahora hay una rejilla espacial por versión de la lista de nodos (se construye una vez,
// la comparten todas) y cada línea pide solo lo que cae cerca de ella como una clave de texto:
// si su entorno no cambia, la clave es la misma y la línea no se vuelve a dibujar.

/** Margen de esquiva alrededor de cada nodo (ver AnimatedEdge). */
export const NODE_PAD = 6
const CELL = 400

type Box = { id: string; x: number; y: number; w: number; h: number }
type Grid = Map<string, Box[]>

const grids = new WeakMap<MindMapNode[], Grid>()

function gridOf(nodes: MindMapNode[]): Grid {
  const cached = grids.get(nodes)
  if (cached) return cached
  const grid: Grid = new Map()
  for (const n of nodes) {
    if (n.hidden) continue
    const w = (n.measured?.width ?? 160) + NODE_PAD * 2
    const h = (n.measured?.height ?? 50) + NODE_PAD * 2
    const box = { id: n.id, x: n.position.x - NODE_PAD, y: n.position.y - NODE_PAD, w, h }
    for (let cx = Math.floor(box.x / CELL); cx <= Math.floor((box.x + w) / CELL); cx++) {
      for (let cy = Math.floor(box.y / CELL); cy <= Math.floor((box.y + h) / CELL); cy++) {
        const k = `${cx},${cy}`
        const list = grid.get(k)
        if (list) list.push(box)
        else grid.set(k, [box])
      }
    }
  }
  grids.set(nodes, grid)
  return grid
}

/**
 * Nodos que tocan la caja dada (sin los extremos de la línea), como texto estable: ids ordenados
 * y coordenadas redondeadas. Sirve de selector de la store: misma clave = no re-render.
 */
export function obstacleKey(
  nodes: MindMapNode[],
  minX: number, minY: number, maxX: number, maxY: number,
  excludeA: string, excludeB: string,
): string {
  const grid = gridOf(nodes)
  const seen = new Set<string>()
  const found: Box[] = []
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
    for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
      for (const b of grid.get(`${cx},${cy}`) ?? []) {
        if (seen.has(b.id) || b.id === excludeA || b.id === excludeB) continue
        seen.add(b.id)
        if (b.x > maxX || b.x + b.w < minX || b.y > maxY || b.y + b.h < minY) continue
        found.push(b)
      }
    }
  }
  if (found.length === 0) return ''
  found.sort((a, b) => (a.id < b.id ? -1 : 1))
  return found.map((b) => `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)}`).join(';')
}

export type ObstacleRect = { x: number; y: number; w: number; h: number; cx: number; cy: number }

export function parseObstacles(key: string): ObstacleRect[] {
  if (!key) return []
  return key.split(';').map((part) => {
    const [x, y, w, h] = part.split(',').map(Number)
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
  })
}
