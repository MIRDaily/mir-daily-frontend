import { boundsOf, intersects, type Rect, type Section } from '@/lib/mapas/export/scene'

// Reparto del mapa en hojas. Todo en puntos tipográficos (1 pt = 1/72 in; un píxel de pantalla
// equivale a 0,75 pt, así que escala 0,75 = tamaño real al imprimir).

export type PaperId = 'a4' | 'a3' | 'letter'
export type Orientation = 'auto' | 'landscape' | 'portrait'
/** fit: cada parte entera en una hoja · tiles: a tamaño real, repartido en las hojas que haga falta. */
export type Distribution = 'fit' | 'tiles'

/** [ancho, alto] en vertical. */
export const PAPER: Record<PaperId, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  letter: [612, 792],
}

export const PAPER_LABEL: Record<PaperId, string> = { a4: 'A4', a3: 'A3', letter: 'Carta' }

export const MARGIN = 28
export const HEADER_H = 26
export const FOOTER_H = 16
/** Solape entre hojas contiguas del mosaico, para poder pegarlas. */
export const TILE_OVERLAP = 18
/** Un píxel de pantalla en puntos: a esta escala se imprime a tamaño real. */
export const REAL_SIZE = 0.75
/** No se amplía más que esto un mapa pequeño (el texto sería enorme). */
export const MAX_FIT_SCALE = 1.4
export const REGION_PAD = 18

export type Page = {
  section: Section
  /** Trozo del lienzo que se dibuja. */
  region: Rect
  scale: number
  /** Tamaño de la hoja (pt). */
  w: number
  h: number
  /** Zona de la hoja donde va el dibujo (pt). */
  area: Rect
  /** Mosaico: columna/fila de esta hoja, para rotularla. */
  tile?: { col: number; row: number; cols: number; rows: number }
  clip: boolean
}

type Opts = {
  paper: PaperId
  orientation: Orientation
  distribution: Distribution
  withTitle: boolean
}

function sizes(paper: PaperId, landscape: boolean): [number, number] {
  const [w, h] = PAPER[paper]
  return landscape ? [h, w] : [w, h]
}

function areaOf(w: number, h: number, withTitle: boolean): Rect {
  const top = MARGIN + (withTitle ? HEADER_H : 0)
  return { x: MARGIN, y: top, w: w - 2 * MARGIN, h: h - top - MARGIN - FOOTER_H }
}

function planFit(section: Section, o: Opts): Page {
  const b = boundsOf(section.nodes)
  const region: Rect = { x: b.x - REGION_PAD, y: b.y - REGION_PAD, w: b.w + 2 * REGION_PAD, h: b.h + 2 * REGION_PAD }
  const candidates = o.orientation === 'auto' ? [true, false] : [o.orientation === 'landscape']
  let best: { landscape: boolean; scale: number } | null = null
  for (const landscape of candidates) {
    const [w, h] = sizes(o.paper, landscape)
    const a = areaOf(w, h, o.withTitle)
    const scale = Math.min(a.w / region.w, a.h / region.h)
    if (!best || scale > best.scale) best = { landscape, scale }
  }
  const landscape = best!.landscape
  const [w, h] = sizes(o.paper, landscape)
  const area = areaOf(w, h, o.withTitle)
  const scale = Math.min(best!.scale, MAX_FIT_SCALE)
  // Centrado en el área.
  const drawW = region.w * scale
  const drawH = region.h * scale
  const centered: Rect = { x: area.x + (area.w - drawW) / 2, y: area.y + (area.h - drawH) / 2, w: drawW, h: drawH }
  return { section, region, scale, w, h, area: centered, clip: false }
}

function planTiles(section: Section, o: Opts): Page[] {
  const b = boundsOf(section.nodes)
  const full: Rect = { x: b.x - REGION_PAD, y: b.y - REGION_PAD, w: b.w + 2 * REGION_PAD, h: b.h + 2 * REGION_PAD }
  const s = REAL_SIZE
  const candidates = o.orientation === 'auto' ? [true, false] : [o.orientation === 'landscape']
  const grid = (landscape: boolean) => {
    const [w, h] = sizes(o.paper, landscape)
    const a = areaOf(w, h, o.withTitle)
    const cols = Math.max(1, Math.ceil((full.w * s - TILE_OVERLAP) / (a.w - TILE_OVERLAP)))
    const rows = Math.max(1, Math.ceil((full.h * s - TILE_OVERLAP) / (a.h - TILE_OVERLAP)))
    return { landscape, w, h, a, cols, rows }
  }
  const options = candidates.map(grid)
  const g = options.reduce((best, cur) => (cur.cols * cur.rows < best.cols * best.rows ? cur : best))
  const pages: Page[] = []
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      const stepX = g.a.w - TILE_OVERLAP
      const stepY = g.a.h - TILE_OVERLAP
      // Una sola hoja en esa dirección: se centra; si no, cada una arranca en su paso.
      const x0 = g.cols === 1 ? full.x - (g.a.w / s - full.w) / 2 : full.x + (col * stepX) / s
      const y0 = g.rows === 1 ? full.y - (g.a.h / s - full.h) / 2 : full.y + (row * stepY) / s
      const region: Rect = { x: x0, y: y0, w: g.a.w / s, h: g.a.h / s }
      // Una hoja sin nada dentro (mapas altos y estrechos dejan huecos) no se imprime.
      if (g.cols * g.rows > 1 && !section.nodes.some((n) => intersects(n, region))) continue
      pages.push({
        section,
        region,
        scale: s,
        w: g.w,
        h: g.h,
        area: g.a,
        tile: { col, row, cols: g.cols, rows: g.rows },
        clip: g.cols * g.rows > 1,
      })
    }
  }
  return pages
}

export function planPages(sections: Section[], o: Opts): Page[] {
  const pages: Page[] = []
  for (const section of sections) {
    if (section.nodes.length === 0) continue
    if (o.distribution === 'tiles') pages.push(...planTiles(section, o))
    else pages.push(planFit(section, o))
  }
  return pages
}
