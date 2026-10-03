import { toGraphDoc, type GraphNode } from '@/lib/mapas/graph'

// Lo que la lista de mapas necesita de un documento sin abrir el editor: una miniatura dibujable,
// el texto de sus nodos (para buscar) y su tamaño. Se calcula en el navegador a partir del propio
// documento, así que la miniatura nunca se queda desfasada y no hay nada que guardar aparte.

export type ThumbNode = { x: number; y: number; w: number; h: number; fill: string; stroke: string; r: number }
export type ThumbEdge = { d: string; color: string }
export type Thumb = { w: number; h: number; nodes: ThumbNode[]; edges: ThumbEdge[] }

/** Texto sin etiquetas HTML, en minúsculas y sin tildes: para comparar al buscar. */
export function searchable(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tamaño aproximado de un nodo (no se guarda: lo mide el navegador al dibujarlo). */
function sizeOf(n: GraphNode): { w: number; h: number } {
  if (n.width && n.height) return { w: n.width, h: n.height }
  const text = n.data.label.replace(/<[^>]*>/g, '')
  const fs = n.data.style.fontSize || 14
  const chars = Math.max(text.length, 4)
  const w = Math.min(Math.max(chars * fs * 0.58 + 36, 100), 280)
  const lines = Math.max(1, Math.ceil((chars * fs * 0.58) / (w - 36)))
  return { w, h: lines * fs * 1.5 + 20 }
}

const WHITE = '#FFFFFF'

export function summarizeDoc(raw: unknown): { thumb: Thumb | null; text: string } {
  let doc
  try {
    doc = toGraphDoc(raw).doc
  } catch {
    return { thumb: null, text: '' }
  }
  const items = doc.nodes.filter((n) => n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y))
  if (items.length === 0) return { thumb: null, text: '' }

  const boxes = new Map<string, { x: number; y: number; w: number; h: number }>()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of items) {
    const { w, h } = sizeOf(n)
    const b = { x: n.position.x, y: n.position.y, w, h }
    boxes.set(n.id, b)
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + w)
    maxY = Math.max(maxY, b.y + h)
  }
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)

  const nodes: ThumbNode[] = items.map((n) => {
    const b = boxes.get(n.id)!
    const st = n.data.style
    return {
      x: b.x - minX,
      y: b.y - minY,
      w: b.w,
      h: b.h,
      fill: st.color || WHITE,
      stroke: st.borderWidth > 0 ? st.borderColor : st.color || WHITE,
      r: st.shape === 'pill' || st.shape === 'circle' ? b.h / 2 : 8,
    }
  })

  const edges: ThumbEdge[] = []
  for (const e of doc.edges) {
    const a = boxes.get(e.source)
    const b = boxes.get(e.target)
    if (!a || !b) continue
    // De un lado al más cercano del otro, con la curva suave del editor.
    const leftToRight = b.x >= a.x
    const x1 = (leftToRight ? a.x + a.w : a.x) - minX
    const y1 = a.y + a.h / 2 - minY
    const x2 = (leftToRight ? b.x : b.x + b.w) - minX
    const y2 = b.y + b.h / 2 - minY
    const mx = (x1 + x2) / 2
    edges.push({ d: `M${x1.toFixed(0)} ${y1.toFixed(0)}C${mx.toFixed(0)} ${y1.toFixed(0)} ${mx.toFixed(0)} ${y2.toFixed(0)} ${x2.toFixed(0)} ${y2.toFixed(0)}`, color: e.data.color || '#7D8A96' })
  }

  return { thumb: { w: width, h: height, nodes, edges }, text: searchable(items.map((n) => n.data.label).join(' ')) }
}
