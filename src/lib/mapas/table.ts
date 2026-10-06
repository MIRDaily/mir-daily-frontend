// Nodo «tabla» del mapa mental: un nodo normal (mismo tipo, misma jerarquía, mismo estilo) que
// además lleva `table`. Vive en el árbol v1 (`MapNode.table`, con el título en `text`) y en el
// grafo v2 (`data.table`). Todo lo de aquí es puro: sirve al editor, al exportador, a la lista y
// a los tests.
//
// El `label` de un nodo tabla es una COPIA en texto de la tabla (título en negrita y una línea
// por fila, «a | b»). Nunca es la fuente: se regenera desde `table` al editar y al cargar. Sirve
// para que el buscador y el resumen de la lista vean las celdas sin saber de tablas, y para que
// un cliente viejo (una pestaña abierta antes del despliegue), que no conoce `table` y lo
// descarta, enseñe y guarde al menos el contenido como texto.

export type MapTable = {
  title: string
  /** Cabecera: una celda por columna (puede ir vacía, p. ej. la esquina). */
  columns: string[]
  /** Filas de datos; cada una con exactamente `columns.length` celdas. */
  rows: string[][]
}

export const TABLE_LIMITS = {
  maxColumns: 8,
  maxRows: 40,
  maxCell: 160,
  maxTitle: 120,
  /** Caracteres de toda la tabla (cabecera, filas y título). */
  maxTotal: 6000,
  /** Saltos de línea dentro de una celda. */
  maxBreaks: 3,
} as const

/** Largo máximo del label (el de un cliente viejo recorta a 4000). */
const MAX_LABEL = 3900

// Control, formato invisible, dirección bidi y la familia "tag" (instrucciones ocultas).
const INVISIBLES =
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯﻿￹-￻]|\uDB40[\uDC00-\uDC7F]/g

/** Texto plano de una celda: sin etiquetas, sin invisibles, espacios normalizados, acotado. */
export function cleanCell(v: unknown, max: number = TABLE_LIMITS.maxCell, breaks: number = TABLE_LIMITS.maxBreaks): string {
  const s = typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
  const lines = s
    .normalize('NFC')
    .replace(/<(script|style|iframe|object|embed|template)\b[\s\S]*?(<\/\1\s*>|$)/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLES, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const kept = lines.slice(0, breaks + 1)
  if (lines.length > kept.length) kept[kept.length - 1] += ' ' + lines.slice(kept.length).join(' ')
  return kept.join('\n').slice(0, max).trim()
}

const fit = (row: unknown, width: number): string[] => {
  const cells = Array.isArray(row) ? row.map((c) => cleanCell(c)) : []
  if (cells.length <= width) return [...cells, ...new Array(width - cells.length).fill('')]
  // Celdas de más: se juntan en la última en vez de perderse.
  const extra = cells.slice(width - 1).filter(Boolean).join(' / ')
  return [...cells.slice(0, width - 1), cleanCell(extra)]
}

/**
 * Valida y sanea una tabla leída de fuera (BD, archivo importado, IA). `fallbackTitle`: el
 * texto del nodo (en el árbol v1 el título va en `text`). null si no hay una tabla utilizable.
 */
export function sanitizeTable(raw: unknown, fallbackTitle = ''): MapTable | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.columns) || r.columns.length === 0) return null
  const columns = r.columns.slice(0, TABLE_LIMITS.maxColumns).map((c) => cleanCell(c))
  const title = cleanCell(typeof r.title === 'string' ? r.title : fallbackTitle, TABLE_LIMITS.maxTitle, 0)
  let total = title.length + columns.join('').length
  const rows: string[][] = []
  for (const row of Array.isArray(r.rows) ? r.rows.slice(0, TABLE_LIMITS.maxRows) : []) {
    const cells = fit(row, columns.length)
    total += cells.join('').length
    if (total > TABLE_LIMITS.maxTotal) break
    rows.push(cells)
  }
  return { title, columns, rows }
}

