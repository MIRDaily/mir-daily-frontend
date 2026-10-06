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
  /** Estilo de la fila de cabecera. */
  headerStyle?: CellStyle
  /** Estilo de cada fila de datos (mismo orden que `rows`; null = ninguno). */
  rowStyles?: (CellStyle | null)[]
  /** Estilo de cada columna (mismo orden que `columns`; null = ninguno). */
  colStyles?: (CellStyle | null)[]
  /**
   * Estilo de celdas sueltas: una fila por cada fila de la tabla CONTANDO la cabecera (la 0 es la
   * cabecera; la i+1, la fila de datos i) y una entrada por columna; null = ninguno.
   */
  cellStyles?: (CellStyle | null)[][]
}

/**
 * Estilo de una fila, una columna o una celda. Lo que falta sigue el de la tabla (el del nodo).
 * En una celda se juntan, por este orden, el de su columna, el de su fila y el suyo: si chocan,
 * manda lo más concreto.
 */
export type CellStyle = {
  bold?: boolean
  italic?: boolean
  /** Color de la letra (#rrggbb). */
  color?: string
  /** Color de fondo (#rrggbb). */
  fill?: string
  align?: 'left' | 'center' | 'right'
}

const HEX = /^#[0-9a-f]{6}$/i
const ALINEACIONES = ['left', 'center', 'right'] as const

/** Estilo saneado (solo campos válidos); null si no queda nada. */
export function sanitizeCellStyle(raw: unknown): CellStyle | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: CellStyle = {}
  if (typeof r.bold === 'boolean') out.bold = r.bold
  if (typeof r.italic === 'boolean') out.italic = r.italic
  if (typeof r.color === 'string' && HEX.test(r.color)) out.color = r.color
  if (typeof r.fill === 'string' && HEX.test(r.fill)) out.fill = r.fill
  if (ALINEACIONES.includes(r.align as CellStyle['align'] & string)) out.align = r.align as CellStyle['align']
  return Object.keys(out).length ? out : null
}

/** Lista de estilos del largo dado (rellena o recorta); undefined si no hay ninguno. */
function estilos(raw: unknown, largo: number): (CellStyle | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = Array.from({ length: largo }, (_, i) => sanitizeCellStyle(raw[i]))
  return out.some(Boolean) ? out : undefined
}

/** Matriz de estilos de celda del tamaño de la tabla (cabecera + filas × columnas); undefined si no hay ninguno. */
function matrizEstilos(raw: unknown, filas: number, cols: number): (CellStyle | null)[][] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = Array.from({ length: filas }, (_, i) =>
    Array.from({ length: cols }, (_, j) => sanitizeCellStyle(Array.isArray(raw[i]) ? (raw[i] as unknown[])[j] : null)),
  )
  return out.some((f) => f.some(Boolean)) ? out : undefined
}

/**
 * Estilo con el que se pinta una celda (fila -1 = cabecera): el de su columna, encima el de su
 * fila y encima el suyo. La cabecera va en negrita salvo que se le quite.
 */
