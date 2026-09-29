import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, X } from 'lucide-react'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import {
  ROOT_CIRCLE,
  categoryAccent,
  naturalShape,
  styleForCategory,
  type CategoryStyleOverride,
  type CategoryStyles,
  type GraphShape,
} from '@/lib/mapas/graph'
import { MAP_CATEGORIES, MAP_CATEGORY_LIST, categoryNumber, type MapCategoryId } from '@/lib/mapas/types'

const SWATCHES = [
  '#E8A598', '#D4756A', '#D4667A', '#D9A441', '#8BA888',
  '#6E9BC5', '#9B86BD', '#7D8A96', '#4A3F38', '#2A2420',
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
      {shape === 'diamond' && <rect x="5" y="5" width="10" height="10" rx="2" transform="rotate(45 10 10)" {...common} />}
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

/**
 * Redefine una categoría: se guarda en el mapa y se reaplica a todos los nodos que la
 * usan (su color, su forma si el usuario ha fijado una, y la línea que llega a cada uno).
 */
export function changeCategoryStyle(category: MapCategoryId, patch: CategoryStyleOverride | null) {
  snapshotForUndo()
  const ui = useUIStore.getState()
  const hadShape = !!ui.categoryStyles[category]?.shape // antes de tocar nada
  const next: CategoryStyles = { ...ui.categoryStyles }
  if (patch === null) delete next[category]
  else {
    const merged = { ...next[category], ...patch }
    // `shape: undefined` significa "que cada nodo conserve su forma".
    if (!merged.shape) delete merged.shape
    if (!merged.color) delete merged.color
    if (merged.color || merged.shape) next[category] = merged
    else delete next[category]
  }
  ui.setCategoryStyles(next)

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
        let style = styleForCategory(n.data.style, category, next)
        // Al quitar la forma fija cada nodo vuelve a la suya (la que le toca por su nivel).
        if (hadShape && !next[category]?.shape) style = { ...style, shape: naturalShape(levelOf(n.id), n.data.label) }
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

export function CategoryStylesPanel() {
  const open = useUIStore((s) => s.categoriesPanelOpen)
  const setOpen = useUIStore((s) => s.setCategoriesPanelOpen)
  const styles = useUIStore((s) => s.categoryStyles)
  const t = useTheme()

  const resetAll = () => {
    for (const c of MAP_CATEGORY_LIST) if (styles[c.id]) changeCategoryStyle(c.id, null)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          style={{
            position: 'absolute',
            top: 74,
            right: 16,
            zIndex: 1000,
            width: 320,
            maxWidth: 'calc(100% - 32px)',
            maxHeight: 'calc(100% - 96px)',
            overflowY: 'auto',
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: '14px 14px 16px',
            boxShadow: `0 8px 40px ${t.shadow}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            transformOrigin: 'top right',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: t.textPrimary, fontWeight: 700, fontSize: 13 }}>Estilo de las categorías</div>
              <div style={{ color: t.textMuted, fontSize: 11, marginTop: 2 }}>
                Se aplica a todos los nodos de cada categoría. Pasa el ratón por un nodo y pulsa su número para asignársela. Si cambias una forma, usa «Ordenar» para recolocar.
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex' }}
            >
              <X size={15} />
            </button>
          </div>

          {MAP_CATEGORY_LIST.map((c) => {
            const o = styles[c.id]
            const accent = categoryAccent(c.id, styles)
            const customized = !!o
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  paddingTop: 12,
                  borderTop: `1px solid ${t.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShapeIcon shape={o?.shape ?? 'rectangle'} color={accent} size={22} />
                  <span style={{ color: t.textPrimary, fontSize: 12.5, fontWeight: 600, flex: 1 }}>
                    {MAP_CATEGORIES[c.id].label}
                  </span>
                  <kbd
                    title={`Pasa el ratón por un nodo y pulsa ${categoryNumber(c.id)}`}
                    style={{
                      background: t.kbd,
                      color: t.accent,
                      border: `1px solid ${t.border}`,
                      borderRadius: 5,
                      padding: '1px 7px',
                      fontSize: 11,
                      fontFamily: 'monospace',
                    }}
                  >
                    {categoryNumber(c.id)}
                  </kbd>
                  {customized && (
                    <button
                      onClick={() => changeCategoryStyle(c.id, null)}
                      title="Volver al estilo de serie"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: t.textMuted,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontFamily: 'inherit',
                      }}
                    >
                      <RotateCcw size={12} /> Restablecer
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  {SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => changeCategoryStyle(c.id, { color: hex })}
                      title={hex}
                      aria-label={`Color ${hex}`}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        background: hex,
                        cursor: 'pointer',
                        border: `2px solid ${accent.toLowerCase() === hex.toLowerCase() ? t.textPrimary : 'transparent'}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  ))}
                  <label
                    title="Otro color"
                    style={{
                      position: 'relative',
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      border: `1.5px dashed ${t.border2}`,
                      background:
                        'conic-gradient(#E8A598, #D9A441, #8BA888, #6E9BC5, #9B86BD, #D4667A, #E8A598)',
                    }}
                  >
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#E8A598'}
                      onChange={(e) => changeCategoryStyle(c.id, { color: e.target.value })}
                      aria-label="Elegir un color propio"
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {SHAPES.map((s) => {
                    const active = o?.shape === s.value
                    return (
                      <button
                        key={s.value}
                        onClick={() => changeCategoryStyle(c.id, { shape: active ? undefined : s.value })}
                        title={active ? `${s.label} (pulsa para quitar la forma fija)` : s.label}
                        aria-label={s.label}
                        aria-pressed={active}
                        style={{
                          flex: 1,
                          height: 30,
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1.5px solid ${active ? accent : t.border}`,
                          background: active ? `${accent}22` : 'transparent',
                        }}
                      >
                        <ShapeIcon shape={s.value} color={active ? accent : t.textMuted} />
                      </button>
                    )
                  })}
                </div>
                {!o?.shape && (
                  <span style={{ color: t.textMuted, fontSize: 10.5 }}>Sin forma fija: cada nodo conserva la suya.</span>
                )}
              </div>
            )
          })}

          {Object.keys(styles).length > 0 && (
            <button
              onClick={resetAll}
              style={{
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textSecondary,
                borderRadius: 10,
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Restablecer todas las categorías
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
