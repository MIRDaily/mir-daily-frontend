import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { applyCategoryToNodes } from '@/components/mapas/proto/utils/categories'
import { NodeBody } from '@/components/mapas/proto/nodes/MindMapNode/NodeBody'
import { NodeLabel } from '@/components/mapas/proto/nodes/MindMapNode/NodeLabel'
import { resolveFont } from '@/components/mapas/proto/utils/font'
import {
  ROOT_CIRCLE,
  categoryAccent,
  categoryLabel,
  naturalShape,
  styleForCategory,
  styleForNode,
  type CategoryStyleOverride,
  type CategoryStyles,
  type GraphShape,
} from '@/lib/mapas/graph'
import { MAP_FONTS } from '@/lib/mapas/fonts'
import { MAP_CATEGORIES, MAP_CATEGORY_LIST, categoryNumber, type MapCategoryId } from '@/lib/mapas/types'

const SWATCHES = [
  '#FFFFFF', '#FAEAE6', '#E8A598', '#D4756A', '#D4667A',
  '#D9A441', '#8BA888', '#6E9BC5', '#9B86BD', '#7D8A96',
  '#4A3F38', '#2A2420',
]

const SHAPES: { value: GraphShape; label: string }[] = [
  { value: 'rectangle', label: 'Rectángulo' },
  { value: 'pill', label: 'Píldora' },
  { value: 'circle', label: 'Círculo' },
  { value: 'diamond', label: 'Rombo' },
]

/** Miniatura de una forma, para elegirla y para ver el resultado. */
function ShapeIcon({ shape, color, size = 18 }: { shape: GraphShape; color: string; size?: number }) {
  const common = { fill: color, stroke: 'none' }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {shape === 'rectangle' && <rect x="2" y="4" width="16" height="12" rx="3" {...common} />}
      {shape === 'pill' && <rect x="1" y="5" width="18" height="10" rx="5" {...common} />}
      {shape === 'circle' && <circle cx="10" cy="10" r="7.5" {...common} />}
      {shape === 'diamond' && <path d="M10 2 L18 10 L10 18 L2 10 Z" strokeLinejoin="round" {...common} />}
    </svg>
  )
}

// Cada clic es un cambio deshacible, pero arrastrar el selector de color dispara decenas de
// cambios por segundo: solo se guarda una foto para deshacer por ráfaga.
let lastSnapshot = 0
function snapshotForUndo() {
  const now = Date.now()
  if (now - lastSnapshot < 600) return
  lastSnapshot = now
  const { nodes, edges } = useMindMapStore.getState()
  useHistoryStore.getState().pushSnapshot(nodes, edges)
}

/** Lo que se puede cambiar de una categoría; `undefined` quita el ajuste (vuelve al de serie). */
export type CategoryPatch = { [K in keyof CategoryStyleOverride]?: CategoryStyleOverride[K] | undefined }

/**
 * Redefine una categoría: se guarda en el mapa y se reaplica a todos los nodos que la usan (color,
 * forma, relleno, borde, texto, fuente… y la línea que llega a cada uno). `null` la restablece
 * entera. Lo que se quita vuelve a lo natural del nodo según su nivel.
 */
export function changeCategoryStyle(category: MapCategoryId, patch: CategoryPatch | null) {
  const ui = useUIStore.getState()
  const prev = ui.categoryStyles[category]
  const next: CategoryStyles = { ...ui.categoryStyles }
  if (patch === null) delete next[category]
  else {
    const merged: Record<string, unknown> = { ...prev }
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '') delete merged[k]
      else merged[k] = v
    }
    if (Object.keys(merged).length > 0) next[category] = merged as CategoryStyleOverride
    else delete next[category]
  }
  // Solo el título: no toca el aspecto de ningún nodo.
  const onlyLabel =
    patch !== null && Object.keys(patch).every((k) => k === 'label')
  if (!onlyLabel) snapshotForUndo()
  ui.setCategoryStyles(next)
  if (onlyLabel) return

  const accent = categoryAccent(category, next)
  useMindMapStore.setState((s) => {
    const byId = new Map(s.nodes.map((n) => [n.id, n]))
    const levelOf = (id: string): number => {
      let level = 0
      for (let cur = byId.get(id); cur?.data.parentId && level < 200; cur = byId.get(cur.data.parentId)) level++
      return level
    }
    return {
      nodes: s.nodes.map((n) => {
        if (n.data.category !== category) return n
        const natural = styleForNode(levelOf(n.id), category, n.data.label.replace(/<[^>]*>/g, ''))
        // Al quitar la forma fija cada nodo vuelve a la suya (la que le toca por su nivel).
        const style = styleForCategory(n.data.style, category, next, { prev, natural })
        if (prev?.shape && !next[category]?.shape) style.shape = naturalShape(levelOf(n.id), n.data.label)
        const out = { ...n, data: { ...n.data, style } }
        // El círculo de la raíz tiene tamaño fijo; con otra forma vuelve a ajustarse al texto.
        if (style.shape !== 'circle' && n.width === ROOT_CIRCLE && n.height === ROOT_CIRCLE) {
          delete out.width
          delete out.height
        }
        return out
      }),
      edges: s.edges.map((e) => {
        const target = byId.get(e.target)
        return target?.data.category === category ? { ...e, data: { ...e.data, color: accent } } : e
      }),
    }
  })
}