export function newTable(): MapTable {
  return { title: 'Nueva tabla', columns: ['Columna 1', 'Columna 2', 'Columna 3'], rows: [['', '', ''], ['', '', '']] }
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Copia en texto de la tabla para `data.label` (ver arriba). HTML seguro y acotado. */
export function tableToLabel(t: MapTable): string {
  const lines = [
    ...(t.title ? [`<b>${escapeHtml(t.title)}</b>`] : []),
    ...[t.columns, ...t.rows].map((r) => escapeHtml(r.map((c) => c.replace(/\n/g, ' ')).join(' | '))),
  ]
  let out = ''
  for (const line of lines) {
    const next = out ? `${out}<br>${line}` : line
    if (next.length > MAX_LABEL) return `${out}<br>…`
    out = next
  }
  return out
}

/** Texto plano de toda la tabla (título, cabecera y celdas). */
export function tablePlainText(t: MapTable): string {
  return [t.title, ...t.columns, ...t.rows.flat()].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Edición (funciones puras: devuelven una tabla nueva). Fila -1 = cabecera.
// ---------------------------------------------------------------------------

export function setCell(t: MapTable, row: number, col: number, value: string): MapTable {
  const v = cleanCell(value)
  if (row < 0) return { ...t, columns: t.columns.map((c, j) => (j === col ? v : c)) }
  return { ...t, rows: t.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? v : c)) : r)) }
}

export function setTitle(t: MapTable, value: string): MapTable {
  return { ...t, title: cleanCell(value, TABLE_LIMITS.maxTitle, 0) }
}

/** Fila vacía en la posición `at` (0 = la primera de datos). */
export function insertRow(t: MapTable, at: number): MapTable {
  if (t.rows.length >= TABLE_LIMITS.maxRows) return t
  const i = Math.max(0, Math.min(at, t.rows.length))
  const rows = t.rows.slice()
  rows.splice(i, 0, new Array(t.columns.length).fill(''))
  return { ...t, rows }
}

export function removeRow(t: MapTable, row: number): MapTable {
  if (row < 0 || row >= t.rows.length) return t
  return { ...t, rows: t.rows.filter((_, i) => i !== row) }
}

export function moveRow(t: MapTable, row: number, dir: -1 | 1): MapTable {
  const to = row + dir
  if (row < 0 || to < 0 || to >= t.rows.length) return t
  const rows = t.rows.slice()
  ;[rows[row], rows[to]] = [rows[to], rows[row]]
  return { ...t, rows }
}

/** Columna vacía en la posición `at`. */
export function insertColumn(t: MapTable, at: number): MapTable {
  if (t.columns.length >= TABLE_LIMITS.maxColumns) return t
  const i = Math.max(0, Math.min(at, t.columns.length))
  const add = <T,>(list: T[], v: T) => [...list.slice(0, i), v, ...list.slice(i)]
  return { ...t, columns: add(t.columns, ''), rows: t.rows.map((r) => add(r, '')) }
}

export function removeColumn(t: MapTable, col: number): MapTable {
  if (t.columns.length <= 1 || col < 0 || col >= t.columns.length) return t
  return { ...t, columns: t.columns.filter((_, j) => j !== col), rows: t.rows.map((r) => r.filter((_, j) => j !== col)) }
}

export function moveColumn(t: MapTable, col: number, dir: -1 | 1): MapTable {
  const to = col + dir
  if (col < 0 || to < 0 || to >= t.columns.length) return t
  const swap = <T,>(list: T[]) => {
    const out = list.slice()
    ;[out[col], out[to]] = [out[to], out[col]]
    return out
  }
  return { ...t, columns: swap(t.columns), rows: t.rows.map(swap) }
}

// ---------------------------------------------------------------------------
// Geometría: la MISMA para pintar (anchos de columna del <colgroup>), para el layout antes de que
// el navegador mida, para la miniatura de la lista y para exportar.
// ---------------------------------------------------------------------------

/** Ancho de un texto de una línea a ese tamaño de letra (px). */
export type CellMeasure = (text: string, bold: boolean, size: number) => number

