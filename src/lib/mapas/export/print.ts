import { parseColor, type RGBA } from '@/lib/mapas/export/color'
import type { Section, SceneTable } from '@/lib/mapas/export/scene'
import type { CellStyle } from '@/lib/mapas/table'

// Modos de tinta para imprimir. La pantalla usa rellenos de color macizos (la rama «Etiología» es un
// bloque violeta con letra blanca): sobre papel gastan toneladas de tinta y la letra blanca sale mal.
//   · color  — tal cual se ve.
//   · save   — «ahorro de tinta»: sin rellenos; cada nodo se queda en un contorno del color de su
//              categoría, con letra oscura. Se reconocen igual las categorías y casi no gasta tinta.
//   · gray   — lo anterior en escala de grises, para impresoras en blanco y negro.

export type InkMode = 'color' | 'save' | 'gray'

export const INK_LABEL: Record<InkMode, string> = {
  color: 'Color',
  save: 'Ahorro de tinta',
  gray: 'Blanco y negro',
}

const INK = '#2A2420'
const MIN_OUTLINE = 1.6

/** Luminosidad percibida, 0 (negro) a 1 (blanco). */
export function luminance(c: RGBA): number {
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255
}

function hex(c: RGBA): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`
}

function gray(c: RGBA, maxLum = 0.62): string {
  let g = luminance(c) * 255
  // Un gris demasiado claro no se lee sobre papel blanco: se oscurece hasta un mínimo de contraste.
  g = Math.min(g, maxLum * 255)
  return hex({ r: g, g, b: g, a: 1 })
}

function darkenIfPale(color: string, fallback: string): string {
  const c = parseColor(color)
  return luminance(c) > 0.82 ? fallback : color
}

/**
 * Estilos de fila y columna de una tabla para imprimir: sin fondos; la letra de color se queda si
 * se lee sobre blanco (en gris en blanco y negro) y la clara pasa a tinta.
 */
function tablaSinTinta(t: SceneTable, toGray: boolean): SceneTable {
  const st = (s: CellStyle | null | undefined): CellStyle | null => {
    if (!s) return null
    const out: CellStyle = { ...s }
    delete out.fill
    if (out.color) {
      const c = parseColor(out.color)
      if (luminance(c) > 0.55) delete out.color
      else if (toGray) out.color = gray(c, 0.25)
    }
    return Object.keys(out).length ? out : null
  }
  const out: SceneTable = { ...t, solid: false }
  if (t.headerStyle) {
    const h = st(t.headerStyle)
    if (h) out.headerStyle = h
    else delete out.headerStyle
  }
  if (t.rowStyles) out.rowStyles = t.rowStyles.map(st)
  if (t.colStyles) out.colStyles = t.colStyles.map(st)
  if (t.cellStyles) out.cellStyles = t.cellStyles.map((f) => f.map(st))
  return out
}

export function applyInk(section: Section, mode: InkMode): Section {
  if (mode === 'color') return section
  const toGray = mode === 'gray'
  const nodes = section.nodes.map((n) => {
    const fill = parseColor(n.fill)
    const hasFill = fill.a > 0.05
    const solid = hasFill && n.strokeWidth === 0
    // Un nodo macizo pasa a contorno del color de su relleno; uno que ya tenía borde conserva el suyo.
    let outline = solid ? n.fill : n.stroke
    const width = solid ? Math.max(MIN_OUTLINE, n.strokeWidth) : n.strokeWidth
    if (width > 0 && luminance(parseColor(outline)) > 0.82) outline = '#7D8A96'
    let text = n.textColor
    if (luminance(parseColor(text)) > 0.55) text = INK
    if (toGray) {
      outline = gray(parseColor(outline))
      text = gray(parseColor(text), 0.25)
    }
    return {
      ...n,
      fill: '#FFFFFF',
      stroke: outline,
      strokeWidth: width,
      textColor: text,
      // Tablas: sin franja ni cabecera rellenas; el título va en el color del contorno.
      ...(n.table ? { table: tablaSinTinta(n.table, toGray) } : {}),
    }
  })
  const edges = section.edges.map((e) => {
    let color = darkenIfPale(e.color, '#7D8A96')
    if (toGray) color = gray(parseColor(color), 0.55)
    return { ...e, color }
  })
  return { ...section, nodes, edges }
}
