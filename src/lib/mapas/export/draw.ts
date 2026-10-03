import { LINE_HEIGHT, wrapParagraphs, type FontSpec, type Measure } from '@/lib/mapas/export/layout'
import { FOOTER_H, MARGIN, type Page } from '@/lib/mapas/export/pages'
import { intersects, pathBounds, type PathCmd, type Rect, type SceneNode, type SceneShape } from '@/lib/mapas/export/scene'

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
    drawNode(p, n, tx, ty, s)
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
