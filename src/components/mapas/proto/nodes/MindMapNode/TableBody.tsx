import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Paintbrush,
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
  cellStyleOf,
  setCellStyle,
  setColStyle,
  setRowStyle,
  type CellStyle,
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
        if (useMindMapStore.getState().editingNodeId === id && (!cur || (cur.r === r && cur.c === c))) {
          setMenuEstilo(null)
          stopTableEdit()
        }
        return
      }
      case 'exit':
        setMenuEstilo(null)
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
    // Estilo de su columna y, encima, el de su fila (ver cellStyleOf).
    const st = cellStyleOf(table, r, c)
    return (
      <Tag
        key={c}
        style={{
          ...baseCell,
          fontWeight: st.bold ? 700 : 400,
          fontStyle: st.italic ? 'italic' : undefined,
          color: st.color ?? style.textColor,
          textAlign: st.align ?? 'left',
          borderLeft: c > 0 ? `1px solid ${grid}` : undefined,
          borderTop: `1px solid ${grid}`,
          background: st.fill ?? (isActive ? withAlpha(accent, 0.12) : undefined),
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
  // Menú de estilo de la celda activa, de su fila o de su columna (se cierra al salir de la tabla).
  const [menuAbierto, setMenuEstilo] = useState<Alcance | null>(null)
  const menuEstilo = editingCell ? menuAbierto : null
  const estiloFila = ar === null ? undefined : ar < 0 ? table.headerStyle : table.rowStyles?.[ar] ?? undefined
  const estiloColumna = ac === null ? undefined : table.colStyles?.[ac] ?? undefined
  const estiloCelda = ar === null || ac === null ? undefined : table.cellStyles?.[ar + 1]?.[ac] ?? undefined
  const cambiarEstilo = (cambio: Partial<CellStyle> | null) => {
    if (ar === null || ac === null) return
    if (menuEstilo === 'celda') editTable(id, (x) => setCellStyle(x, ar, ac, cambio))
    else if (menuEstilo === 'fila') editTable(id, (x) => setRowStyle(x, ar, cambio))
    else if (menuEstilo === 'columna') editTable(id, (x) => setColStyle(x, ac, cambio))
  }
  // Negrita que se ve ahora en ese alcance (la cabecera lo es salvo que se le quite).
  const negritaDe = (a: Alcance) =>
    a === 'celda'
      ? ar !== null && ac !== null && cellStyleOf(table, ar, ac).bold === true
      : a === 'fila'
        ? estiloFila?.bold ?? ar === -1
        : estiloColumna?.bold === true

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
            position: 'relative',
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
          <Sep t={t} />
          <Btn title="Estilo de la celda, la fila o la columna" activo={!!menuEstilo} onClick={() => setMenuEstilo((m) => (m ? null : 'celda'))} t={t}>
            <Paintbrush size={13} />
            <span style={{ fontSize: 11 }}>estilo</span>
          </Btn>
          {menuEstilo && (
            <MenuEstilo
              alcance={menuEstilo}
              onAlcance={setMenuEstilo}
              rotulos={{
                celda: 'Celda',
                fila: ar === -1 ? 'Cabecera' : `Fila ${(ar ?? 0) + 1}`,
                columna: `Columna ${(ac ?? 0) + 1}`,
              }}
              estilo={(menuEstilo === 'celda' ? estiloCelda : menuEstilo === 'fila' ? estiloFila : estiloColumna) ?? {}}
              negrita={negritaDe(menuEstilo)}
              onCambio={cambiarEstilo}
              t={t}
            />
          )}
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
  activo,
  t,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  /** Botón que conmuta algo y está encendido. */
  activo?: boolean
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
      aria-pressed={activo}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        background: activo ? t.hoverBg : 'none',
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
        e.currentTarget.style.background = activo ? t.hoverBg : 'none'
      }}
    >
      {children}
    </button>
  )
}

// Colores rápidos: letra legible sobre blanco y fondos suaves (con unos pocos fuertes para
// resaltar). «Auto» quita el ajuste y vuelve al de la tabla.
const LETRAS = ['#2A2420', '#7D8A96', '#B04A5E', '#B07A1E', '#4F7A4C', '#3F6E9A', '#6F5A99', '#FFFFFF']
const FONDOS = ['#FCEFEC', '#FBF3E1', '#EDF3EC', '#EAF2F9', '#F1ECF7', '#F1F3F5', '#E8A598', '#D9A441', '#8BA888', '#6E9BC5']

