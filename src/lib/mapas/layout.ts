import type { MapDoc, MapNode } from '@/lib/mapas/types'

export type NodeBox = { x: number; y: number; w: number; h: number }

const CHAR_W = 7.6
// 18px de relleno por lado + 2px de borde por lado (el nodo es border-box).
const PAD_X = 40
const LINE_H = 20
const PAD_Y = 22
const MIN_W = 110
const MAX_W = 270
const MIN_H = 46
const GAP_X = 72
const GAP_Y = 14

export type LayoutOptions = {
  gapX?: number
  gapY?: number
  /** Tamaño real de un nodo (medido por el navegador); si no hay, se estima por el texto. */
  sizeOf?: (id: string) => { w: number; h: number } | undefined
}

/** Mide el ancho en px de una línea de texto (raíz = negrita). */
export type TextMeasurer = (line: string, bold: boolean) => number

let measurer: TextMeasurer | null = null

/**
 * El editor registra aquí una medición real (canvas con la tipografía de la
 * web). Sin ella —en Node, en los tests— se usa una estimación por caracteres.
 * El layout sigue siendo una función pura del documento: no lee el DOM.
 */
export function setTextMeasurer(fn: TextMeasurer | null) {
  measurer = fn
}

const EPS = 1e-6

function rowsFor(line: string, maxW: number, m: TextMeasurer, bold: boolean): number {
  if (line === '') return 1
  let rows = 1
  let cur = 0
  const space = m(' ', bold)
  for (const word of line.split(' ')) {
    const ww = m(word, bold)
    if (ww > maxW) {
      // Palabra más ancha que la caja: el navegador la parte (break-words).
      const pieces = Math.ceil(ww / maxW)
      rows += cur > 0 ? pieces : pieces - 1
      cur = ww - (pieces - 1) * maxW
    } else if (cur === 0) {
      cur = ww
    } else if (cur + space + ww <= maxW + EPS) {
      cur += space + ww
    } else {
      rows += 1
      cur = ww
    }
  }
  return rows
}

/** Tamaño de la caja para un texto: ancho ajustado al contenido (con tope) y alto por líneas. */
export function estimateSize(text: string, isRoot = false): { w: number; h: number } {
  const lines = (text || ' ').split('\n')
  const m: TextMeasurer =
    measurer ?? ((line, bold) => line.length * (bold ? CHAR_W + 1 : CHAR_W))
  const natural = Math.max(...lines.map((l) => m(l, isRoot)), 1)
  const w = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(natural + PAD_X + 2)))
  const maxTextW = w - PAD_X
  const rows = lines.reduce((acc, l) => acc + rowsFor(l, maxTextW, m, isRoot), 0)
  return { w, h: Math.max(MIN_H, rows * LINE_H + PAD_Y) }
}

/**
 * Árbol horizontal (raíz a la izquierda). Devuelve la caja de cada nodo VISIBLE:
 * los descendientes de un nodo plegado no aparecen.
 */
export function computeLayout(doc: MapDoc, opts: LayoutOptions = {}): Map<string, NodeBox> {
  const gapX = opts.gapX ?? GAP_X
  const gapY = opts.gapY ?? GAP_Y
  const kids = new Map<string | null, MapNode[]>()
  for (const n of doc.nodes) {
    const list = kids.get(n.parentId) ?? []
    list.push(n)
    kids.set(n.parentId, list)
  }
  const out = new Map<string, NodeBox>()
  const root = (kids.get(null) ?? [])[0]
  if (!root) return out

  const sizes = new Map<string, { w: number; h: number }>()
  const span = new Map<string, number>()
  const visibleKids = (n: MapNode) => (n.collapsed ? [] : kids.get(n.id) ?? [])
  const childrenSpan = (n: MapNode) =>
    visibleKids(n).reduce((acc, c, i) => acc + (span.get(c.id) as number) + (i > 0 ? gapY : 0), 0)

  const measure = (n: MapNode) => {
    const size = opts.sizeOf?.(n.id) ?? estimateSize(n.text, n.parentId === null)
    sizes.set(n.id, size)
    visibleKids(n).forEach(measure)
    span.set(n.id, Math.max(size.h, childrenSpan(n)))
  }
  measure(root)

  const place = (n: MapNode, x: number, top: number) => {
    const size = sizes.get(n.id) as { w: number; h: number }
    const s = span.get(n.id) as number
    out.set(n.id, { x, y: top + (s - size.h) / 2, w: size.w, h: size.h })
    let cursor = top + (s - childrenSpan(n)) / 2
    for (const c of visibleKids(n)) {
      place(c, x + size.w + gapX, cursor)
      cursor += (span.get(c.id) as number) + gapY
    }
  }
  place(root, 0, 0)
  return out
}
