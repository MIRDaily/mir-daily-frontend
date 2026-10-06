import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Trash2,
} from 'lucide-react'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'
import { resolveFont } from '@/components/mapas/proto/utils/font'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { editTable, startTableEdit, stopTableEdit } from '@/components/mapas/proto/utils/tables'
import {
  estimateMeasure,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  removeColumn,
  removeRow,
  setCell,
  setTitle,
  tableGeometry,
  TABLE_GEOMETRY as G,
  type CellMeasure,
  type MapTable,
} from '@/lib/mapas/table'

// Nodo tabla: franja de título con el color de la categoría, cabecera tintada y celdas que
// ajustan el texto. Los anchos de columna salen de `tableGeometry` (la misma cuenta que usan el
// layout, la miniatura y el exportador). Las celdas se pintan como TEXTO de React, nunca como
// HTML. Se edita en el sitio: doble clic en una celda; Tab/flechas para moverse; Alt+flechas
// para mover la fila o la columna.

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

// ---- colores ---------------------------------------------------------------------------------

function rgb(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1]
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function withAlpha(color: string, a: number): string {
  const c = rgb(color)
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : `rgba(125,138,150,${a})`
}

/** Letra blanca u oscura según lo claro que sea el fondo. */
function readableOn(color: string): string {
  const c = rgb(color)
  if (!c) return '#FFFFFF'
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.62 ? '#2A2420' : '#FFFFFF'
}

// ---- editor de una celda ---------------------------------------------------------------------

type Move = 'next' | 'prev' | 'up' | 'down' | 'enter' | 'exit' | 'blur' | 'rowUp' | 'rowDown' | 'colLeft' | 'colRight'

/** Lo que la barra de la tabla necesita del editor abierto: su texto y poder cerrarlo sin efectos. */
type ActiveEditor = { value: () => string; close: () => void }

interface CellEditorProps {
  initial: string
  seed: string | null
  /** Empezar con todo el texto seleccionado. */
  selectAll: boolean
  multiline: boolean
  style: CSSProperties
  onDone: (value: string, move: Move) => void
  register: (api: ActiveEditor | null) => void
}