export function cellStyleOf(t: MapTable, row: number, col: number): CellStyle {
  const deFila = row < 0 ? t.headerStyle : t.rowStyles?.[row]
  return {
    ...(row < 0 ? { bold: true } : {}),
    ...(t.colStyles?.[col] ?? {}),
    ...(deFila ?? {}),
    ...(t.cellStyles?.[row + 1]?.[col] ?? {}),
  }
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
  const header = r.columns.map((c) => cleanCell(c))
  // Cabecera sin la celda de la esquina (la mayoría de las filas trae una celda más): se añade
  // vacía delante. Si no, las filas se juntaban por el final y las columnas quedaban corridas.
  const lengths = (Array.isArray(r.rows) ? r.rows : []).filter(Array.isArray).map((x) => (x as unknown[]).length)
  const oneMore = lengths.filter((n) => n === header.length + 1).length
  if (header[0] !== '' && oneMore > lengths.length / 2) header.unshift('')
  const columns = header.slice(0, TABLE_LIMITS.maxColumns)
  const title = cleanCell(typeof r.title === 'string' ? r.title : fallbackTitle, TABLE_LIMITS.maxTitle, 0)
  let total = title.length + columns.join('').length
  const rows: string[][] = []
  for (const row of Array.isArray(r.rows) ? r.rows.slice(0, TABLE_LIMITS.maxRows) : []) {
    const cells = fit(row, columns.length)
    total += cells.join('').length
    if (total > TABLE_LIMITS.maxTotal) break
    rows.push(cells)
  }
  const headerStyle = sanitizeCellStyle(r.headerStyle)
  const rowStyles = estilos(r.rowStyles, rows.length)
  const colStyles = estilos(r.colStyles, columns.length)
  const cellStyles = matrizEstilos(r.cellStyles, rows.length + 1, columns.length)
  return {
    title,
    columns,
    rows,
    ...(headerStyle ? { headerStyle } : {}),
    ...(rowStyles ? { rowStyles } : {}),
    ...(colStyles ? { colStyles } : {}),
    ...(cellStyles ? { cellStyles } : {}),
  }
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

// Los estilos de filas y columnas viajan con ellas: se insertan, se borran y se mueven a la vez.
// Una lista que se queda sin ningún estilo desaparece (el JSON de una tabla sin estilos no cambia).
const limpia = (l: (CellStyle | null)[] | undefined) => (l && l.some(Boolean) ? l : undefined)
function conEstilos(t: MapTable, campo: 'rowStyles' | 'colStyles', lista: (CellStyle | null)[] | undefined): MapTable {
  const out = { ...t }
  const l = limpia(lista)
  if (l) out[campo] = l
  else delete out[campo]
  return out
}
const insertar = <T,>(list: T[], i: number, v: T) => [...list.slice(0, i), v, ...list.slice(i)]
const intercambiar = <T,>(list: T[], a: number, b: number) => {
  const out = list.slice()
  ;[out[a], out[b]] = [out[b], out[a]]
  return out
}
/** La lista de estilos con el largo que toca (si no la hay, todo null). */
const lista = (l: (CellStyle | null)[] | undefined, largo: number) => Array.from({ length: largo }, (_, i) => l?.[i] ?? null)

/** Matriz de estilos de celda completa (cabecera + filas × columnas), aunque no la hubiera. */
const matriz = (t: MapTable) =>
  Array.from({ length: t.rows.length + 1 }, (_, i) => Array.from({ length: t.columns.length }, (_, j) => t.cellStyles?.[i]?.[j] ?? null))

/** La tabla con esta matriz de estilos de celda (sin ella si se queda vacía). */
function conCeldas(t: MapTable, m: (CellStyle | null)[][] | undefined): MapTable {
  const out = { ...t }
  if (m && m.some((f) => f.some(Boolean))) out.cellStyles = m
  else delete out.cellStyles
  return out
}

/** Fila vacía en la posición `at` (0 = la primera de datos). */
export function insertRow(t: MapTable, at: number): MapTable {
  if (t.rows.length >= TABLE_LIMITS.maxRows) return t
  const i = Math.max(0, Math.min(at, t.rows.length))
  const rows = insertar(t.rows, i, new Array(t.columns.length).fill(''))
  const out = conEstilos({ ...t, rows }, 'rowStyles', t.rowStyles && insertar(lista(t.rowStyles, t.rows.length), i, null))
  return conCeldas(out, t.cellStyles && insertar(matriz(t), i + 1, new Array(t.columns.length).fill(null)))
}

export function removeRow(t: MapTable, row: number): MapTable {
  if (row < 0 || row >= t.rows.length) return t
  const fuera = <T,>(l: T[]) => l.filter((_, i) => i !== row)
  const out = conEstilos({ ...t, rows: fuera(t.rows) }, 'rowStyles', t.rowStyles && fuera(lista(t.rowStyles, t.rows.length)))
  return conCeldas(out, t.cellStyles && matriz(t).filter((_, i) => i !== row + 1))
}

export function moveRow(t: MapTable, row: number, dir: -1 | 1): MapTable {
  const to = row + dir
  if (row < 0 || to < 0 || to >= t.rows.length) return t
  const out = conEstilos(
    { ...t, rows: intercambiar(t.rows, row, to) },
    'rowStyles',
    t.rowStyles && intercambiar(lista(t.rowStyles, t.rows.length), row, to),
  )
  return conCeldas(out, t.cellStyles && intercambiar(matriz(t), row + 1, to + 1))
}

/** Columna vacía en la posición `at`. */
export function insertColumn(t: MapTable, at: number): MapTable {
  if (t.columns.length >= TABLE_LIMITS.maxColumns) return t
  const i = Math.max(0, Math.min(at, t.columns.length))
  const out = conEstilos(
    { ...t, columns: insertar(t.columns, i, ''), rows: t.rows.map((r) => insertar(r, i, '')) },
    'colStyles',
    t.colStyles && insertar(lista(t.colStyles, t.columns.length), i, null),
  )
  return conCeldas(out, t.cellStyles && matriz(t).map((f) => insertar(f, i, null)))
}

export function removeColumn(t: MapTable, col: number): MapTable {
  if (t.columns.length <= 1 || col < 0 || col >= t.columns.length) return t
  const fuera = <T,>(l: T[]) => l.filter((_, j) => j !== col)
  const out = conEstilos(
    { ...t, columns: fuera(t.columns), rows: t.rows.map(fuera) },
    'colStyles',
    t.colStyles && fuera(lista(t.colStyles, t.columns.length)),
  )
  return conCeldas(out, t.cellStyles && matriz(t).map(fuera))
}

export function moveColumn(t: MapTable, col: number, dir: -1 | 1): MapTable {
  const to = col + dir
  if (col < 0 || to < 0 || to >= t.columns.length) return t
  const out = conEstilos(
    { ...t, columns: intercambiar(t.columns, col, to), rows: t.rows.map((r) => intercambiar(r, col, to)) },
    'colStyles',
    t.colStyles && intercambiar(lista(t.colStyles, t.columns.length), col, to),
  )
  return conCeldas(out, t.cellStyles && matriz(t).map((f) => intercambiar(f, col, to)))
}

/**
 * Cambia el estilo de una fila (-1 = cabecera) o de una columna. `cambio` se mezcla con lo que
 * hubiera; un campo a `undefined` se quita; `null` borra el estilo entero.
 */
export function setRowStyle(t: MapTable, row: number, cambio: Partial<CellStyle> | null): MapTable {
  const nuevo = (antes: CellStyle | null | undefined) =>
    cambio === null ? null : sanitizeCellStyle(Object.fromEntries(Object.entries({ ...antes, ...cambio }).filter(([, v]) => v !== undefined)))
  if (row < 0) {
    const h = nuevo(t.headerStyle)
    const out = { ...t }
    if (h) out.headerStyle = h
    else delete out.headerStyle
    return out
  }
  if (row >= t.rows.length) return t
  const l = lista(t.rowStyles, t.rows.length)
  l[row] = nuevo(l[row])
  return conEstilos(t, 'rowStyles', l)
}

/** Mezcla un cambio en un estilo: un campo a undefined se quita; null lo borra entero. */
function mezclar(antes: CellStyle | null | undefined, cambio: Partial<CellStyle> | null): CellStyle | null {
  if (cambio === null) return null
  return sanitizeCellStyle(Object.fromEntries(Object.entries({ ...antes, ...cambio }).filter(([, v]) => v !== undefined)))
}

/** Cambia el estilo de una sola celda (fila -1 = cabecera); como setRowStyle. */
export function setCellStyle(t: MapTable, row: number, col: number, cambio: Partial<CellStyle> | null): MapTable {
  if (row < -1 || row >= t.rows.length || col < 0 || col >= t.columns.length) return t
  const m = matriz(t)
  m[row + 1][col] = mezclar(m[row + 1][col], cambio)
  return conCeldas(t, m)
}

export function setColStyle(t: MapTable, col: number, cambio: Partial<CellStyle> | null): MapTable {
  if (col < 0 || col >= t.columns.length) return t
  const l = lista(t.colStyles, t.columns.length)
  l[col] =
    cambio === null ? null : sanitizeCellStyle(Object.fromEntries(Object.entries({ ...l[col], ...cambio }).filter(([, v]) => v !== undefined)))
  return conEstilos(t, 'colStyles', l)
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
    const cells: [string, boolean][] = [
      [t.columns[j], cellStyleOf(t, -1, j).bold === true],
      ...t.rows.map((r, i) => [r[j] ?? '', cellStyleOf(t, i, j).bold === true] as [string, boolean]),
    ]
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
      rows = Math.max(rows, rowsFor(c, colW[j] - 2 * G.padX, measure, cellStyleOf(t, i - 1, j).bold === true, cellSize))
    })
    return rows * line + 2 * G.padY + 1
  })
  const height = titleH + rowH.reduce((a, b) => a + b, 0) + 2 * border
  return { colW, titleH, rowH, width, height, cellSize }
}
