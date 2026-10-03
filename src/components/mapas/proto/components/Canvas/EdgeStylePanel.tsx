import { useEdges, Panel } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { motion, AnimatePresence } from 'framer-motion'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import type { EdgeData, EdgeVariant } from '@/components/mapas/proto/types/edge.types'

// ─── Config ──────────────────────────────────────────────────────────────────

const VARIANTS: { id: EdgeVariant; dash?: string; label: string }[] = [
  { id: 'solid', label: 'Continua' },
  { id: 'dashed', dash: '10 5', label: 'Guiones' },
  { id: 'dotted', dash: '2 6', label: 'Puntos' },
]

const COLORS = [
  { id: 'default', value: null,      label: 'Por defecto' },
  { id: 'blue',    value: '#89b4fa', label: 'Azul'    },
  { id: 'purple',  value: '#cba6f7', label: 'Morado'  },
  { id: 'green',   value: '#a6e3a1', label: 'Verde'   },
  { id: 'yellow',  value: '#f9e2af', label: 'Amarillo'},
  { id: 'red',     value: '#f38ba8', label: 'Rojo'    },
  { id: 'orange',  value: '#fab387', label: 'Naranja' },
]

const WIDTHS = [1, 2, 3, 4]

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Solo monta el panel si hay algo que editar: alguna línea seleccionada o algún nodo seleccionado (en
 * ese caso, todas las líneas que llegan o salen de él). Si no, no vigila las líneas.
 */
export function EdgeStylePanel() {
  const any = useMindMapStore((s) => s.edges.some((e) => e.selected) || (s.editingNodeId === null && s.nodes.some((n) => n.selected && !n.hidden)))
  return any ? <EdgeStylePanelBody /> : null
}

function EdgeStylePanelBody() {
  const edges         = useEdges()
  const updateEdgeData = useMindMapStore((s) => s.updateEdgeData)
  const t             = useTheme()

  const selectedNodes = useMindMapStore(useShallow((s) => s.nodes.filter((n) => n.selected && !n.hidden).map((n) => n.id)))
  const editing = useMindMapStore((s) => s.editingNodeId !== null)
  // Con líneas seleccionadas se editan esas; si no, las de los nodos seleccionados: todas las que
  // los unen a otros (entrada y salida), y también las que unen los propios seleccionados entre sí.
  const lines = edges.filter((e) => e.selected)
  const byNode = lines.length === 0 ? edges.filter((e) => !e.hidden && (selectedNodes.includes(e.source) || selectedNodes.includes(e.target))) : []
  const selected = lines.length > 0 ? lines : byNode
  if (editing || selected.length === 0) return null
  const fromNodes = lines.length === 0

  const firstData = selected[0].data as EdgeData | undefined
  const variant    = firstData?.variant    ?? 'solid'
  const activeColor = firstData?.color     ?? null
  const activeWidth = firstData?.strokeWidth ?? 1.5

  const applyAll = (patch: Partial<EdgeData>) =>
    selected.forEach((e) => updateEdgeData(e.id, patch))

  const divider = (
    <div style={{ width: 1, background: t.border, alignSelf: 'stretch', margin: '0 4px' }} />
  )

  return (
    <Panel position="bottom-center" style={{ marginBottom: 18, pointerEvents: 'none' }}>
      <AnimatePresence>
        <motion.div
          key="edge-panel"
          data-tuto="edge-panel"
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: '6px 10px',
            boxShadow: `0 6px 24px ${t.shadow}`,
            pointerEvents: 'all',
          }}
        >
          {fromNodes && (
            <span
              title="Cambian todas las líneas que unen estos nodos con otros"
              style={{ color: t.textSecondary, fontSize: 11, fontWeight: 700, padding: '0 6px 0 2px', whiteSpace: 'nowrap' }}
            >
              {selected.length === 1 ? '1 línea' : `${selected.length} líneas`}
              {selectedNodes.length > 1 ? ` de ${selectedNodes.length} nodos` : ''}
            </span>
          )}
          {/* ── Variant ──────────────────────────────────────────────────── */}
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              title={v.label}
              aria-label={`Línea ${v.label.toLowerCase()}`}
              aria-pressed={variant === v.id}
              onClick={() => applyAll({ variant: v.id })}
              style={{
                background: variant === v.id ? t.hoverBg : 'transparent',
                border: `1px solid ${variant === v.id ? t.accent : 'transparent'}`,
                color: variant === v.id ? t.accent : t.textSecondary,
                borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                transition: 'all 120ms',
              }}
            >
              {v.id === 'solid'  && <LineSvg dash={undefined} />}
              {v.id === 'dashed' && <LineSvg dash="7 4" />}
              {v.id === 'dotted' && <LineSvg dash="2 5" round />}
            </button>
          ))}

          {divider}

          {/* ── Color ────────────────────────────────────────────────────── */}
          {COLORS.map((c) => {
            const isActive = activeColor === c.value
            return (
              <button
                key={c.id}
                title={c.label}
                aria-label={`Color de línea: ${c.label}`}
                onClick={() => applyAll({ color: c.value ?? undefined })}
                style={{
                  width: 18, height: 18,
                  borderRadius: '50%',
                  border: `2px solid ${isActive ? t.accent : 'transparent'}`,
                  cursor: 'pointer',
                  padding: 0,
                  background: c.value ?? t.textSecondary,
                  outline: isActive ? `2px solid ${t.bgPanel}` : 'none',
                  outlineOffset: -4,
                  transition: 'border-color 120ms, transform 120ms',
                  transform: isActive ? 'scale(1.25)' : 'scale(1)',
                  flexShrink: 0,
                }}
              />
            )
          })}

          {/* Cualquier otro color */}
          <label
            title="Otro color…"
            style={{
              position: 'relative', width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
              border: `2px solid ${activeColor && !COLORS.some((c) => c.value === activeColor) ? t.accent : 'transparent'}`,
              background: activeColor && !COLORS.some((c) => c.value === activeColor) ? activeColor : 'conic-gradient(#f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)',
            }}
          >
            <input
              type="color"
              aria-label="Otro color de línea"
              value={/^#[0-9a-fA-F]{6}$/.test(activeColor ?? '') ? (activeColor as string) : '#E8A598'}
              onChange={(e) => applyAll({ color: e.target.value })}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            />
          </label>

          {divider}

          {/* ── Stroke width ─────────────────────────────────────────────── */}
          {WIDTHS.map((w) => {
            const isActive = Math.round(activeWidth) === w
            return (
              <button
                key={w}
                title={`Grosor ${w} px`}
                aria-label={`Grosor ${w} px`}
                onClick={() => applyAll({ strokeWidth: w })}
                style={{
                  background: isActive ? t.hoverBg : 'transparent',
                  border: `1px solid ${isActive ? t.accent : 'transparent'}`,
                  borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  transition: 'all 120ms',
                }}
              >
                <svg width="20" height={w * 3 + 4} viewBox={`0 0 20 ${w * 3 + 4}`}>
                  <line
                    x1="0" y1={(w * 3 + 4) / 2}
                    x2="20" y2={(w * 3 + 4) / 2}
                    stroke={isActive ? t.accent : t.textSecondary}
                    strokeWidth={w}
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </Panel>
  )
}

function LineSvg({ dash, round }: { dash?: string; round?: boolean }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10">
      <line
        x1="1" y1="5" x2="21" y2="5"
        stroke="currentColor" strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap={round ? 'round' : 'butt'}
      />
    </svg>
  )
}
