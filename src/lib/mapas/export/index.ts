import { collectSections, type Scope } from '@/lib/mapas/export/collect'
import { planPages, type Distribution, type Orientation, type Page, type PaperId, REGION_PAD } from '@/lib/mapas/export/pages'
import { applyInk, type InkMode } from '@/lib/mapas/export/print'
import { boundsOf, type Section } from '@/lib/mapas/export/scene'

export type ExportFormat = 'pdf' | 'png'
export type Background = 'white' | 'cream' | 'transparent'

export type ExportOptions = {
  format: ExportFormat
  scope: Scope
  paper: PaperId
  orientation: Orientation
  distribution: Distribution
  background: Background
  withTitle: boolean
  /** Tinta: tal cual, ahorro de tinta (sin rellenos) o blanco y negro. */
  ink: InkMode
  /** PNG: píxeles de imagen por píxel del lienzo (se reduce solo si el mapa es enorme). */
  quality: 2 | 3 | 4
  mapTitle: string
}

export const DEFAULT_EXPORT: Omit<ExportOptions, 'mapTitle'> = {
  format: 'pdf',
  scope: 'all',
  paper: 'a4',
  orientation: 'auto',
  distribution: 'fit',
  background: 'white',
  withTitle: true,
  ink: 'color',
  quality: 3,
}

const BG: Record<Background, string | null> = { white: '#FFFFFF', cream: '#FAF7F4', transparent: null }

function slug(s: string): string {
  const base = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return base.slice(0, 60) || 'mapa'
}

function dateLabel(): string {
  return new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Las partes a exportar con el modo de tinta ya aplicado. */
function sectionsFor(o: ExportOptions): Section[] {
  return collectSections(o.scope)
    .filter((s) => s.nodes.length > 0)
    .map((s) => applyInk(s, o.ink))
}

/** Fondo real: para imprimir con ahorro de tinta o en blanco y negro, siempre papel blanco. */
function backgroundFor(o: ExportOptions): string | null {
  if (o.ink !== 'color' && o.background === 'cream') return BG.white
  return BG[o.background]
}

function pagesFor(sections: Section[], o: ExportOptions): Page[] {
  // «Una hoja por rama» es siempre una rama por hoja, ajustada: el mosaico no tiene sentido ahí.
  const distribution = o.scope === 'branches' ? 'fit' : o.distribution
  return planPages(sections, { paper: o.paper, orientation: o.orientation, distribution, withTitle: o.withTitle })
}

/** Cuántas hojas saldrán y qué tamaño tendrá la letra más pequeña (pt), para avisar antes de exportar. */
export function pageStats(o: ExportOptions): { pages: number; minFontPt: number | null } {
  const sections = sectionsFor(o)
  if (o.format === 'png') return { pages: sections.length > 0 ? 1 : 0, minFontPt: null }
  const pages = pagesFor(sections, o)
  if (pages.length === 0) return { pages: 0, minFontPt: null }
  // La portada de «una hoja por rama» es solo un plano general: no cuenta para legibilidad.
  const readable = o.scope === 'branches' && pages.length > 1 ? pages.slice(1) : pages
  const smallest = Math.min(...readable.map((p) => p.scale * Math.min(...p.section.nodes.map((n) => n.fontSize))))
  return { pages: pages.length, minFontPt: smallest }
}

export function selectionSize(): number {
  return collectSections('selection')[0]?.nodes.length ?? 0
}

/**
 * Miniaturas de las primeras hojas del PDF, tal como saldrán (con el modo de tinta elegido). Sirven
 * para la vista previa del diálogo. Devuelve también cuántas hojas hay en total.
 */
export async function renderPreviews(o: ExportOptions, max = 4, pxPerPt = 0.42): Promise<{ urls: string[]; total: number }> {
  const root = document.querySelector('.mapa-root')
  if (!root) return { urls: [], total: 0 }
  const pages = pagesFor(sectionsFor(o), o)
  await document.fonts.ready
  const { renderPageThumb } = await import('@/lib/mapas/export/png')
  const urls: string[] = []
  for (const page of pages.slice(0, max)) {
    urls.push(
      renderPageThumb(
        page,
        {
          background: backgroundFor(o) ?? '#FFFFFF',
          mapTitle: o.mapTitle.trim() || 'Mapa mental',
          withTitle: o.withTitle,
          dateLabel: dateLabel(),
          ink: '#2C3E50',
          muted: '#7D8A96',
          pageNo: urls.length + 1,
          pageCount: pages.length,
        },
        root,
        pxPerPt,
      ),
    )
  }
  return { urls, total: pages.length }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function runExport(o: ExportOptions): Promise<{ filename: string; pages: number }> {
  const root = document.querySelector('.mapa-root')
  if (!root) throw new Error('No se encontró el mapa.')
  const sections = sectionsFor(o)
  if (sections.length === 0) throw new Error(o.scope === 'selection' ? 'No hay nada seleccionado.' : 'El mapa está vacío.')
  await document.fonts.ready

  const part = o.scope === 'selection' ? '-seleccion' : o.scope === 'branches' ? '-por-ramas' : ''
  const base = `${slug(o.mapTitle)}${part}`
  const common = {
    background: backgroundFor(o),
    mapTitle: o.mapTitle.trim() || 'Mapa mental',
    withTitle: o.withTitle,
    dateLabel: dateLabel(),
    ink: '#2C3E50',
    muted: '#7D8A96',
  }

  if (o.format === 'pdf') {
    const pages = pagesFor(sections, o)
    const { buildPdf } = await import('@/lib/mapas/export/pdf')
    const doc = await buildPdf(pages, { ...common, background: common.background ?? '#FFFFFF' }, common.mapTitle)
    doc.save(`${base}.pdf`)
    return { filename: `${base}.pdf`, pages: pages.length }
  }

  // PNG: un solo dibujo con el tamaño del mapa (sin hojas), al detalle que se haya pedido.
  const section = sections[0]
  const b = boundsOf(section.nodes)
  const region = { x: b.x - REGION_PAD, y: b.y - REGION_PAD, w: b.w + 2 * REGION_PAD, h: b.h + 2 * REGION_PAD }
  const { renderPng, pngScale, fontString } = await import('@/lib/mapas/export/png')
  const k = pngScale(region.w, region.h, o.quality)
  // Que las fuentes usadas estén cargadas antes de medir y pintar.
  const families = new Set(section.nodes.map((n) => n.fontFamily))
  await Promise.all(
    [...families].flatMap((family) => [
      document.fonts.load(fontString({ family, size: 16 }, root)),
      document.fonts.load(fontString({ family, size: 16, bold: true }, root)),
    ]),
  )
  const page: Page = {
    section,
    region,
    scale: k,
    w: region.w * k,
    h: region.h * k,
    area: { x: 0, y: 0, w: region.w * k, h: region.h * k },
    clip: false,
  }
  const { blob } = await renderPng(page, { ...common, withTitle: false }, root)
  download(blob, `${base}.png`)
  return { filename: `${base}.png`, pages: 1 }
}
