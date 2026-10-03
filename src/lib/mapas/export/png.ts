import { parseColor, toCss } from '@/lib/mapas/export/color'
import { drawPage, type DrawOptions, type Painter } from '@/lib/mapas/export/draw'
import type { FontSpec } from '@/lib/mapas/export/layout'
import type { Page } from '@/lib/mapas/export/pages'
import type { PathCmd, Rect, SceneShape } from '@/lib/mapas/export/scene'
import { fontCss } from '@/lib/mapas/fonts'

// PNG nítido: el mismo dibujo que el PDF, pintado en un canvas del tamaño que haga falta (no una
// captura de la pantalla). Con el límite de 8192 px por lado y ~40 megapíxeles que aguantan los
// navegadores; si el mapa es enorme, la escala baja sola.

export const PNG_MAX_SIDE = 8192
export const PNG_MAX_PIXELS = 40_000_000

/** Sustituye `var(--x)` de una pila CSS por su valor real (el canvas no resuelve variables). */
function resolveStack(css: string, scope: Element): string {
  const cs = getComputedStyle(scope)
  return css.replace(/var\((--[\w-]+)\)\s*,?\s*/g, (_m, name: string) => {
    const v = cs.getPropertyValue(name).trim()
    return v ? `${v}, ` : ''
  })
}

export function fontString(font: FontSpec, scope: Element): string {
  return `${font.italic ? 'italic ' : ''}${font.bold ? '700' : '400'} ${font.size}px ${resolveStack(fontCss(font.family), scope)}`
}

function createPainter(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, scope: Element): Painter {
  const setFont = (font: FontSpec) => {
    ctx.font = fontString(font, scope)
  }
  return {
    measure: (text, font) => {
      setFont(font)
      return ctx.measureText(text).width
    },
    beginPage(w, h, bg) {
      canvas.width = Math.round(w)
      canvas.height = Math.round(h)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (bg) {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    },
    save: () => ctx.save(),
    restore: () => ctx.restore(),
    clipRect(r: Rect) {
      ctx.beginPath()
      ctx.rect(r.x, r.y, r.w, r.h)
      ctx.clip()
    },
    shape(kind: SceneShape, r: Rect, fill: string | null, stroke: string | null, strokeWidth: number, radius: number) {
      ctx.beginPath()
      if (kind === 'circle') ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2)
      else if (kind === 'diamond') {
        ctx.moveTo(r.x + r.w / 2, r.y)
        ctx.lineTo(r.x + r.w, r.y + r.h / 2)
        ctx.lineTo(r.x + r.w / 2, r.y + r.h)
        ctx.lineTo(r.x, r.y + r.h / 2)
        ctx.closePath()
      } else ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(radius, r.w / 2, r.h / 2))
      const f = fill ? parseColor(fill) : null
      if (f && f.a > 0) {
        ctx.fillStyle = toCss(f)
        ctx.fill()
      }
      if (stroke && strokeWidth > 0) {
        ctx.strokeStyle = toCss(parseColor(stroke))
        ctx.lineWidth = strokeWidth
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
    },
    path(cmds: PathCmd[], color: string, width: number, dash: number[] | null) {
      ctx.beginPath()
      for (const c of cmds) {
        if (c[0] === 'M') ctx.moveTo(c[1], c[2])
        else if (c[0] === 'L') ctx.lineTo(c[1], c[2])
        else if (c[0] === 'C') ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6])
        else ctx.quadraticCurveTo(c[1], c[2], c[3], c[4])
      }
      ctx.strokeStyle = toCss(parseColor(color))
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.setLineDash(dash ?? [])
      ctx.stroke()
      ctx.setLineDash([])
    },
    text(str, x, baselineY, font, deco) {
      setFont(font)
      ctx.fillStyle = toCss(parseColor(font.color))
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(str, x, baselineY)
      if (deco?.underline || deco?.strike) {
        ctx.strokeStyle = ctx.fillStyle
        ctx.lineWidth = Math.max(font.size * 0.06, 0.8)
        ctx.beginPath()
        if (deco.underline) {
          ctx.moveTo(x, baselineY + font.size * 0.12)
          ctx.lineTo(x + deco.width, baselineY + font.size * 0.12)
        }
        if (deco.strike) {
          ctx.moveTo(x, baselineY - font.size * 0.28)
          ctx.lineTo(x + deco.width, baselineY - font.size * 0.28)
        }
        ctx.stroke()
      }
    },
  }
}

/**
 * Dibuja una hoja entera (con cabecera y pie) en pequeño y la devuelve como imagen: la vista previa
 * del diálogo de exportar. `pxPerPt` es el tamaño de la miniatura respecto a la hoja en puntos.
 */
export function renderPageThumb(page: Page, opts: Omit<DrawOptions, 'pageNo' | 'pageCount'> & { pageNo: number; pageCount: number }, scope: Element, pxPerPt: number): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const painter = createPainter(canvas, ctx, scope)
  const begin = painter.beginPage.bind(painter)
  painter.beginPage = (w, h, bg) => {
    begin(w * pxPerPt, h * pxPerPt, bg)
    ctx.scale(pxPerPt, pxPerPt)
  }
  drawPage(painter, page, opts)
  return canvas.toDataURL('image/png')
}

/** Escala (px de imagen por px del lienzo) que respeta los límites del navegador. */
export function pngScale(width: number, height: number, wanted: number): number {
  let k = wanted
  k = Math.min(k, PNG_MAX_SIDE / width, PNG_MAX_SIDE / height)
  k = Math.min(k, Math.sqrt(PNG_MAX_PIXELS / (width * height)))
  return Math.max(k, 0.1)
}

/** Pinta una página (sin cabecera ni pie) en un canvas y lo devuelve como PNG. */
export async function renderPng(page: Page, opts: Omit<DrawOptions, 'pageNo' | 'pageCount'>, scope: Element): Promise<{ blob: Blob; width: number; height: number; scale: number }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no permite crear la imagen.')
  const painter = createPainter(canvas, ctx, scope)
  drawPage(painter, page, { ...opts, bare: true, pageNo: 1, pageCount: 1 })
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/png'),
  )
  return { blob, width: canvas.width, height: canvas.height, scale: page.scale }
}