type Alcance = 'celda' | 'fila' | 'columna'

/**
 * Menú de estilo de la celda activa, de su fila o de su columna: negrita, cursiva, alineación,
 * letra y fondo. En una celda manda lo más concreto: columna < fila < celda.
 */
function MenuEstilo({
  alcance,
  onAlcance,
  rotulos,
  estilo,
  negrita,
  onCambio,
  t,
}: {
  alcance: Alcance
  onAlcance: (a: Alcance) => void
  rotulos: Record<Alcance, string>
  /** Lo fijado en ese alcance (no lo heredado). */
  estilo: CellStyle
  /** Si ahora se ve en negrita (la cabecera lo es por defecto). */
  negrita: boolean
  onCambio: (cambio: Partial<CellStyle> | null) => void
  t: Theme
}) {
  const titulo = rotulos[alcance]
  const muestra = (color: string, activo: boolean, onClick: () => void, etiqueta: string) => (
    <button
      key={color}
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      aria-pressed={activo}
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        background: color,
        border: `2px solid ${activo ? t.accent : t.border}`,
        cursor: 'pointer',
        padding: 0,
      }}
    />
  )
  const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }
  const rotulo: CSSProperties = { fontSize: 10, fontWeight: 700, color: t.textMuted, width: 38, textTransform: 'uppercase' }
  return (
    <div
      role="dialog"
      aria-label={`Estilo: ${titulo}`}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        width: 238,
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        background: t.bgPanel,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: '8px 10px',
        boxShadow: `0 6px 20px ${t.shadow}`,
        color: t.textSecondary,
      }}
    >
      <div role="tablist" aria-label="Aplicar a" style={{ display: 'flex', gap: 2, background: t.hoverBg, borderRadius: 8, padding: 2 }}>
        {(['celda', 'fila', 'columna'] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={alcance === a}
            onClick={() => onAlcance(a)}
            style={{
              flex: 1,
              fontSize: 11,
              fontWeight: 700,
              border: 'none',
              borderRadius: 6,
              padding: '4px 0',
              cursor: 'pointer',
              background: alcance === a ? t.bgPanel : 'transparent',
              color: alcance === a ? t.textPrimary : t.textMuted,
              boxShadow: alcance === a ? `0 1px 3px ${t.shadow}` : 'none',
            }}
          >
            {rotulos[a]}
          </button>
        ))}
      </div>
      <div style={fila}>
        <Btn title="Negrita" activo={negrita} onClick={() => onCambio({ bold: !negrita })} t={t}>
          <Bold size={14} />
        </Btn>
        <Btn title="Cursiva" activo={!!estilo.italic} onClick={() => onCambio({ italic: estilo.italic ? undefined : true })} t={t}>
          <Italic size={14} />
        </Btn>
        <Sep t={t} />
        {(['left', 'center', 'right'] as const).map((a) => (
          <Btn
            key={a}
            title={a === 'left' ? 'Alinear a la izquierda' : a === 'center' ? 'Centrar' : 'Alinear a la derecha'}
            activo={(estilo.align ?? 'left') === a}
            onClick={() => onCambio({ align: a === 'left' ? undefined : a })}
            t={t}
          >
            {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
          </Btn>
        ))}
      </div>
      <div style={fila}>
        <span style={rotulo}>Letra</span>
        {LETRAS.map((c) => muestra(c, estilo.color === c, () => onCambio({ color: estilo.color === c ? undefined : c }), `Letra ${c}`))}
      </div>
      <div style={fila}>
        <span style={rotulo}>Fondo</span>
        {FONDOS.map((c) => muestra(c, estilo.fill === c, () => onCambio({ fill: estilo.fill === c ? undefined : c }), `Fondo ${c}`))}
      </div>
      <button
        type="button"
        onClick={() => onCambio(null)}
        style={{
          alignSelf: 'flex-start',
          fontSize: 11,
          fontWeight: 600,
          color: t.textSecondary,
          background: 'none',
          border: `1px solid ${t.border}`,
          borderRadius: 7,
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        Quitar estilo
      </button>
    </div>
  )
}

export const TableBody = memo(TableBodyInner)