function CellEditor({ initial, seed, selectAll, multiline, style, onDone, register }: CellEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  const value = useCallback(() => (ref.current?.innerText ?? '').replace(/\n+$/, ''), [])
  const finish = useCallback(
    (move: Move) => {
      if (done.current) return
      done.current = true
      onDone(value(), move)
    },
    [onDone, value],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = seed ?? initial
    register({
      value,
      close: () => {
        done.current = true
      },
    })
    // Como en NodeEditor: el nodo puede no estar visible aún; se reintenta el foco un momento.
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const focusNow = () => {
      el.focus()
      if (document.activeElement !== el) {
        if (tries++ < 30) timer = setTimeout(focusNow, 16)
        return
      }
      const range = document.createRange()
      range.selectNodeContents(el)
      if (!selectAll || seed != null) range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    focusNow()
    return () => {
      clearTimeout(timer)
      register(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Posición del cursor: si está al principio/final del texto y en la primera/última línea. */
  const caret = () => {
    const el = ref.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return null
    const pre = range.cloneRange()
    pre.selectNodeContents(el)
    pre.setEnd(range.endContainer, range.endOffset)
    const offset = pre.toString().length
    const total = el.textContent?.length ?? 0
    const r = range.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    const known = r.height > 0
    return {
      start: offset === 0,
      end: offset >= total,
      firstLine: !known || r.top - box.top < r.height * 0.9,
      lastLine: !known || box.bottom - r.bottom < r.height * 0.9,
    }
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Celda de la tabla"
      className="nodrag nopan"
      style={{ ...style, outline: 'none', cursor: 'text', minHeight: '1em' }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => finish('blur')}
      onPaste={(e) => {
        // Solo texto plano: nada de HTML pegado de otra web.
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n\s*/g, ' '))
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        const k = e.key
        if (k === 'Escape') {
          e.preventDefault()
          finish('exit')
        } else if (k === 'Tab') {
          e.preventDefault()
          finish(e.shiftKey ? 'prev' : 'next')
        } else if (k === 'Enter' && (!e.shiftKey || !multiline)) {
          e.preventDefault()
          finish('enter')
        } else if (e.altKey && !e.ctrlKey && !e.metaKey && k.startsWith('Arrow')) {
          e.preventDefault()
          finish(k === 'ArrowUp' ? 'rowUp' : k === 'ArrowDown' ? 'rowDown' : k === 'ArrowLeft' ? 'colLeft' : 'colRight')
        } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey && k.startsWith('Arrow')) {
          const c = caret()
          if (!c) return
          const move: Move | null =
            k === 'ArrowUp' && c.firstLine ? 'up'
              : k === 'ArrowDown' && c.lastLine ? 'down'
                : k === 'ArrowLeft' && c.start ? 'prev'
                  : k === 'ArrowRight' && c.end ? 'next'
                    : null
          if (move) {
            e.preventDefault()
            finish(move)
          }
        }
      }}
    />
  )
}

// ---- la tabla --------------------------------------------------------------------------------

interface TableBodyProps {
  id: string
  table: MapTable
  style: NodeStyle
  selected: boolean
  editing: boolean
}

function TableBodyInner({ id, table: fromProps, style, selected, editing }: TableBodyProps) {
  const t = useTheme()
  // La tabla se lee de la store, no solo de las props: React Flow pasa los datos del nodo un
  // ciclo después, y una celda abierta justo tras mover una fila arrancaba con el texto viejo (y
  // al cerrarse lo guardaba encima del nuevo).
  const live = useMindMapStore((s) => s.nodes.find((n) => n.id === id)?.data.table)
  const table = live ?? fromProps
  const cell = useUIStore((s) => (editing && s.tableCell?.id === id ? s.tableCell : null))
  const seed = useMindMapStore((s) => (s.editingNodeId === id ? s.editSeed : null))
  // Edición abierta sin celda (F2, o escribir con la tabla seleccionada): la primera cabecera.
  const ar = editing ? cell?.r ?? -1 : null
  const ac = editing ? cell?.c ?? 0 : null
  const rev = cell?.rev ?? 0
  const select = !!cell?.select
  const active = useRef<ActiveEditor | null>(null)
  const register = useCallback((api: ActiveEditor | null) => {
    active.current = api
  }, [])

  const fontSize = style.fontSize ?? 14
  const family = resolveFont(style.fontFamily)
  const measure = useMemo(() => measurerFor(family), [family])
  const bw = Math.max(1, style.borderWidth)
  const g = useMemo(() => tableGeometry(table, measure, fontSize, bw), [table, measure, fontSize, bw])

  const accent = style.borderWidth > 0 ? style.borderColor : style.color
  const grid = withAlpha(accent, 0.38)

  const latest = () => useMindMapStore.getState().nodes.find((n) => n.id === id)?.data.table ?? table
  const commit = (r: number, c: number, value: string) =>
    editTable(id, (tb) => (r === -2 ? setTitle(tb, value) : setCell(tb, r, c, value)))

  // Con el teclado se llega con el contenido seleccionado; con doble clic, el cursor al final.
  const go = (r: number, c: number) => startTableEdit(id, r, c, null, true)
  const open = (r: number, c: number) => startTableEdit(id, r, c)

  const onDone = (r: number, c: number, value: string, move: Move) => {
    commit(r, c, value)
    const tb = latest()
    const rows = tb.rows.length
    const cols = tb.columns.length
    switch (move) {
      case 'blur': {
        // Se ha pulsado fuera: termina la edición (si nadie ha abierto ya otra celda).
        const cur = useUIStore.getState().tableCell
        if (useMindMapStore.getState().editingNodeId === id && (!cur || (cur.r === r && cur.c === c))) stopTableEdit()
        return
      }
      case 'exit':
        return stopTableEdit()
      case 'next':
        if (r === -2) return go(-1, 0)
        if (c + 1 < cols) return go(r, c + 1)
        if (r + 1 < rows) return go(r + 1, 0)
        // Tab en la última celda: fila nueva, como en un procesador de textos.
        editTable(id, (x) => insertRow(x, x.rows.length))
        return latest().rows.length > rows ? go(rows, 0) : go(r, c)
      case 'prev':
        if (r === -2) return go(-2, 0)
        if (c > 0) return go(r, c - 1)
        if (r >= 0) return go(r - 1, cols - 1)
        return go(-2, 0)
      case 'up':
        return r === -1 ? go(-2, 0) : r >= 0 ? go(r - 1, c) : go(r, c)
      case 'down':
        return r === -2 ? go(-1, 0) : r + 1 < rows ? go(r + 1, c) : go(r, c)
      case 'enter':
        if (r === -2) return go(-1, 0)
        return r + 1 < rows ? go(r + 1, c) : stopTableEdit()
      case 'rowUp':
      case 'rowDown': {
        const dir = move === 'rowUp' ? -1 : 1
        if (r < 0 || r + dir < 0 || r + dir >= rows) return go(r, c)
        editTable(id, (x) => moveRow(x, r, dir))
        return go(r + dir, c)
      }
      case 'colLeft':
      case 'colRight': {
        const dir = move === 'colLeft' ? -1 : 1
        if (r === -2 || c + dir < 0 || c + dir >= cols) return go(r, c)
        editTable(id, (x) => moveColumn(x, c, dir))
        return go(r, c + dir)
      }
    }
  }

  /** Operación de la barra: guarda lo escrito, cambia la estructura y deja el cursor donde toca. */
  const op = (fn: (x: MapTable, r: number, c: number) => MapTable, next: (x: MapTable, r: number, c: number) => [number, number]) => {
    if (ar === null || ac === null) return
    const editor = active.current
    if (editor) {
      editor.close()
      commit(ar, ac, editor.value())
    }
    editTable(id, (x) => fn(x, ar, ac))
    const [nr, nc] = next(latest(), ar, ac)
    // Aunque sea la misma celda, con otro contenido (p. ej. tras borrar una fila): go() la reabre.
    go(nr, nc)
  }

  const cellText = (text: string, placeholder?: string): React.ReactNode =>
    text ? text : placeholder ? <span style={{ opacity: 0.45 }}>{placeholder}</span> : ' '

  const baseCell: CSSProperties = {
    padding: `${G.padY}px ${G.padX}px`,
    fontSize: g.cellSize,
    lineHeight: G.lineHeight,
    textAlign: 'left',
    verticalAlign: 'top',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    color: style.textColor,
  }
  const editorStyle: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }

  const renderCell = (r: number, c: number, text: string) => {
    const isActive = ar === r && ac === c
    const Tag = r === -1 ? 'th' : 'td'
    return (
      <Tag
        key={c}
        style={{
          ...baseCell,
          fontWeight: r === -1 ? 700 : 400,
          borderLeft: c > 0 ? `1px solid ${grid}` : undefined,
          borderTop: `1px solid ${grid}`,
          background: isActive ? withAlpha(accent, 0.12) : undefined,
          boxShadow: isActive ? `inset 0 0 0 2px ${accent}` : undefined,
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          open(r, c)
        }}
      >
        {isActive ? (
          <CellEditor
            key={`${r}:${c}:${rev}`}
            initial={text}
            seed={seed}
            selectAll={select}
            multiline
            style={editorStyle}
            register={register}
            onDone={(v, m) => onDone(r, c, v, m)}
          />
        ) : (
          cellText(text)
        )}
      </Tag>
    )
  }

  const glow = selected
    ? `0 0 0 2px ${style.glowColor}, 0 0 20px ${style.glowColor}55`
    : t.isDark
      ? '0 6px 18px rgba(232,165,152,0.30), 0 2px 6px rgba(232,165,152,0.20)'
      : '0 2px 12px rgba(0,0,0,0.15)'

  const titleActive = ar === -2
  const editingCell = ar !== null && ar >= -1 && ac !== null

  return (
    <>
      <div
        className="node-body node-table"
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
            boxShadow: titleActive ? 'inset 0 0 0 2px rgba(255,255,255,0.75)' : undefined,
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            open(-2, 0)
          }}
        >
          {titleActive ? (
            <CellEditor
              key={`title:${rev}`}
              initial={table.title}
              seed={seed}
              selectAll={select}
              multiline={false}
              style={editorStyle}
              register={register}
              onDone={(v, m) => onDone(-2, 0, v, m)}
            />
          ) : (
            cellText(table.title, 'Sin título')
          )}
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

      {/* Barra de la tabla mientras se edita una celda: filas y columnas. No roba el foco. */}
      <NodeToolbar isVisible={editingCell} position={Position.Top} offset={10}>
        <div
          className="nodrag nopan"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: '3px 5px',
            boxShadow: `0 4px 16px ${t.shadow}`,
          }}
        >
          <Btn title="Insertar fila encima" disabled={ar === -1} onClick={() => op((x, r) => insertRow(x, r), (_, r, c) => [r, c])} t={t}>
            <BetweenHorizontalStart size={14} />
          </Btn>
          <Btn title="Insertar fila debajo" onClick={() => op((x, r) => insertRow(x, r + 1), (_, r, c) => [r + 1, c])} t={t}>
            <BetweenHorizontalEnd size={14} />
          </Btn>
          <Btn title="Insertar columna a la izquierda" onClick={() => op((x, _r, c) => insertColumn(x, c), (_, r, c) => [r, c])} t={t}>
            <BetweenVerticalStart size={14} />
          </Btn>
          <Btn title="Insertar columna a la derecha" onClick={() => op((x, _r, c) => insertColumn(x, c + 1), (x, r, c) => [r, Math.min(c + 1, x.columns.length - 1)])} t={t}>
            <BetweenVerticalEnd size={14} />
          </Btn>
          <Sep t={t} />
          <Btn title="Subir la fila (Alt+↑)" disabled={ar === null || ar <= 0} onClick={() => op((x, r) => moveRow(x, r, -1), (_, r, c) => [r - 1, c])} t={t}>
            <ChevronUp size={14} />
          </Btn>
          <Btn title="Bajar la fila (Alt+↓)" disabled={ar === null || ar < 0 || ar >= table.rows.length - 1} onClick={() => op((x, r) => moveRow(x, r, 1), (_, r, c) => [r + 1, c])} t={t}>
            <ChevronDown size={14} />
          </Btn>
          <Btn title="Mover la columna a la izquierda (Alt+←)" disabled={!ac} onClick={() => op((x, _r, c) => moveColumn(x, c, -1), (_, r, c) => [r, c - 1])} t={t}>
            <ChevronLeft size={14} />
          </Btn>
          <Btn title="Mover la columna a la derecha (Alt+→)" disabled={ac === null || ac >= table.columns.length - 1} onClick={() => op((x, _r, c) => moveColumn(x, c, 1), (_, r, c) => [r, c + 1])} t={t}>
            <ChevronRight size={14} />
          </Btn>
          <Sep t={t} />
          <Btn
            title="Borrar la fila"
            danger
            disabled={ar === null || ar < 0}
            onClick={() => op((x, r) => removeRow(x, r), (x, r, c) => (x.rows.length ? [Math.min(r, x.rows.length - 1), c] : [-1, c]))}
            t={t}
          >
            <Trash2 size={13} />
            <span style={{ fontSize: 11 }}>fila</span>
          </Btn>
          <Btn
            title="Borrar la columna"
            danger
            disabled={table.columns.length <= 1}
            onClick={() => op((x, _r, c) => removeColumn(x, c), (x, r, c) => [r, Math.min(c, x.columns.length - 1)])}
            t={t}
          >
            <Trash2 size={13} />
            <span style={{ fontSize: 11 }}>col.</span>
          </Btn>
        </div>
      </NodeToolbar>
    </>
  )
}

type Theme = ReturnType<typeof useTheme>

function Sep({ t }: { t: Theme }) {
  return <span aria-hidden style={{ width: 1, height: 18, background: t.border, margin: '0 3px' }} />
}

function Btn({
  title,
  onClick,
  disabled,
  danger,
  t,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  t: Theme
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        background: 'none',
        border: 'none',
        borderRadius: 7,
        padding: '5px 6px',
        cursor: disabled ? 'default' : 'pointer',
        color: danger ? t.danger : t.textSecondary,
        opacity: disabled ? 0.35 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = t.hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
      }}
    >
      {children}
    </button>
  )
}

export const TableBody = memo(TableBodyInner)
