// Colores de las tablas, compartidos por el nodo del lienzo y su popup de edición.

function rgb(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1]
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function withAlpha(color: string, a: number): string {
  const c = rgb(color)
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : `rgba(125,138,150,${a})`
}

/** Letra blanca u oscura según lo claro que sea el fondo. */
export function readableOn(color: string): string {
  const c = rgb(color)
  if (!c) return '#FFFFFF'
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.62 ? '#2A2420' : '#FFFFFF'
}

/** Color del borde y la franja del título: el del borde del nodo o, si no tiene, su relleno. */
export function tableAccent(style: { borderWidth: number; borderColor: string; color: string }): string {
  return style.borderWidth > 0 ? style.borderColor : style.color
}
