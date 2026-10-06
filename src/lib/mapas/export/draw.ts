import { LINE_HEIGHT, wrapParagraphs, type FontSpec, type Measure } from '@/lib/mapas/export/layout'
import { FOOTER_H, MARGIN, type Page } from '@/lib/mapas/export/pages'
import { intersects, pathBounds, type PathCmd, type Rect, type SceneNode, type SceneShape } from '@/lib/mapas/export/scene'
import { parseColor } from '@/lib/mapas/export/color'
import { tableGeometry, TABLE_GEOMETRY as TG } from '@/lib/mapas/table'

// Dibujo de una hoja. No sabe de PDF ni de canvas: habla con un `Painter` en coordenadas de la
// hoja, así que las dos salidas comparten forma, colores, líneas y reparto del texto.

export interface Painter {
  /** Anchura de un texto con esa fuente (en las mismas unidades que `font.size`). */
  measure: Measure
  beginPage(w: number, h: number, bg: string | null): void
  save(): void
  restore(): void
  clipRect(r: Rect): void
  shape(kind: SceneShape, r: Rect, fill: string | null, stroke: string | null, strokeWidth: number, radius: number): void
  path(cmds: PathCmd[], color: string, width: number, dash: number[] | null): void
  text(
    str: string,
    x: number,
    baselineY: number,
    font: FontSpec & { color: string },
    deco?: { underline?: boolean; strike?: boolean; width: number },
  ): void
}

export type DrawOptions = {
  background: string | null
  mapTitle: string
  withTitle: boolean
  /** Sin cabecera ni pie (imagen PNG: solo el mapa). */
  bare?: boolean
  /** «12 oct 2026» */
  dateLabel: string
  pageNo: number
  pageCount: number
  /** Gris de los rótulos de cabecera y pie. */
  ink: string
  muted: string
}

const PAD_X = 16
const PAD_Y = 10
const DIAMOND_PAD_X = 52
const DIAMOND_PAD_Y = 18
const ASCENT = 0.8

function drawNode(p: Painter, n: SceneNode, tx: (x: number) => number, ty: (y: number) => number, s: number) {
  const bw = n.strokeWidth
  const half = bw / 2
  const box: Rect = { x: tx(n.x) + half * s, y: ty(n.y) + half * s, w: (n.w - bw) * s, h: (n.h - bw) * s }
  p.shape(n.shape, box, n.fill, bw > 0 ? n.stroke : null, bw * s, n.shape === 'pill' ? box.h / 2 : 12 * s)

  const padX = (n.shape === 'diamond' ? DIAMOND_PAD_X : PAD_X) + bw
  const padY = (n.shape === 'diamond' ? DIAMOND_PAD_Y : PAD_Y) + bw
  const innerW = Math.max(n.w - 2 * padX, 8)
  const innerH = Math.max(n.h - 2 * padY, 8)
  let size = n.fontSize
  let lines = wrapParagraphs(n.paragraphs, innerW, { family: n.fontFamily, size }, p.measure)
  // Si con la letra de pantalla no cabe (otra tipografía en la salida), se encoge un poco.
  for (let tries = 0; tries < 6 && lines.length * size * LINE_HEIGHT > innerH && size > n.fontSize * 0.6; tries++) {
    size *= 0.92
    lines = wrapParagraphs(n.paragraphs, innerW, { family: n.fontFamily, size }, p.measure)
  }
  const lineH = size * LINE_HEIGHT
  const top = n.y + (n.h - lines.length * lineH) / 2
  lines.forEach((line, i) => {
    let x =
      n.align === 'left' ? n.x + padX : n.align === 'right' ? n.x + n.w - padX - line.width : n.x + (n.w - line.width) / 2
    const baseline = top + i * lineH + (lineH - size) / 2 + size * ASCENT
    for (const run of line.runs) {
      if (!run.text) continue
      p.text(
        run.text,
        tx(x),
        ty(baseline),
        { family: n.fontFamily, size: size * s, bold: run.bold, italic: run.italic, color: n.textColor },
        run.underline || run.strike ? { underline: run.underline, strike: run.strike, width: run.width * s } : undefined,
      )
      x += run.width
    }
  })
}

