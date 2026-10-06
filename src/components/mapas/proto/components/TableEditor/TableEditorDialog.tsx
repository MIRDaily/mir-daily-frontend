import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Italic,
  Paintbrush,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { editTable } from '@/components/mapas/proto/utils/tables'
import { resolveFont } from '@/components/mapas/proto/utils/font'
import { readableOn, tableAccent, withAlpha } from '@/components/mapas/proto/utils/tableColors'
import type { TableEditorTarget } from '@/components/mapas/proto/types/store.types'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'
import {
  cellStyleOf,
  cleanCell,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  parseClipboardGrid,
  pasteGrid,
  removeColumn,
  removeRow,
  setCell,
  setCellStyle,
  setColStyle,
  setRowStyle,
  setTitle,
  tableChars,
  TABLE_LIMITS,
  type CellStyle,
  type MapTable,
} from '@/lib/mapas/table'

// Popup de edición de una tabla. Trabaja sobre una copia: al cerrarlo (Hecho, Esc o clic fuera) la
// guarda en el mapa como UN paso de deshacer; «Descartar» la tira. Dentro tiene su propio
// deshacer (Ctrl+Z / Ctrl+Y). La rejilla va a tamaño fijo y legible, sin depender del zoom del
// lienzo. Se mueve como antes en el nodo: Tab, Enter y flechas; Alt+flechas mueve la fila o la
// columna. Pegar celdas de Excel o Word las reparte desde la celda activa.

type Theme = ReturnType<typeof useTheme>

const same = (a: MapTable, b: MapTable) => JSON.stringify(a) === JSON.stringify(b)
const MAX_HISTORY = 200

export function TableEditorDialog() {
  const target = useUIStore((s) => s.tableEditor)
  return <AnimatePresence>{target && <EditorBody key={target.id} target={target} />}</AnimatePresence>
}

// ---- editor de una celda ---------------------------------------------------------------------

type Move = 'next' | 'prev' | 'up' | 'down' | 'enter' | 'save' | 'undo' | 'redo' | 'rowUp' | 'rowDown' | 'colLeft' | 'colRight'

/** Lo que el popup necesita del editor abierto: su texto y poder soltarlo sin efectos. */
type ActiveEditor = { value: () => string; close: () => void }

interface CellEditorProps {
  initial: string
  seed: string | null
  /** Empezar con todo el texto seleccionado. */
  selectAll: boolean
  multiline: boolean
  /** Sale de la celda con una tecla: guarda y se mueve. */
  onMove: (value: string, move: Move) => void
  /** Pierde el foco (clic en otro sitio): solo guarda. */
  onCommit: (value: string) => void
  /** Pegado de varias celdas (Excel, Word). Sin esto, se pega como texto. */
  onGrid?: (value: string, grid: string[][]) => void
  register: (api: ActiveEditor | null) => void
}

