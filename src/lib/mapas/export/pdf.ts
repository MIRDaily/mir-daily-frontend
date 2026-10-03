import jsPDF from 'jspdf'
import { parseColor } from '@/lib/mapas/export/color'
import { drawPage, type DrawOptions, type Painter } from '@/lib/mapas/export/draw'
import type { FontSpec } from '@/lib/mapas/export/layout'
import type { Page } from '@/lib/mapas/export/pages'
import type { PathCmd, Rect, SceneShape } from '@/lib/mapas/export/scene'
import { MAP_FONTS } from '@/lib/mapas/fonts'

// PDF VECTORIAL: formas, líneas y texto se escriben como instrucciones de dibujo, no como una foto.
// Se puede ampliar cuanto se quiera (o imprimir en A3) sin que se pixele, y el texto es seleccionable.
//
// Tipografías: Lexend (la del editor) va incrustada desde /fonts/lexend. Las demás fuentes del editor
// son variables en woff2 y jsPDF solo admite TTF, así que se sustituyen por la familia más parecida
// del PDF (serif → Times, mono → Courier, resto → Lexend).

const LEXEND = {
  normal: '/fonts/lexend/Lexend-Regular.ttf',
  bold: '/fonts/lexend/Lexend-Bold.ttf',
} as const

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar la fuente ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

type Face = { name: string; style: 'normal' | 'bold' | 'italic' | 'bolditalic' }

function faceFor(font: FontSpec): Face {
  const kind = MAP_FONTS.find((f) => f.id === font.family)?.kind
  const bold = !!font.bold
  const italic = !!font.italic
  if (kind === 'serif') return { name: 'times', style: bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal' }
  if (kind === 'mono') return { name: 'courier', style: bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal' }
  // Lexend no tiene cursiva incrustada: esa cursiva sale en Helvetica oblicua.
  if (italic) return { name: 'helvetica', style: bold ? 'bolditalic' : 'italic' }
  return { name: 'Lexend', style: bold ? 'bold' : 'normal' }
}

function createPainter(doc: jsPDF): Painter {
  const setFont = (font: FontSpec) => {
    const f = faceFor(font)
    doc.setFont(f.name, f.style)
    doc.setFontSize(font.size)
  }
  const fill = (c: string) => {
    const k = parseColor(c)
    doc.setFillColor(k.r, k.g, k.b)
  }
  const draw = (c: string) => {
    const k = parseColor(c)
    doc.setDrawColor(k.r, k.g, k.b)
  }
  return {
    measure: (text, font) => {
      setFont(font)
      return doc.getTextWidth(text)
    },
    beginPage(w, h, bg) {
      doc.addPage([w, h], w >= h ? 'landscape' : 'portrait')
      if (bg) {
        fill(bg)
        doc.rect(0, 0, w, h, 'F')
      }
    },
    save: () => {
      doc.saveGraphicsState()
    },
    restore: () => {
      doc.restoreGraphicsState()
    },
    clipRect(r: Rect) {
      doc.rect(r.x, r.y, r.w, r.h, null)
      doc.clip()
      doc.discardPath()
    },
    shape(kind: SceneShape, r: Rect, fillColor: string | null, stroke: string | null, strokeWidth: number, radius: number) {
      const f = fillColor ? parseColor(fillColor) : null
      const doFill = !!f && f.a > 0
      const doStroke = !!stroke && strokeWidth > 0
      if (!doFill && !doStroke) return
      if (doFill) fill(fillColor!)
      if (doStroke) {
        draw(stroke!)
        doc.setLineWidth(strokeWidth)
      }
      const style = doFill && doStroke ? 'FD' : doFill ? 'F' : 'S'
      if (kind === 'circle') {
        doc.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, style)
      } else if (kind === 'diamond') {
        const cx = r.x + r.w / 2
        const cy = r.y + r.h / 2
        doc.lines(
          [
            [r.w / 2, r.h / 2],
            [-r.w / 2, r.h / 2],
            [-r.w / 2, -r.h / 2],
          ],
          cx,
          r.y,
          [1, 1],
          style,
          true,
        )
        void cy
      } else {
        const rad = Math.min(radius, r.w / 2, r.h / 2)
        doc.roundedRect(r.x, r.y, r.w, r.h, rad, rad, style)
      }
    },
    path(cmds: PathCmd[], color: string, width: number, dash: number[] | null) {
      if (cmds.length < 2) return
      draw(color)
      doc.setLineWidth(width)
      doc.setLineCap('round')
      doc.setLineDashPattern(dash && dash.length ? dash : [], 0)
      let cx = 0
      let cy = 0
      let sx = 0
      let sy = 0
      const segs: number[][] = []
      for (const c of cmds) {
        if (c[0] === 'M') {
          cx = sx = c[1]
          cy = sy = c[2]
        } else if (c[0] === 'L') {
          segs.push([c[1] - cx, c[2] - cy])
          cx = c[1]
          cy = c[2]
        } else if (c[0] === 'C') {
          segs.push([c[1] - cx, c[2] - cy, c[3] - cx, c[4] - cy, c[5] - cx, c[6] - cy])
          cx = c[5]
          cy = c[6]
        } else {
          // Cuadrática → cúbica equivalente.
          const [, qx, qy, x, y] = c
          segs.push([
            (2 / 3) * (qx - cx), (2 / 3) * (qy - cy),
            x - cx + (2 / 3) * (qx - x), y - cy + (2 / 3) * (qy - y),
            x - cx, y - cy,
          ])
          cx = x
          cy = y
        }
      }
      doc.lines(segs, sx, sy, [1, 1], 'S', false)
      doc.setLineDashPattern([], 0)
    },
    text(str, x, baselineY, font, deco) {
      setFont(font)
      const k = parseColor(font.color)
      doc.setTextColor(k.r, k.g, k.b)
      doc.text(str, x, baselineY)
      if (deco?.underline || deco?.strike) {
        draw(font.color)
        doc.setLineWidth(Math.max(font.size * 0.06, 0.3))
        if (deco.underline) doc.line(x, baselineY + font.size * 0.12, x + deco.width, baselineY + font.size * 0.12)
        if (deco.strike) doc.line(x, baselineY - font.size * 0.28, x + deco.width, baselineY - font.size * 0.28)
      }
    },
  }
}

export async function buildPdf(pages: Page[], opts: Omit<DrawOptions, 'pageNo' | 'pageCount'>, title: string): Promise<jsPDF> {
  const first = pages[0]
  const doc = new jsPDF({ unit: 'pt', format: [first.w, first.h], orientation: first.w >= first.h ? 'landscape' : 'portrait', compress: true })
  doc.setProperties({ title, creator: 'MIRDaily', subject: 'Mapa mental' })
  const [regular, bold] = await Promise.all([toBase64(LEXEND.normal), toBase64(LEXEND.bold)])
  doc.addFileToVFS('Lexend-Regular.ttf', regular)
  doc.addFont('Lexend-Regular.ttf', 'Lexend', 'normal', undefined, 'Identity-H')
  doc.addFileToVFS('Lexend-Bold.ttf', bold)
  doc.addFont('Lexend-Bold.ttf', 'Lexend', 'bold', undefined, 'Identity-H')

  const painter = createPainter(doc)
  pages.forEach((page, i) => {
    drawPage(painter, page, { ...opts, pageNo: i + 1, pageCount: pages.length })
  })
  // jsPDF crea una primera hoja en blanco al construirse: fuera.
  doc.deletePage(1)
  return doc
}