export const TABLE_GEOMETRY = {
  padX: 8,
  padY: 5,
  titlePadX: 10,
  titlePadY: 7,
  lineHeight: 1.35,
  minCol: 56,
  maxCol: 240,
  maxWidth: 640,
  minWidth: 160,
  /** El texto de las celdas va un punto más pequeño que el del nodo. */
  cellDelta: -1,
} as const

export type TableGeometry = {
  colW: number[]
  titleH: number
  /** Alto de cada fila: primero la cabecera, luego las de datos. */
  rowH: number[]
  width: number
  height: number
  cellSize: number
}

/** Medida aproximada sin tipografía real (Node, tests, miniaturas). */
export const estimateMeasure: CellMeasure = (text, bold, size) => text.length * size * (bold ? 0.6 : 0.55)

function rowsFor(text: string, maxW: number, m: CellMeasure, bold: boolean, size: number): number {
  let rows = 0
  for (const line of (text || ' ').split('\n')) {
    rows += 1
    let cur = 0
    const space = m(' ', bold, size)
    for (const word of line.split(' ')) {
      const w = m(word, bold, size)
      if (w > maxW) {
        const pieces = Math.ceil(w / maxW)
        rows += cur > 0 ? pieces : pieces - 1
        cur = w - (pieces - 1) * maxW
      } else if (cur === 0) cur = w
      else if (cur + space + w <= maxW + 1e-6) cur += space + w
      else {
        rows += 1
        cur = w
      }
    }
  }
  return rows
}

export function tableGeometry(t: MapTable, measure: CellMeasure = estimateMeasure, fontSize = 14, border = 2): TableGeometry {
  const G = TABLE_GEOMETRY
  const cellSize = Math.max(8, fontSize + G.cellDelta)
  const cols = t.columns.length
  const natural = new Array(cols).fill(0).map((_, j) => {
    let w = 0
    const cells: [string, boolean][] = [[t.columns[j], true], ...t.rows.map((r) => [r[j] ?? '', false] as [string, boolean])]
    for (const [text, bold] of cells) for (const line of text.split('\n')) w = Math.max(w, measure(line, bold, cellSize))
    return Math.min(G.maxCol, Math.max(G.minCol, Math.ceil(w + 2 * G.padX + 1)))
  })
  // Si no cabe, se estrechan primero las columnas más anchas (hasta igualarse con las siguientes).
  const colW = natural.slice()
  const inner = G.maxWidth - 2 * border
  let sum = colW.reduce((a, b) => a + b, 0)
  while (sum > inner + 0.5) {
    const max = Math.max(...colW)
    if (max <= G.minCol) break
    const widest = colW.filter((w) => w === max).length
    const next = Math.max(G.minCol, ...colW.filter((w) => w < max))
    const cut = Math.min((max - next) * widest, sum - inner)
    for (let j = 0; j < cols; j++) if (colW[j] === max) colW[j] = max - cut / widest
    sum = colW.reduce((a, b) => a + b, 0)
  }
  if (sum < G.minWidth - 2 * border) {
    const k = (G.minWidth - 2 * border) / sum
    for (let j = 0; j < cols; j++) colW[j] *= k
    sum = G.minWidth - 2 * border
  }
  const width = sum + 2 * border
  const line = cellSize * G.lineHeight
  // La franja del título está siempre (vacía, enseña «Sin título» al editarla).
  const titleH = rowsFor(t.title || ' ', sum - 2 * G.titlePadX, measure, true, fontSize) * fontSize * G.lineHeight + 2 * G.titlePadY
  const rowH = [t.columns, ...t.rows].map((r, i) => {
    let rows = 1
    r.forEach((c, j) => {
      rows = Math.max(rows, rowsFor(c, colW[j] - 2 * G.padX, measure, i === 0, cellSize))
    })
    return rows * line + 2 * G.padY + 1
  })
  const height = titleH + rowH.reduce((a, b) => a + b, 0) + 2 * border
  return { colW, titleH, rowH, width, height, cellSize }
}