/** Mezcla de dos colores (t = peso de `a`), en hexadecimal: el PDF no sabe de transparencias. */
function mix(a: string, b: string, t: number): string {
  const A = parseColor(a)
  const B = parseColor(b, { r: 255, g: 255, b: 255, a: 1 })
  const m = (x: number, y: number) => Math.round(x * t + y * (1 - t)).toString(16).padStart(2, '0')
  return `#${m(A.r, B.r)}${m(A.g, B.g)}${m(A.b, B.b)}`
}

function readableOn(bg: string): string {
  const c = parseColor(bg)
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.62 ? '#2A2420' : '#FFFFFF'
}

/**
 * Nodo tabla: la misma geometría que en pantalla (`tableGeometry`, con la medida del pintor),
 * ajustada a la caja medida del nodo. Franja del título, cabecera tintada, rejilla y el texto de
 * cada celda partido en líneas (y encogido un poco si con otra tipografía no cabe).
 */
function drawTable(p: Painter, n: SceneNode, tx: (x: number) => number, ty: (y: number) => number, s: number) {
  const t = n.table!
  const bw = Math.max(1, n.strokeWidth)
  const g = tableGeometry(t, (text, bold, size) => p.measure(text, { family: n.fontFamily, size, bold }), n.fontSize, bw)
  const kx = n.w / g.width
  const ky = n.h / g.height
  const accent = n.stroke
  const radius = 10 * s
  const box: Rect = { x: tx(n.x), y: ty(n.y), w: n.w * s, h: n.h * s }
  const innerX = n.x + bw
  const innerW = n.w - 2 * bw
  const titleH = g.titleH * ky
  const headerY = n.y + bw + titleH
  const bottom = n.y + n.h - bw
  const line = (x1: number, y1: number, x2: number, y2: number, color: string) =>
    p.path([['M', tx(x1), ty(y1)], ['L', tx(x2), ty(y2)]], color, s, null)

  p.shape('rectangle', box, n.fill, null, 0, radius)
  if (t.solid) {
    // Franja del título: esquinas de arriba redondeadas y de abajo rectas.
    const bandH = bw + titleH
    p.shape('rectangle', { x: box.x, y: box.y, w: box.w, h: bandH * s }, accent, null, 0, radius)
    p.shape('rectangle', { x: box.x, y: ty(n.y + bandH / 2), w: box.w, h: (bandH / 2) * s }, accent, null, 0, 0)
    p.shape('rectangle', { x: tx(innerX), y: ty(headerY), w: innerW * s, h: g.rowH[0] * ky * s }, mix(accent, n.fill, 0.14), null, 0, 0)
  }

  const text = (str: string, x: number, top: number, w: number, h: number, padX: number, padY: number, bold: boolean, size: number, color: string) => {
    const paragraphs = (str || '').split('\n').map((l) => [{ text: l, bold: bold || undefined }])
    let sz = size
    let lines = wrapParagraphs(paragraphs, Math.max(w - 2 * padX, 4), { family: n.fontFamily, size: sz }, p.measure)
    for (let tries = 0; tries < 6 && lines.length * sz * TG.lineHeight > h - 2 * padY + 0.5 && sz > size * 0.6; tries++) {
      sz *= 0.92
      lines = wrapParagraphs(paragraphs, Math.max(w - 2 * padX, 4), { family: n.fontFamily, size: sz }, p.measure)
    }
    const lineH = sz * TG.lineHeight
    lines.forEach((l, i) => {
      let cx = x + padX
      const baseline = top + padY + i * lineH + (lineH - sz) / 2 + sz * ASCENT
      for (const run of l.runs) {
        if (run.text) p.text(run.text, tx(cx), ty(baseline), { family: n.fontFamily, size: sz * s, bold: run.bold, color })
        cx += run.width
      }
    })
  }

  // Título.
  text(t.title, innerX, n.y + bw, innerW, titleH, TG.titlePadX * kx, TG.titlePadY * ky, true, n.fontSize, t.solid ? readableOn(accent) : accent)
  if (!t.solid) line(innerX, headerY, innerX + innerW, headerY, accent)

  // Rejilla y celdas.
  const grid = mix(accent, n.fill, 0.38)
  const xs = [innerX]
  for (const w of g.colW) xs.push(xs[xs.length - 1] + w * kx)
  let y = headerY
  ;[t.columns, ...t.rows].forEach((row, i) => {
    const h = g.rowH[i] * ky
    if (i > 0 || t.solid) line(innerX, y, innerX + innerW, y, grid)
    row.forEach((cell, j) => {
      text(cell, xs[j], y, xs[j + 1] - xs[j], h, TG.padX * kx, TG.padY * ky, i === 0, g.cellSize, n.textColor)
    })
    y += h
  })
  for (let j = 1; j < xs.length - 1; j++) line(xs[j], headerY, xs[j], bottom, grid)

  // El marco, encima de todo.
  p.shape('rectangle', box, null, accent, bw * s, radius)
}