/** Solo monta el contenido con el menú abierto (ver StylePanel): cerrado, no vigila los nodos. */
export function CategoryStylesPanel() {
  const open = useUIStore((s) => s.categoriesPanelOpen)
  return <AnimatePresence>{open && <CategoryStylesBody />}</AnimatePresence>
}

function CategoryStylesBody() {
  const setOpen = useUIStore((s) => s.setCategoriesPanelOpen)
  const styles = useUIStore((s) => s.categoryStyles)
  const t = useTheme()
  const [current, setCurrent] = useState<MapCategoryId>('clinica')

  // Cuántos nodos tiene cada categoría y cuántos hay seleccionados (para «Aplicar a la selección»).
  const counts = useMindMapStore(
    useShallow((s) => {
      const out: Record<string, number> = {}
      for (const n of s.nodes) out[n.data.category ?? 'general'] = (out[n.data.category ?? 'general'] ?? 0) + 1
      return out
    }),
  )
  const selectedCount = useMindMapStore((s) => s.nodes.filter((n) => n.selected && !n.hidden).length)

  const o = styles[current]
  const accent = categoryAccent(current, styles)
  const set = (patch: CategoryPatch) => changeCategoryStyle(current, patch)
  const customized = !!o

  // Vista previa: un nodo de rama (nivel 1, macizo) y uno de detalle (nivel 2, con contorno), tal
  // como quedan con los ajustes de la categoría.
  const previews = useMemo(() => {
    const title = categoryLabel(current, styles)
    return [1, 2].map((level) => {
      const natural = styleForNode(level, current, title)
      return styleForCategory(natural, current, styles, { natural })
    })
  }, [current, styles])
  const title = categoryLabel(current, styles)

  const resetAll = () => {
    for (const c of MAP_CATEGORY_LIST) if (styles[c.id]) changeCategoryStyle(c.id, null)
  }

  /** Selecciona de golpe todos los nodos de una categoría (para estilarlos o moverlos juntos). */
  const selectCategory = () => {
    useMindMapStore.setState((s) => ({
      nodes: s.nodes.map((n) => {
        const on = !n.hidden && (n.data.category ?? 'general') === current
        return !!n.selected === on ? n : { ...n, selected: on }
      }),
    }))
  }

  const applyToSelection = () => {
    const ids = useMindMapStore
      .getState()
      .nodes.filter((n) => n.selected && !n.hidden)
      .map((n) => n.id)
    if (ids.length) applyCategoryToNodes(ids, current)
  }

  return (
    <>
      {(
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 'var(--mapa-inset-left, 0px)',
            right: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 16px',
            pointerEvents: 'none',
          }}
        >
          <motion.div
            data-tuto="categories-panel"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            style={{
              pointerEvents: 'auto',
              width: 880,
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 80px)',
              overflowY: 'auto',
              background: t.bgPanel,
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              padding: '14px 18px 16px',
              boxShadow: `0 12px 48px ${t.shadow}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              transformOrigin: 'top center',
            }}
          >
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ color: t.textPrimary, fontWeight: 700, fontSize: 14 }}>Categorías</div>
                <div style={{ color: t.textMuted, fontSize: 11.5, marginTop: 2 }}>
                  Cambia cómo se ve cada tipo de idea en todo el mapa. Ratón sobre un nodo y su número le asigna la categoría.
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                title="Cerrar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Las siete categorías, en fila */}
            <div role="tablist" aria-label="Categorías" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MAP_CATEGORY_LIST.map((c) => {
                const on = c.id === current
                const color = categoryAccent(c.id, styles)
                const n = counts[c.id] ?? 0
                return (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={on}
                    data-cat={c.id}
                    onClick={() => setCurrent(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 11px 6px 9px',
                      borderRadius: 999,
                      border: `1.5px solid ${on ? color : t.border}`,
                      background: on ? `${color}1F` : 'transparent',
                      color: on ? t.textPrimary : t.textSecondary,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      transition: 'all 140ms',
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {categoryLabel(c.id, styles)}
                    <span style={{ opacity: 0.55, fontSize: 10.5, fontWeight: 700 }}>{categoryNumber(c.id)}</span>
                    <span style={{ opacity: 0.5, fontSize: 10.5, fontWeight: 600 }}>· {n}</span>
                    {styles[c.id] && <span title="Personalizada" style={{ width: 5, height: 5, borderRadius: '50%', background: t.accent }} />}
                  </button>
                )
              })}
            </div>

            {/* Editor de la categoría elegida */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 18,
                paddingTop: 14,
                borderTop: `1px solid ${t.border}`,
              }}
            >
              {/* Identidad */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Group label="Vista previa" t={t}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: 12,
                      borderRadius: 12,
                      background: t.bgPanel2,
                      overflow: 'hidden',
                    }}
                  >
                    {previews.map((st, i) => (
                      <div key={i} style={{ maxWidth: '100%' }}>
                        <NodeBody style={st} isSelected={false} isDark={t.isDark}>
                          <NodeLabel label={i === 0 ? title : `${title}: detalle`} style={st} />
                        </NodeBody>
                      </div>
                    ))}
                  </div>
                </Group>

                <Group label="Título" t={t} auto={o?.label !== undefined} onAuto={() => set({ label: undefined })}>
                  <input
                    type="text"
                    value={o?.label ?? ''}
                    maxLength={40}
                    placeholder={MAP_CATEGORIES[current].label}
                    onChange={(e) => set({ label: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label="Título de la categoría"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 9,
                      border: `1px solid ${t.border}`,
                      background: 'transparent',
                      color: t.textPrimary,
                      padding: '7px 10px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                </Group>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <MiniBtn disabled={(counts[current] ?? 0) === 0} onClick={selectCategory} t={t} title="Selecciona todos los nodos de esta categoría">
                    Seleccionar todos
                  </MiniBtn>
                  <MiniBtn disabled={selectedCount === 0} onClick={applyToSelection} t={t} title="Asigna esta categoría a los nodos seleccionados">
                    Aplicar a la selección{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </MiniBtn>
                </div>
              </div>

              {/* Colores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Group label="Color de la categoría" hint="líneas y brillo" t={t} auto={o?.color !== undefined} onAuto={() => set({ color: undefined })}>
                  <ColorRow value={o?.color} current={accent} onPick={(c) => set({ color: c })} t={t} name="categoría" />
                </Group>
                <Group label="Relleno" t={t} auto={o?.fill !== undefined} onAuto={() => set({ fill: undefined })}>
                  <ColorRow value={o?.fill} current={previews[1].color} onPick={(c) => set({ fill: c })} t={t} name="relleno" />
                </Group>
                <Group label="Borde" t={t} auto={o?.border !== undefined || o?.borderWidth !== undefined} onAuto={() => set({ border: undefined, borderWidth: undefined })}>
                  <ColorRow value={o?.border} current={previews[1].borderColor} onPick={(c) => set({ border: c })} t={t} name="borde" />
                  <Slider
                    label="Grosor"
                    value={o?.borderWidth ?? previews[1].borderWidth}
                    min={0}
                    max={6}
                    suffix=" px"
                    onChange={(v) => set({ borderWidth: v })}
                    t={t}
                  />
                </Group>
                <Group label="Color del texto" t={t} auto={o?.textColor !== undefined} onAuto={() => set({ textColor: undefined })}>
                  <ColorRow value={o?.textColor} current={previews[1].textColor} onPick={(c) => set({ textColor: c })} t={t} name="texto" />
                </Group>
              </div>

              {/* Forma y tipografía */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Group label="Forma" t={t} auto={o?.shape !== undefined} onAuto={() => set({ shape: undefined })}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {SHAPES.map((s) => {
                      const active = o?.shape === s.value
                      return (
                        <button
                          key={s.value}
                          onClick={() => set({ shape: active ? undefined : s.value })}
                          title={active ? `${s.label} (pulsa para quitarla)` : s.label}
                          aria-label={s.label}
                          aria-pressed={active}
                          style={{
                            height: 36,
                            borderRadius: 9,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1.5px solid ${active ? accent : t.border}`,
                            background: active ? `${accent}22` : 'transparent',
                          }}
                        >
                          <ShapeIcon shape={s.value} color={active ? accent : t.textMuted} size={20} />
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ color: t.textMuted, fontSize: 10.5, marginTop: 5 }}>
                    {o?.shape ? 'Forma fija para toda la categoría.' : 'Sin forma fija: cada nodo conserva la suya.'}
                  </div>
                </Group>

                <Group label="Fuente" t={t} auto={o?.fontFamily !== undefined} onAuto={() => set({ fontFamily: undefined })}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
                    {MAP_FONTS.map((f) => {
                      const active = o?.fontFamily === f.id
                      return (
                        <button
                          key={f.id}
                          onClick={() => set({ fontFamily: active ? undefined : f.id })}
                          aria-pressed={active}
                          title={f.label}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            textAlign: 'left',
                            border: `1.5px solid ${active ? accent : t.border}`,
                            background: active ? `${accent}22` : 'transparent',
                            color: t.textPrimary,
                            fontFamily: resolveFont(f.id),
                            fontSize: 13,
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {f.label}
                        </button>
                      )
                    })}
                  </div>
                </Group>

                <Group label="Tamaño de letra" t={t} auto={o?.fontSize !== undefined} onAuto={() => set({ fontSize: undefined })}>
                  <Slider label="" value={o?.fontSize ?? previews[1].fontSize} min={10} max={28} suffix=" px" onChange={(v) => set({ fontSize: v })} t={t} />
                </Group>
              </div>
            </div>

            {/* Pie */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {customized && (
                <MiniBtn onClick={() => changeCategoryStyle(current, null)} t={t} title="Vuelve al estilo de serie para esta categoría">
                  <RotateCcw size={11} style={{ marginRight: 5, verticalAlign: -1 }} />
                  Restablecer «{title}»
                </MiniBtn>
              )}
              {Object.keys(styles).length > 0 && (
                <MiniBtn onClick={resetAll} t={t} title="Vuelve al estilo de serie en las siete categorías">
                  Restablecer todas
                </MiniBtn>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}

type Theme = ReturnType<typeof useTheme>

function Group({
  label,
  hint,
  auto,
  onAuto,
  children,
  t,
}: {
  label: string
  hint?: string
  /** Hay un ajuste propio: se muestra «Auto» para quitarlo. */
  auto?: boolean
  onAuto?: () => void
  children: React.ReactNode
  t: Theme
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <span
          style={{
            color: t.textMuted,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
          {hint && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}> · {hint}</span>}
        </span>
        {auto && onAuto && (
          <button
            type="button"
            onClick={onAuto}
            title="Quitar el ajuste y volver al de serie"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.accent,
              fontSize: 10.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Auto
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function ColorRow({
  value,
  current,
  onPick,
  t,
  name,
}: {
  /** El ajuste propio (undefined = de serie). */
  value: string | undefined
  /** El color que se ve ahora (para el selector libre). */
  current: string
  onPick: (c: string) => void
  t: Theme
  name: string
}) {
  const known = value !== undefined && SWATCHES.some((c) => c.toLowerCase() === value.toLowerCase())
  const picker = /^#[0-9a-fA-F]{6}$/.test(value ?? current) ? (value ?? current) : '#E8A598'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {SWATCHES.map((hex) => {
        const on = value?.toLowerCase() === hex.toLowerCase()
        const light = /^#(f|e)/i.test(hex)
        return (
          <button
            key={hex}
            onClick={() => onPick(hex)}
            title={hex}
            aria-label={`Color ${hex} (${name})`}
            aria-pressed={on}
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: hex,
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: light ? '#2A2420' : '#fff',
              border: `2px solid ${on ? t.textPrimary : 'rgba(0,0,0,0.12)'}`,
            }}
          >
            {on && <Check size={11} strokeWidth={3.5} />}
          </button>
        )
      })}
      <label
        title="Otro color…"
        style={{
          position: 'relative',
          width: 22,
          height: 22,
          borderRadius: 6,
          cursor: 'pointer',
          overflow: 'hidden',
          border: `2px solid ${value !== undefined && !known ? t.textPrimary : 'rgba(0,0,0,0.12)'}`,
          background:
            value !== undefined && !known
              ? value
              : 'conic-gradient(#E8A598, #D9A441, #8BA888, #6E9BC5, #9B86BD, #D4667A, #E8A598)',
        }}
      >
        <input
          type="color"
          value={picker}
          onChange={(e) => onPick(e.target.value.toUpperCase())}
          aria-label={`Otro color (${name})`}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
        />
      </label>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  t,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (v: number) => void
  t: Theme
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
      {label && <span style={{ color: t.textSecondary, fontSize: 11, fontWeight: 600 }}>{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label || 'Valor'}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, minWidth: 0, accentColor: t.accent }}
      />
      <span style={{ color: t.textSecondary, fontSize: 11, fontWeight: 600, minWidth: 38, textAlign: 'right' }}>
        {value}
        {suffix}
      </span>
    </div>
  )
}

function MiniBtn({
  children,
  onClick,
  title,
  disabled,
  t,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
  t: Theme
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        border: `1px solid ${t.border}`,
        background: 'transparent',
        color: disabled ? t.textMuted : t.textSecondary,
        opacity: disabled ? 0.55 : 1,
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 11.5,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}
