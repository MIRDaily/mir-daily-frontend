// Helpers de dibujo compartidos por los calendarios de simulacro (el
// heatmap de Historial y el mini-calendario de la cabecera del Studio):
// mismo degradado de color y misma forma de construir semanas de mes real.

const RED_PASTEL = { r: 0xf3, g: 0xb7, b: 0xae }
const GREEN_PASTEL = { r: 0xb9, g: 0xdc, b: 0xb4 }

export function accuracyToColor(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100))
  const r = Math.round(RED_PASTEL.r + (GREEN_PASTEL.r - RED_PASTEL.r) * t)
  const g = Math.round(RED_PASTEL.g + (GREEN_PASTEL.g - RED_PASTEL.g) * t)
  const b = Math.round(RED_PASTEL.b + (GREEN_PASTEL.b - RED_PASTEL.b) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export function isoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Semanas (filas) de un mes real: lunes en la 1ª columna, domingo en la 7ª.
// Huecos (null) antes del día 1 y después del último día para completar
// semanas de 7 — así el día 1 en domingo cae en la última columna de la
// primera fila, como un calendario de verdad.
export function buildMonthWeeks(year: number, month: number): (Date | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

  const cells: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - leading + 1
    cells.push(dayNum >= 1 && dayNum <= daysInMonth ? new Date(year, month, dayNum) : null)
  }

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
