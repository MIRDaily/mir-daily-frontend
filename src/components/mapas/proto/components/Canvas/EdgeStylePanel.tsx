import { useEdges, Panel } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import type { EdgeData, EdgeVariant } from '@/components/mapas/proto/types/edge.types'

// ─── Config ──────────────────────────────────────────────────────────────────

const VARIANTS: { id: EdgeVariant; dash?: string }[] = [
  { id: 'solid' },
  { id: 'dashed', dash: '10 5' },
  { id: 'dotted', dash: '2 6'  },
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

export function EdgeStylePanel() {
  const edges         = useEdges()
  const updateEdgeData = useMindMapStore((s) => s.updateEdgeData)
  const t             = useTheme()

  const selected = edges.filter((e) => e.selected)
  if (selected.length === 0) return null

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
          {/* ── Variant ──────────────────────────────────────────────────── */}
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              title={v.id}
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

          {divider}

          {/* ── Stroke width ─────────────────────────────────────────────── */}
          {WIDTHS.map((w) => {
            const isActive = Math.round(activeWidth) === w
            return (
              <button
                key={w}
                title={`${w}px`}
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
