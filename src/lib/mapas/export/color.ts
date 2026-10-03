// Colores CSS (#rgb, #rrggbb, #rrggbbaa, rgb(), rgba()) a componentes. Lo que no se entiende, negro.

export type RGBA = { r: number; g: number; b: number; a: number }

export function parseColor(input: string | undefined | null, fallback: RGBA = { r: 0, g: 0, b: 0, a: 1 }): RGBA {
  if (!input) return fallback
  const s = input.trim().toLowerCase()
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      }
    }
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s)
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]), a }
  }
  return fallback
}

export function toCss(c: RGBA): string {
  return c.a >= 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`
}
