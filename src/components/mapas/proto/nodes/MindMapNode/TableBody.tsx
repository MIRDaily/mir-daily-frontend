import { memo, useMemo, type CSSProperties } from 'react'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'
import { resolveFont } from '@/components/mapas/proto/utils/font'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { openTableEditor } from '@/components/mapas/proto/utils/tables'
import { readableOn, tableAccent, withAlpha } from '@/components/mapas/proto/utils/tableColors'
import {
  cellStyleOf,
  estimateMeasure,
  tableGeometry,
  TABLE_GEOMETRY as G,
  type CellMeasure,
  type MapTable,
} from '@/lib/mapas/table'
import { isDoubtfulCell, type NodoIA } from '@/lib/mapas/ia/revision'

// Nodo tabla: franja de título con el color de la categoría, cabecera tintada y celdas que
// ajustan el texto. Los anchos de columna salen de `tableGeometry` (la misma cuenta que usan el
// layout, la miniatura y el exportador). Las celdas se pintan como TEXTO de React, nunca como
// HTML. En el lienzo solo se ve: se edita en su popup (TableEditorDialog), que abre el doble clic
// en la celda pulsada.

// ---- medición con la tipografía real (canvas) ----------------------------------------------

let ctx: CanvasRenderingContext2D | null | undefined
const cssVars = new Map<string, string>()

/** El canvas no entiende `var(--font-…)`: se sustituyen por su valor. */
function canvasFamily(stack: string): string {
  return stack.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    let v = cssVars.get(name)
    if (v === undefined) {
      const el = document.querySelector('.mapa-root') ?? document.documentElement
      v = getComputedStyle(el).getPropertyValue(name).trim()
      if (v) cssVars.set(name, v)
    }
    return v || 'sans-serif'
  })
}

function measurerFor(stack: string): CellMeasure {
  if (typeof document === 'undefined') return estimateMeasure
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d')
  const c = ctx
  if (!c) return estimateMeasure
  const family = canvasFamily(stack)
  return (text, bold, size) => {
    c.font = `${bold ? 700 : 400} ${size}px ${family}`
    return c.measureText(text).width
  }
}

// ---- la tabla --------------------------------------------------------------------------------

interface TableBodyProps {
  id: string
  table: MapTable
  style: NodeStyle
  selected: boolean
  /** Revisión guiada: las celdas dudosas de una tabla pendiente se marcan en ámbar. */
  ia?: NodoIA
}

function TableBodyInner({ id, table, style, selected, ia }: TableBodyProps) {
  const t = useTheme()
  const fontSize = style.fontSize ?? 14
  const family = resolveFont(style.fontFamily)
  const measure = useMemo(() => measurerFor(family), [family])
  const bw = Math.max(1, style.borderWidth)
  const g = useMemo(() => tableGeometry(table, measure, fontSize, bw), [table, measure, fontSize, bw])

  const accent = tableAccent(style)
  const grid = withAlpha(accent, 0.38)

  /** Doble clic: el popup se abre con el cursor en esa celda. */
  const open = (r: number, c: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    openTableEditor(id, r, c)
  }

  const cellText = (text: string, placeholder?: string): React.ReactNode =>
    text ? text : placeholder ? <span style={{ opacity: 0.45 }}>{placeholder}</span> : ' '

  const baseCell: CSSProperties = {
    padding: `${G.padY}px ${G.padX}px`,
    fontSize: g.cellSize,
    lineHeight: G.lineHeight,
    verticalAlign: 'top',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  }

  const renderCell = (r: number, c: number, text: string) => {
    const Tag = r === -1 ? 'th' : 'td'
    // Estilo de su columna, encima el de su fila y encima el suyo (ver cellStyleOf).
    const st = cellStyleOf(table, r, c)
    const doubtful = r >= 0 && isDoubtfulCell(ia, table, r, c)
    return (
      <Tag
        key={c}
        className={doubtful ? 'ia-celda' : undefined}
        style={{
          ...baseCell,
          fontWeight: st.bold ? 700 : 400,
          fontStyle: st.italic ? 'italic' : undefined,
          color: st.color ?? style.textColor,
          textAlign: st.align ?? 'left',
          borderLeft: c > 0 ? `1px solid ${grid}` : undefined,
          borderTop: `1px solid ${grid}`,
          background: st.fill,
        }}
        onDoubleClick={open(r, c)}
      >
        {cellText(text)}
      </Tag>
    )
  }

  const glow = selected
    ? `0 0 0 2px ${style.glowColor}, 0 0 20px ${style.glowColor}55`
    : t.isDark
      ? '0 6px 18px rgba(232,165,152,0.30), 0 2px 6px rgba(232,165,152,0.20)'
      : '0 2px 12px rgba(0,0,0,0.15)'

  return (
    <div
      className="node-body node-table"
      title="Doble clic para editar la tabla"
      style={{
        width: g.width,
        boxSizing: 'border-box',
        border: `${bw}px solid ${selected ? style.glowColor : accent}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: style.color,
        fontFamily: family,
        boxShadow: glow,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: accent,
          color: readableOn(accent),
          padding: `${G.titlePadY}px ${G.titlePadX}px`,
          fontSize,
          fontWeight: 700,
          lineHeight: G.lineHeight,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
        onDoubleClick={open(-2, 0)}
      >
        {cellText(table.title, 'Sin título')}
      </div>
      <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: g.width - 2 * bw }}>
        <colgroup>
          {g.colW.map((w, j) => (
            <col key={j} style={{ width: w }} />
          ))}
        </colgroup>
        <thead style={{ background: withAlpha(accent, 0.14) }}>
          <tr>{table.columns.map((text, j) => renderCell(-1, j, text))}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>{row.map((text, j) => renderCell(i, j, text))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const TableBody = memo(TableBodyInner)
