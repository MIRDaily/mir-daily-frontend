import type { MapDoc, MapNode } from '@/lib/mapas/types'
import { tableGeometry, type MapTable } from '@/lib/mapas/table'

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
  /**
   * Margen EXTRA entre hermanos según la profundidad de su padre: `[0]` separa los
   * hijos de la raíz (los bloques), `[1]` los hijos de estos, etc. Lo que no esté
   * en la lista no suma nada. Con él, los bloques de un mapa grande no se pegan.
   */
  depthGaps?: number[]
  /**
   * Si la raíz tiene al menos tantos hijos visibles, se reparten a ambos lados
   * (mapa en abanico) en vez de todos a la derecha. Sin definir: siempre a la derecha.
   */
  twoSidedFrom?: number
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

/** Tamaño de un nodo tabla (misma geometría que al pintarla), con la medición registrada si la hay. */
export function estimateTableSize(table: MapTable, fontSize = 14): { w: number; h: number } {
  const m = measurer
  const g = tableGeometry(table, m ? (text, bold, size) => (m(text, bold) * size) / 14 : undefined, fontSize)
  return { w: Math.ceil(g.width), h: Math.ceil(g.height) }
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
  const depthOf = new Map<string, number>()
  const visibleKids = (n: MapNode) => (n.collapsed ? [] : kids.get(n.id) ?? [])
  // Hueco entre hermanos: el base más el extra de la profundidad de su padre.
  const gapBetween = (parent: MapNode) => gapY + (opts.depthGaps?.[depthOf.get(parent.id) ?? 0] ?? 0)
  const childrenSpan = (n: MapNode) => {
    const gap = gapBetween(n)
    return visibleKids(n).reduce((acc, c, i) => acc + (span.get(c.id) as number) + (i > 0 ? gap : 0), 0)
  }

  const measure = (n: MapNode, depth: number) => {
    depthOf.set(n.id, depth)
    const size = opts.sizeOf?.(n.id) ?? (n.table ? estimateTableSize(n.table) : estimateSize(n.text, n.parentId === null))
    sizes.set(n.id, size)
    visibleKids(n).forEach((c) => measure(c, depth + 1))
    span.set(n.id, Math.max(size.h, childrenSpan(n)))
  }
  measure(root, 0)

  // `dir` 1 = hacia la derecha, -1 = hacia la izquierda. `edge` es el borde del
  // lado del padre: la caja arranca ahí (derecha) o termina ahí (izquierda).
  const place = (n: MapNode, edge: number, top: number, dir: 1 | -1) => {
    const size = sizes.get(n.id) as { w: number; h: number }
    const s = span.get(n.id) as number
    const x = dir === 1 ? edge : edge - size.w
    out.set(n.id, { x, y: top + (s - size.h) / 2, w: size.w, h: size.h })
    const gap = gapBetween(n)
    let cursor = top + (s - childrenSpan(n)) / 2
    for (const c of visibleKids(n)) {
      place(c, dir === 1 ? x + size.w + gapX : x - gapX, cursor, dir)
      cursor += (span.get(c.id) as number) + gap
    }
  }

  const rootKids = visibleKids(root)
  if (opts.twoSidedFrom && rootKids.length >= opts.twoSidedFrom) {
    // Mapa grande: los bloques se reparten a ambos lados de la raíz, en orden de
    // lectura (los primeros a la derecha, el resto a la izquierda), con la
    // división que deja las dos mitades más parecidas en alto. Así no es un solo
    // "corchete" larguísimo.
    const gap = gapBetween(root)
    const total = rootKids.reduce((acc, c, i) => acc + (span.get(c.id) as number) + (i > 0 ? gap : 0), 0)
    let acumulado = 0
    let corte = 1
    let mejor = Infinity
    for (let k = 1; k < rootKids.length; k++) {
      acumulado += (span.get(rootKids[k - 1].id) as number) + (k > 1 ? gap : 0)
      const resto = total - acumulado - gap
      const diff = Math.abs(acumulado - resto)
      if (diff < mejor) {
        mejor = diff
        corte = k
      }
    }
    const lados: [MapNode[], 1 | -1][] = [
      [rootKids.slice(0, corte), 1],
      [rootKids.slice(corte), -1],
    ]
    const altos = lados.map(([lista]) => lista.reduce((acc, c, i) => acc + (span.get(c.id) as number) + (i > 0 ? gap : 0), 0))
    const alto = Math.max(...altos, sizes.get(root.id)!.h)
    const rootSize = sizes.get(root.id) as { w: number; h: number }
    out.set(root.id, { x: 0, y: (alto - rootSize.h) / 2, w: rootSize.w, h: rootSize.h })
    lados.forEach(([lista, dir], i) => {
      let cursor = (alto - altos[i]) / 2
      for (const c of lista) {
        place(c, dir === 1 ? rootSize.w + gapX : -gapX, cursor, dir)
        cursor += (span.get(c.id) as number) + gap
      }
    })
    return out
  }

  place(root, 0, 0, 1)
  return out
}
