import type { Paragraph } from '@/lib/mapas/export/richtext'
import type { MapTable } from '@/lib/mapas/table'

// Escena de exportación: el mapa ya reducido a lo que hace falta para DIBUJARLO (formas, líneas y
// texto) en coordenadas del lienzo. La construyen `collect.ts` (a partir de la store y del DOM) y la
// consumen los pintores (PDF vectorial y PNG), de modo que los dos formatos salen idénticos.

export type SceneShape = 'rectangle' | 'pill' | 'circle' | 'diamond' | 'label'

export type Rect = { x: number; y: number; w: number; h: number }

/** Nodo tabla. `solid`: franja del título y cabecera rellenas (en pantalla); sin relleno al ahorrar tinta. */
export type SceneTable = MapTable & { solid: boolean }

export type SceneNode = Rect & {
  id: string
  parentId: string | null
  shape: SceneShape
  fill: string
  stroke: string
  strokeWidth: number
  textColor: string
  fontFamily: string
  fontSize: number
  align: 'left' | 'center' | 'right'
  paragraphs: Paragraph[]
  table?: SceneTable
}

export type PathCmd =
  | ['M', number, number]
  | ['L', number, number]
  | ['C', number, number, number, number, number, number]
  | ['Q', number, number, number, number]

export type SceneEdge = {
  id: string
  source: string
  target: string
  cmds: PathCmd[]
  color: string
  width: number
  dash: number[] | null
}

export type Section = {
  /** Título de la parte (aparece en la cabecera de sus páginas). */
  title: string
  nodes: SceneNode[]
  edges: SceneEdge[]
}

export function boundsOf(nodes: Rect[]): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, w: 1, h: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }
  return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) }
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Caja que ocupa una ruta (con los puntos de control: sobreestima un poco, vale para descartar). */
export function pathBounds(cmds: PathCmd[]): Rect {
  const xs: number[] = []
  const ys: number[] = []
  for (const c of cmds) {
    for (let i = 1; i < c.length; i += 2) {
      xs.push(c[i] as number)
      ys.push(c[i + 1] as number)
    }
  }
  if (xs.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/**
 * Lee el atributo `d` de una ruta SVG (las líneas del editor usan M, L, C y Q, a veces en relativo)
 * y lo devuelve en absoluto. Lo desconocido se ignora.
 */
export function parsePath(d: string): PathCmd[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
  const out: PathCmd[] = []
  let i = 0
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let cmd = ''
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? cx : 0
    const oy = rel ? cy : 0
    switch (cmd.toUpperCase()) {
      case 'M': {
        const x = num() + ox
        const y = num() + oy
        out.push(['M', x, y])
        cx = sx = x
        cy = sy = y
        cmd = rel ? 'l' : 'L' // los pares siguientes de una M son líneas
        break
      }
      case 'L': {
        const x = num() + ox
        const y = num() + oy
        out.push(['L', x, y])
        cx = x
        cy = y
        break
      }
      case 'H': {
        const x = num() + ox
        out.push(['L', x, cy])
        cx = x
        break
      }
      case 'V': {
        const y = num() + oy
        out.push(['L', cx, y])
        cy = y
        break
      }
      case 'C': {
        const x1 = num() + ox
        const y1 = num() + oy
        const x2 = num() + ox
        const y2 = num() + oy
        const x = num() + ox
        const y = num() + oy
        out.push(['C', x1, y1, x2, y2, x, y])
        cx = x
        cy = y
        break
      }
      case 'Q': {
        const x1 = num() + ox
        const y1 = num() + oy
        const x = num() + ox
        const y = num() + oy
        out.push(['Q', x1, y1, x, y])
        cx = x
        cy = y
        break
      }
      case 'Z':
        out.push(['L', sx, sy])
        cx = sx
        cy = sy
        break
      default:
        i++ // comando no soportado: se salta
    }
  }
  return out
}
