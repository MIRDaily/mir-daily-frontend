import { collectSections, type Scope } from '@/lib/mapas/export/collect'
import { planPages, type Distribution, type Orientation, type Page, type PaperId, REGION_PAD } from '@/lib/mapas/export/pages'
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

function pagesFor(sections: Section[], o: ExportOptions): Page[] {
  // «Una hoja por rama» es siempre una rama por hoja, ajustada: el mosaico no tiene sentido ahí.
  const distribution = o.scope === 'branches' ? 'fit' : o.distribution
  return planPages(sections, { paper: o.paper, orientation: o.orientation, distribution, withTitle: o.withTitle })
}

/** Cuántas hojas saldrán y qué tamaño tendrá la letra más pequeña (pt), para avisar antes de exportar. */
export function pageStats(o: ExportOptions): { pages: number; minFontPt: number | null } {
  const sections = collectSections(o.scope).filter((s) => s.nodes.length > 0)
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
  const sections = collectSections(o.scope).filter((s) => s.nodes.length > 0)
  if (sections.length === 0) throw new Error(o.scope === 'selection' ? 'No hay nada seleccionado.' : 'El mapa está vacío.')
  await document.fonts.ready

  const part = o.scope === 'selection' ? '-seleccion' : o.scope === 'branches' ? '-por-ramas' : ''
  const base = `${slug(o.mapTitle)}${part}`
  const common = {
    background: BG[o.background],
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