export function drawPage(p: Painter, page: Page, o: DrawOptions) {
  p.beginPage(page.w, page.h, o.background)
  const { region, scale: s, area, section } = page
  const tx = (x: number) => (x - region.x) * s + area.x
  const ty = (y: number) => (y - region.y) * s + area.y

  // Cabecera y pie (en la hoja, fuera del dibujo).
  if (o.withTitle && !o.bare) {
    const head = section.title ? `${o.mapTitle}  ·  ${section.title}` : o.mapTitle
    p.text(head, MARGIN, MARGIN + 12, { family: 'Lexend', size: 12, bold: true, color: o.ink })
  }
  if (!o.bare) {
  const foot = `MIRDaily  ·  ${o.dateLabel}`
  p.text(foot, MARGIN, page.h - MARGIN + 4, { family: 'Lexend', size: 8, color: o.muted })
  const right = page.tile && page.tile.cols * page.tile.rows > 1
    ? `Hoja ${o.pageNo}/${o.pageCount}  ·  columna ${page.tile.col + 1}/${page.tile.cols}, fila ${page.tile.row + 1}/${page.tile.rows}`
    : `Hoja ${o.pageNo}/${o.pageCount}`
  const rw = p.measure(right, { family: 'Lexend', size: 8 })
  p.text(right, page.w - MARGIN - rw, page.h - MARGIN + 4, { family: 'Lexend', size: 8, color: o.muted })
  }
  void FOOTER_H

  p.save()
  if (page.clip) p.clipRect(area)

  // Líneas debajo de los nodos.
  for (const e of section.edges) {
    const b = pathBounds(e.cmds)
    const grown: Rect = { x: b.x - e.width, y: b.y - e.width, w: b.w + 2 * e.width, h: b.h + 2 * e.width }
    if (!intersects(grown, region)) continue
    const cmds: PathCmd[] = e.cmds.map((c) => {
      if (c[0] === 'M' || c[0] === 'L') return [c[0], tx(c[1]), ty(c[2])]
      if (c[0] === 'C') return ['C', tx(c[1]), ty(c[2]), tx(c[3]), ty(c[4]), tx(c[5]), ty(c[6])]
      return ['Q', tx(c[1]), ty(c[2]), tx(c[3]), ty(c[4])]
    })
    p.path(cmds, e.color, e.width * s, e.dash ? e.dash.map((d) => d * s) : null)
  }
  for (const n of section.nodes) {
    if (!intersects(n, region)) continue
    if (n.table) drawTable(p, n, tx, ty, s)
    else drawNode(p, n, tx, ty, s)
  }
  p.restore()

  // Marcas de corte/unión en los mosaicos.
  if (page.tile && page.tile.cols * page.tile.rows > 1) {
    const m = 8
    const a = area
    const mark: PathCmd[][] = [
      [['M', a.x - m, a.y], ['L', a.x, a.y], ['L', a.x, a.y - m]],
      [['M', a.x + a.w + m, a.y], ['L', a.x + a.w, a.y], ['L', a.x + a.w, a.y - m]],
      [['M', a.x - m, a.y + a.h], ['L', a.x, a.y + a.h], ['L', a.x, a.y + a.h + m]],
      [['M', a.x + a.w + m, a.y + a.h], ['L', a.x + a.w, a.y + a.h], ['L', a.x + a.w, a.y + a.h + m]],
    ]
    for (const cmds of mark) p.path(cmds, o.muted, 0.5, null)
  }
}