function CellEditor({ initial, seed, selectAll, multiline, onMove, onCommit, onGrid, register }: CellEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  const value = useCallback(() => (ref.current?.innerText ?? '').replace(/\n+$/, ''), [])
  const finish = (move: Move) => {
    if (done.current) return
    done.current = true
    onMove(value(), move)
  }

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
    // El popup entra con una animación: se reintenta el foco un momento si aún no lo coge.
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
      aria-multiline={multiline}
      style={{ outline: 'none', cursor: 'text', minHeight: '1.35em', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      onBlur={() => {
        if (!done.current) onCommit(value())
      }}
      onPaste={(e) => {
        // Solo texto plano: nada de HTML pegado de otra web (el HTML solo dice si era una tabla).
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        if (onGrid) {
          const grid = parseClipboardGrid(text)
          const esTabla = text.includes('\t') || /<table[\s>]/i.test(e.clipboardData.getData('text/html'))
          if (esTabla && (grid.length > 1 || (grid[0]?.length ?? 0) > 1)) {
            done.current = true
            onGrid(value(), grid)
            return
          }
        }
        const limpio = text.replace(/[\r\n]+$/, '')
        document.execCommand('insertText', false, multiline ? limpio : limpio.replace(/\s*\n\s*/g, ' '))
      }}
      onKeyDown={(e) => {
        const k = e.key
        const mod = e.ctrlKey || e.metaKey
        if (mod && !e.altKey && k.toLowerCase() === 'z') {
          e.preventDefault()
          finish(e.shiftKey ? 'redo' : 'undo')
        } else if (mod && !e.altKey && k.toLowerCase() === 'y') {
          e.preventDefault()
          finish('redo')
        } else if (mod && k === 'Enter') {
          e.preventDefault()
          finish('save')
        } else if (k === 'Tab') {
          e.preventDefault()
          finish(e.shiftKey ? 'prev' : 'next')
        } else if (k === 'Enter' && (!e.shiftKey || !multiline)) {
          e.preventDefault()
          finish('enter')
        } else if (e.altKey && !mod && k.startsWith('Arrow')) {
          e.preventDefault()
          finish(k === 'ArrowUp' ? 'rowUp' : k === 'ArrowDown' ? 'rowDown' : k === 'ArrowLeft' ? 'colLeft' : 'colRight')
        } else if (!e.shiftKey && !mod && k.startsWith('Arrow')) {
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

// ---- el popup --------------------------------------------------------------------------------

type History = { draft: MapTable; past: MapTable[]; future: MapTable[] }
/** Celda activa (fila -2 = título, -1 = cabecera). `rev` sube en cada apertura: reabre el editor. */
type Active = { r: number; c: number; rev: number; select: boolean; seed: string | null }
type Alcance = 'celda' | 'fila' | 'columna'

/** La celda (r, c) dentro de la tabla, por si ha encogido. */
function clamp(t: MapTable, r: number, c: number): [number, number] {
  const rr = r < -1 ? r : Math.min(r, t.rows.length - 1)
  return [rr, r < -1 ? 0 : Math.max(0, Math.min(c, t.columns.length - 1))]
}

function EditorBody({ target }: { target: TableEditorTarget }) {
  const t = useTheme()
  // La tabla y su aspecto se leen una vez al abrir: el popup trabaja sobre su copia.
  const [inicio] = useState(() => {
    const node = useMindMapStore.getState().nodes.find((n) => n.id === target.id)
    return node?.data.table ? { table: node.data.table, style: node.data.style } : null
  })

  const [hist, setHistState] = useState<History>(() => ({ draft: inicio?.table ?? { title: '', columns: [''], rows: [] }, past: [], future: [] }))
  const histRef = useRef(hist)
  const setHist = (next: History) => {
    histRef.current = next
    setHistState(next)
  }

  const [active, setActiveState] = useState<Active>(() => {
    const [r, c] = inicio ? clamp(inicio.table, target.r, target.c) : [-1, 0]
    return { r, c, rev: 0, select: target.select, seed: target.seed }
  })
  const activeRef = useRef(active)
  const go = (r: number, c: number, select = true) => {
    const next = { r, c, rev: activeRef.current.rev + 1, select, seed: null }
    activeRef.current = next
    setActiveState(next)
  }

  const editor = useRef<ActiveEditor | null>(null)
  const register = useCallback((api: ActiveEditor | null) => {
    editor.current = api
  }, [])

  const [menu, setMenu] = useState<Alcance | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const avisar = (texto: string) => {
    setAviso(texto)
    clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(null), 6000)
  }
  const closed = useRef(false)

  /** Cambia la copia con un paso de deshacer del popup. No hace nada si no cambia. */
  const change = (fn: (x: MapTable) => MapTable) => {
    const h = histRef.current
    const next = fn(h.draft)
    if (next === h.draft || same(next, h.draft)) return
    setHist({ draft: next, past: [...h.past, h.draft].slice(-MAX_HISTORY), future: [] })
  }

  const commitAt = (r: number, c: number, value: string) => {
    change((x) => (r === -2 ? setTitle(x, value) : setCell(x, r, c, value)))
    const d = histRef.current.draft
    const puesto = r === -2 ? d.title : r === -1 ? d.columns[c] : d.rows[r]?.[c]
    if (puesto !== undefined && puesto.length < cleanCell(value, r === -2 ? TABLE_LIMITS.maxTitle : TABLE_LIMITS.maxCell, r === -2 ? 0 : TABLE_LIMITS.maxBreaks).length)
      avisar(`No cabe más texto: una tabla admite hasta ${TABLE_LIMITS.maxTotal} caracteres.`)
  }

  /** Guarda lo escrito en la celda activa. `soltar`: el editor se va a cerrar (no guardará al salir). */
  const guardarEditor = (soltar: boolean) => {
    const ed = editor.current
    if (!ed) return
    if (soltar) ed.close()
    const { r, c } = activeRef.current
    commitAt(r, c, ed.value())
  }

  const cerrar = (guardar: boolean) => {
    if (closed.current) return
    closed.current = true
    if (guardar) {
      guardarEditor(true)
      const final = histRef.current.draft
      editTable(target.id, () => final)
    }
    clearTimeout(avisoTimer.current)
    useUIStore.getState().setTableEditor(null)
  }

  const historia = (dir: 'undo' | 'redo') => {
    guardarEditor(true)
    const h = histRef.current
    const { r, c } = activeRef.current
    if (dir === 'undo' && h.past.length) {
      setHist({ draft: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.draft, ...h.future] })
    } else if (dir === 'redo' && h.future.length) {
      setHist({ draft: h.future[0], past: [...h.past, h.draft], future: h.future.slice(1) })
    }
    const [nr, nc] = clamp(histRef.current.draft, r, c)
    go(nr, nc, false)
  }

  /** Clic en otra celda: guarda la abierta y abre esa con el cursor al final. */
  const abrir = (r: number, c: number) => {
    const a = activeRef.current
    if (a.r === r && a.c === c && editor.current) return
    guardarEditor(true)
    go(r, c, false)
  }

  const onMove = (r: number, c: number, value: string, move: Move) => {
    commitAt(r, c, value)
    const tb = histRef.current.draft
    const rows = tb.rows.length
    const cols = tb.columns.length
    switch (move) {
      case 'save':
        return cerrar(true)
      case 'undo':
      case 'redo':
        return historia(move)
      case 'next':
        if (r === -2) return go(-1, 0)
        if (c + 1 < cols) return go(r, c + 1)
        if (r + 1 < rows) return go(r + 1, 0)
        // Tab en la última celda: fila nueva, como en un procesador de textos.
        change((x) => insertRow(x, x.rows.length))
        return histRef.current.draft.rows.length > rows ? go(rows, 0) : go(r, c)
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
        return r + 1 < rows ? go(r + 1, c) : go(r, c, false)
      case 'rowUp':
      case 'rowDown': {
        const dir = move === 'rowUp' ? -1 : 1
        if (r < 0 || r + dir < 0 || r + dir >= rows) return go(r, c)
        change((x) => moveRow(x, r, dir))
        return go(r + dir, c)
      }
      case 'colLeft':
      case 'colRight': {
        const dir = move === 'colLeft' ? -1 : 1
        if (r === -2 || c + dir < 0 || c + dir >= cols) return go(r, c)
        change((x) => moveColumn(x, c, dir))
        return go(r, c + dir)
      }
    }
  }

  const onGrid = (r: number, c: number, value: string, grid: string[][]) => {
    commitAt(r, c, value)
    const { table, cut } = pasteGrid(histRef.current.draft, r, c, grid)
    change(() => table)
    if (cut)
      avisar(`Parte de lo pegado no cabe: hasta ${TABLE_LIMITS.maxColumns} columnas, ${TABLE_LIMITS.maxRows} filas, ${TABLE_LIMITS.maxCell} caracteres por celda y ${TABLE_LIMITS.maxTotal} en toda la tabla.`)
    go(r, c, false)
  }

  /** Operación de la barra: guarda lo escrito, cambia la estructura y deja el cursor donde toca. */
  const op = (fn: (x: MapTable, r: number, c: number) => MapTable, next: (x: MapTable, r: number, c: number) => [number, number]) => {
    const { r, c } = activeRef.current
    if (r < -1) return
    guardarEditor(true)
    change((x) => fn(x, r, c))
    const [nr, nc] = next(histRef.current.draft, r, c)
    go(nr, nc)
  }

  // Teclado fuera de una celda (el foco en un botón): Esc guarda y cierra; Ctrl+Z / Ctrl+Y.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cerrar(true)
        return
      }
      if ((e.target as HTMLElement | null)?.isContentEditable) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        e.stopPropagation()
        historia(e.key.toLowerCase() === 'y' || e.shiftKey ? 'redo' : 'undo')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // La tabla ya no existe (no debería pasar: el lienzo queda tapado): se cierra sin más.
  useEffect(() => {
    if (!inicio) useUIStore.getState().setTableEditor(null)
  }, [inicio])
  useEffect(() => () => clearTimeout(avisoTimer.current), [])
  if (!inicio) return null

  const draft = hist.draft
  const style: NodeStyle = inicio.style
  const accent = tableAccent(style)
  const grid = withAlpha(accent, 0.38)
  const family = resolveFont(style.fontFamily)
  const { r: ar, c: ac } = active
  const enTitulo = ar === -2
  const rows = draft.rows.length
  const cols = draft.columns.length

  const descartar = () => {
    const ed = editor.current
    const d = histRef.current.draft
    const { r, c } = activeRef.current
    const enCelda = r === -2 ? d.title : r === -1 ? d.columns[c] : d.rows[r]?.[c]
    const cambios = !same(d, inicio.table) || (!!ed && ed.value().trim() !== (enCelda ?? '').trim())
    if (cambios && !confirmar) {
      setConfirmar(true)
      setTimeout(() => setConfirmar(false), 3500)
      return
    }
    cerrar(false)
  }

  // ---- estilo de la celda activa, su fila o su columna ----
  const estiloDe = (a: Alcance): CellStyle =>
    (a === 'celda'
      ? draft.cellStyles?.[ar + 1]?.[ac]
      : a === 'fila'
        ? ar < 0
          ? draft.headerStyle
          : draft.rowStyles?.[ar]
        : draft.colStyles?.[ac]) ?? {}
  const negritaDe = (a: Alcance) =>
    a === 'celda' ? cellStyleOf(draft, ar, ac).bold === true : a === 'fila' ? estiloDe('fila').bold ?? ar === -1 : estiloDe('columna').bold === true
  const cambiarEstilo = (cambio: Partial<CellStyle> | null) => {
    if (enTitulo || !menu) return
    // Lo escrito se guarda antes: así Ctrl+Z deshace los pasos en el orden en que se dieron.
    guardarEditor(false)
    if (menu === 'celda') change((x) => setCellStyle(x, ar, ac, cambio))
    else if (menu === 'fila') change((x) => setRowStyle(x, ar, cambio))
    else change((x) => setColStyle(x, ac, cambio))
  }

  const chars = tableChars(draft)
  const headerTint = withAlpha(accent, 0.14)

  const celda = (r: number, c: number, text: string) => {
    const st = cellStyleOf(draft, r, c)
    const activa = ar === r && ac === c
    const Tag = r === -1 ? 'th' : 'td'
    const cabecera = r === -1
    const fondo: CSSProperties = st.fill
      ? { background: st.fill }
      : cabecera
        ? // La cabecera se queda fija al bajar: necesita fondo opaco.
          { backgroundColor: style.color, backgroundImage: `linear-gradient(${headerTint}, ${headerTint})` }
        : {}
    return (
      <Tag
        key={c}
        onMouseDown={(e) => {
          if (activa) return
          e.preventDefault()
          abrir(r, c)
        }}
        style={{
          padding: '8px 10px',
          minWidth: 96,
          verticalAlign: 'top',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          lineHeight: 1.35,
          fontWeight: st.bold ? 700 : 400,
          fontStyle: st.italic ? 'italic' : undefined,
          color: st.color ?? style.textColor,
          textAlign: st.align ?? 'left',
          borderLeft: c > 0 ? `1px solid ${grid}` : undefined,
          borderTop: r === 0 ? undefined : `1px solid ${grid}`,
          borderBottom: cabecera ? `1px solid ${grid}` : undefined,
          cursor: 'text',
          ...fondo,
          ...(activa ? { boxShadow: `inset 0 0 0 2px ${accent}`, ...(st.fill ? {} : { backgroundImage: `linear-gradient(${withAlpha(accent, 0.1)}, ${withAlpha(accent, 0.1)})` }) } : {}),
          ...(cabecera ? { position: 'sticky', top: 0, zIndex: 1 } : {}),
        }}
      >
        {activa ? (
          <CellEditor
            key={`${r}:${c}:${active.rev}`}
            initial={text}
            seed={active.seed}
            selectAll={active.select}
            multiline
            register={register}
            onMove={(v, m) => onMove(r, c, v, m)}
            onCommit={(v) => commitAt(r, c, v)}
            onGrid={(v, g) => onGrid(r, c, v, g)}
          />
        ) : (
          text || ' '
        )}
      </Tag>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar(true)
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        // El hueco del panel del tutorial, pero dejando siempre sitio para la tabla (en un móvil).
        left: 'max(0px, min(var(--mapa-inset-left, 0px), 100% - 360px))',
        zIndex: 1500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(0px, 2vw, 16px)',
        background: 'rgba(42,36,32,0.32)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Editar la tabla"
        data-tuto="table-editor"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: 6, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        style={{
          width: 1100,
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: t.bgPanel,
          border: `1px solid ${t.border}`,
          borderRadius: 18,
          boxShadow: `0 16px 60px ${t.shadow}`,
          overflow: 'hidden',
        }}
      >
        {/* Cabecera del popup */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 8px' }}>
          <div style={{ color: t.textPrimary, fontWeight: 700, fontSize: 15 }}>Editar tabla</div>
          <button
            type="button"
            onClick={() => cerrar(true)}
            title="Guardar y cerrar (Esc)"
            aria-label="Guardar y cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Barra: no le quita el foco a la celda. */}
        <div
          role="toolbar"
          aria-label="Filas, columnas y estilo"
          onMouseDown={(e) => e.preventDefault()}
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, padding: '0 14px 10px' }}
        >
          <Btn title="Deshacer (Ctrl+Z)" disabled={!hist.past.length} onClick={() => historia('undo')} t={t}>
            <Undo2 size={14} />
          </Btn>
          <Btn title="Rehacer (Ctrl+Y)" disabled={!hist.future.length} onClick={() => historia('redo')} t={t}>
            <Redo2 size={14} />
          </Btn>
          <Sep t={t} />
          <Btn title="Insertar fila encima" disabled={ar < 0 || rows >= TABLE_LIMITS.maxRows} onClick={() => op((x, r) => insertRow(x, r), (_, r, c) => [r, c])} t={t}>
            <BetweenHorizontalStart size={14} />
          </Btn>
          <Btn title="Insertar fila debajo" disabled={enTitulo || rows >= TABLE_LIMITS.maxRows} onClick={() => op((x, r) => insertRow(x, r + 1), (_, r, c) => [r + 1, c])} t={t}>
            <BetweenHorizontalEnd size={14} />
          </Btn>
          <Btn title="Insertar columna a la izquierda" disabled={enTitulo || cols >= TABLE_LIMITS.maxColumns} onClick={() => op((x, _r, c) => insertColumn(x, c), (_, r, c) => [r, c])} t={t}>
            <BetweenVerticalStart size={14} />
          </Btn>
          <Btn
            title="Insertar columna a la derecha"
            disabled={enTitulo || cols >= TABLE_LIMITS.maxColumns}
            onClick={() => op((x, _r, c) => insertColumn(x, c + 1), (x, r, c) => [r, Math.min(c + 1, x.columns.length - 1)])}
            t={t}
          >
            <BetweenVerticalEnd size={14} />
          </Btn>
          <Sep t={t} />
          <Btn title="Subir la fila (Alt+↑)" disabled={ar <= 0} onClick={() => op((x, r) => moveRow(x, r, -1), (_, r, c) => [r - 1, c])} t={t}>
            <ChevronUp size={14} />
          </Btn>
          <Btn title="Bajar la fila (Alt+↓)" disabled={ar < 0 || ar >= rows - 1} onClick={() => op((x, r) => moveRow(x, r, 1), (_, r, c) => [r + 1, c])} t={t}>
            <ChevronDown size={14} />
          </Btn>
          <Btn title="Mover la columna a la izquierda (Alt+←)" disabled={enTitulo || ac === 0} onClick={() => op((x, _r, c) => moveColumn(x, c, -1), (_, r, c) => [r, c - 1])} t={t}>
            <ChevronLeft size={14} />
          </Btn>
          <Btn title="Mover la columna a la derecha (Alt+→)" disabled={enTitulo || ac >= cols - 1} onClick={() => op((x, _r, c) => moveColumn(x, c, 1), (_, r, c) => [r, c + 1])} t={t}>
            <ChevronRight size={14} />
          </Btn>
          <Sep t={t} />
          <Btn
            title="Borrar la fila"
            danger
            disabled={ar < 0}
            onClick={() => op((x, r) => removeRow(x, r), (x, r, c) => (x.rows.length ? [Math.min(r, x.rows.length - 1), c] : [-1, c]))}
            t={t}
          >
            <Trash2 size={13} />
            <span style={{ fontSize: 11 }}>fila</span>
          </Btn>
          <Btn
            title="Borrar la columna"
            danger
            disabled={enTitulo || cols <= 1}
            onClick={() => op((x, _r, c) => removeColumn(x, c), (x, r, c) => [r, Math.min(c, x.columns.length - 1)])}
            t={t}
          >
            <Trash2 size={13} />
            <span style={{ fontSize: 11 }}>col.</span>
          </Btn>
          <Sep t={t} />
          <div style={{ position: 'relative' }}>
            <Btn title="Estilo de la celda, la fila o la columna" disabled={enTitulo} activo={!!menu && !enTitulo} onClick={() => setMenu((m) => (m ? null : 'celda'))} t={t}>
              <Paintbrush size={13} />
              <span style={{ fontSize: 11 }}>Estilo</span>
            </Btn>
            {menu && !enTitulo && (
              <MenuEstilo
                alcance={menu}
                onAlcance={setMenu}
                rotulos={{ celda: 'Celda', fila: ar === -1 ? 'Cabecera' : `Fila ${ar + 1}`, columna: `Columna ${ac + 1}` }}
                estilo={estiloDe(menu)}
                negrita={negritaDe(menu)}
                onCambio={cambiarEstilo}
                t={t}
              />
            )}
          </div>
        </div>

        {/* La tabla, a tamaño legible: la cabecera se queda arriba al bajar. */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 18px 12px' }}>
          <div
            style={{
              border: `${Math.max(1, style.borderWidth)}px solid ${accent}`,
              borderRadius: 10,
              overflow: 'clip',
              background: style.color,
              fontFamily: family,
              fontSize: 14,
              minWidth: 'min-content',
            }}
          >
            <div
              onMouseDown={(e) => {
                if (enTitulo) return
                e.preventDefault()
                abrir(-2, 0)
              }}
              style={{
                background: accent,
                color: readableOn(accent),
                padding: '10px 12px',
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.35,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                cursor: 'text',
                boxShadow: enTitulo ? 'inset 0 0 0 2px rgba(255,255,255,0.75)' : undefined,
              }}
            >
              {enTitulo ? (
                <CellEditor
                  key={`title:${active.rev}`}
                  initial={draft.title}
                  seed={active.seed}
                  selectAll={active.select}
                  multiline={false}
                  register={register}
                  onMove={(v, m) => onMove(-2, 0, v, m)}
                  onCommit={(v) => commitAt(-2, 0, v)}
                />
              ) : (
                draft.title || <span style={{ opacity: 0.55 }}>Sin título</span>
              )}
            </div>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead>
                <tr>{draft.columns.map((text, j) => celda(-1, j, text))}</tr>
              </thead>
              <tbody>
                {draft.rows.map((row, i) => (
                  <tr key={i}>{row.map((text, j) => celda(i, j, text))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie: ayuda, avisos y botones */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 18px 14px', borderTop: `1px solid ${t.border}` }}>
          <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: 11.5, color: t.textMuted, lineHeight: 1.45 }}>
            {aviso ? (
              <span role="status" style={{ color: t.danger, fontWeight: 600 }}>
                {aviso}
              </span>
            ) : (
              <>Tab, Enter y flechas para moverte · Alt+flechas mueve la fila o la columna · Puedes pegar celdas de Excel o Word</>
            )}
            {chars > TABLE_LIMITS.maxTotal * 0.8 && (
              <div style={{ marginTop: 2, color: chars >= TABLE_LIMITS.maxTotal ? t.danger : t.textMuted }}>
                {chars.toLocaleString('es-ES')} de {TABLE_LIMITS.maxTotal.toLocaleString('es-ES')} caracteres
              </div>
            )}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={descartar}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: confirmar ? t.danger : t.textSecondary,
              background: 'none',
              border: `1px solid ${confirmar ? t.danger : t.border}`,
              borderRadius: 9,
              padding: '7px 12px',
              cursor: 'pointer',
            }}
          >
            {confirmar ? 'Pulsa otra vez para descartar' : 'Descartar cambios'}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => cerrar(true)}
            title="Guardar y cerrar (Ctrl+Enter)"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: readableOn(t.accent),
              background: t.accent,
              border: 'none',
              borderRadius: 9,
              padding: '8px 18px',
              cursor: 'pointer',
            }}
          >
            Hecho
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ---- piezas de la barra ----------------------------------------------------------------------

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
// resaltar). Pulsar el que ya está lo quita y vuelve al de la tabla.
const LETRAS = ['#2A2420', '#7D8A96', '#B04A5E', '#B07A1E', '#4F7A4C', '#3F6E9A', '#6F5A99', '#FFFFFF']
const FONDOS = ['#FCEFEC', '#FBF3E1', '#EDF3EC', '#EAF2F9', '#F1ECF7', '#F1F3F5', '#E8A598', '#D9A441', '#8BA888', '#6E9BC5']

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
        left: 0,
        zIndex: 3,
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
