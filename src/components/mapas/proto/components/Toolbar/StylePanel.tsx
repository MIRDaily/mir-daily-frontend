import { type CSSProperties } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useReactFlow, useNodes } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import type { NodeShape, NodeStyle } from '@/components/mapas/proto/types/node.types'
import { categoryAccent } from '@/lib/mapas/graph'
import { applyCategoryToNodes } from '@/components/mapas/proto/utils/categories'
import { MAP_CATEGORY_LIST, categoryNumber, type MapCategoryId } from '@/lib/mapas/types'

const BG_COLORS = [
  // Warm neutrals
  '#FFFFFF', '#FAF7F4', '#F5F0EB', '#EDE6DE',
  // Accents & salmon tones
  '#E8A598', '#D4756A', '#F0C8BC', '#FAEAE6',
  // Slate & cool tones
  '#7D8A96', '#A0B4BC', '#D4E0E6', '#EEF3F6',
  // Greens & teals
  '#8BA89A', '#B8D4CC', '#DDEEE8', '#F0F8F5',
  // Darks
  '#2A2420', '#4A3F38', '#6A5D54', '#1C1815',
]

const TEXT_COLORS = [
  '#2A2420', '#4A3F38', '#FFFFFF', '#FAF7F4',
  '#E8A598', '#D4756A', '#7D8A96', '#A0B4BC',
  '#8BA89A', '#5A8870', '#C4944A', '#8B6030',
]

const SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rectangle', label: 'Rectángulo' },
  { value: 'pill', label: 'Píldora' },
  { value: 'circle', label: 'Círculo' },
  { value: 'diamond', label: 'Diamante' },
]

const POPUP_W = 252
const POPUP_H_EST = 360
const GAP = 14
const MARGIN = 8

const popupVariants: Variants = {
  hidden: { scale: 0.92, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 420, damping: 28 },
  },
  exit: {
    scale: 0.92,
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

export function StylePanel() {
  const { stylePanelOpen, selectedNodeId, setStylePanelOpen } = useUIStore()
  const node = useMindMapStore(useShallow((s) => s.nodes.find((n) => n.id === selectedNodeId)))
  const updateNodeStyle = useMindMapStore((s) => s.updateNodeStyle)
  const categoryStyles = useUIStore((s) => s.categoryStyles)
  const t = useTheme()

  const { flowToScreenPosition } = useReactFlow()
  const allNodes = useNodes()

  const update = (style: Partial<NodeStyle>) => {
    if (!selectedNodeId) return
    updateNodeStyle(selectedNodeId, style)
  }

  // Elegir categoría: la guarda en el nodo, recolorea su estilo y la línea que llega a él.
  const applyCategory = (category: MapCategoryId) => {
    if (node) applyCategoryToNodes([node.id], category)
  }

  // Compute popup position near the selected node
  const getPopupStyle = (): CSSProperties => {
    const nodeInFlow = allNodes.find((n) => n.id === selectedNodeId)
    if (!nodeInFlow) return { position: 'fixed', right: MARGIN + POPUP_W, top: MARGIN }

    const nW = (nodeInFlow.measured?.width as number | undefined) ?? 160
    const nH = (nodeInFlow.measured?.height as number | undefined) ?? 50
    const screenPos = flowToScreenPosition({ x: nodeInFlow.position.x, y: nodeInFlow.position.y })

    // Prefer right side, flip left if not enough space
    let left = screenPos.x + nW + GAP
    let transformOrigin = 'left center'
    if (left + POPUP_W > window.innerWidth - MARGIN) {
      left = screenPos.x - POPUP_W - GAP
      transformOrigin = 'right center'
    }
    left = Math.max(MARGIN, left)

    // Center vertically on the node
    let top = screenPos.y + nH / 2 - POPUP_H_EST / 2
    top = Math.max(MARGIN, Math.min(window.innerHeight - POPUP_H_EST - MARGIN, top))

    return { position: 'fixed', left, top, transformOrigin }
  }

  return (
    <AnimatePresence>
      {stylePanelOpen && node && (
        <motion.div
          key={selectedNodeId}
          variants={popupVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            ...getPopupStyle(),
            width: POPUP_W,
            maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: '16px 16px 20px',
            zIndex: 1000,
            boxShadow: `0 8px 40px ${t.shadow}`,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            transition: 'background 400ms ease, border-color 400ms ease',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: t.textPrimary, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
              Estilo del nodo
            </span>
            <button
              onClick={() => setStylePanelOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.textMuted,
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = t.textPrimary)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = t.textMuted)}
            >
              <X size={15} />
            </button>
          </div>

          {/* Categoría MIR */}
          <Section label="Categoría" textMuted={t.textMuted}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MAP_CATEGORY_LIST.map((c) => {
                const active = node.data.category === c.id
                const color = categoryAccent(c.id, categoryStyles)
                return (
                  <button
                    key={c.id}
                    onClick={() => applyCategory(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 9px',
                      borderRadius: 999,
                      border: `1.5px solid ${active ? color : t.border}`,
                      background: active ? `${color}26` : 'transparent',
                      color: active ? color : t.textSecondary,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      transition: 'all 150ms',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    {c.label}
                    <span style={{ opacity: 0.55, fontSize: 10, fontWeight: 700 }}>{categoryNumber(c.id)}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Shape */}
          <Section label="Forma" textMuted={t.textMuted}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {SHAPES.map((s) => {
                const isActive = node.data.style.shape === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => update({ shape: s.value })}
                    style={{
                      padding: '7px 8px',
                      borderRadius: 8,
                      border: `1.5px solid ${isActive ? t.accent : t.border}`,
                      background: isActive ? (t.isDark ? '#313244' : t.bgPanel2) : 'transparent',
                      color: isActive ? t.accent : t.textSecondary,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'all 150ms',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Background color */}
          <Section label="Color de fondo" textMuted={t.textMuted}>
            <ColorGrid
              colors={BG_COLORS}
              selected={node.data.style.color}
              onSelect={(c) => update({ color: c })}
              accentColor={t.accent}
            />
          </Section>

          {/* Border color */}
          <Section label="Color de borde" textMuted={t.textMuted}>
            <ColorGrid
              colors={BG_COLORS}
              selected={node.data.style.borderColor}
              onSelect={(c) => update({ borderColor: c, glowColor: c })}
              accentColor={t.accent}
            />
          </Section>

          {/* Border width */}
          <Section label={`Grosor del borde: ${node.data.style.borderWidth}px`} textMuted={t.textMuted}>
            <input
              type="range"
              min={0}
              max={6}
              step={1}
              value={node.data.style.borderWidth}
              onChange={(e) => update({ borderWidth: Number(e.target.value) })}
              style={{ width: '100%', accentColor: t.accent }}
            />
          </Section>

          {/* Text color */}
          <Section label="Color de texto" textMuted={t.textMuted}>
            <ColorGrid
              colors={TEXT_COLORS}
              selected={node.data.style.textColor}
              onSelect={(c) => update({ textColor: c })}
              accentColor={t.accent}
            />
          </Section>

        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Section({
  label,
  textMuted,
  children,
}: {
  label: string
  textMuted: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          color: textMuted,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function ColorGrid({
  colors,
  selected,
  onSelect,
  accentColor,
}: {
  colors: string[]
  selected: string
  onSelect: (c: string) => void
  accentColor: string
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          title={c}
          style={{
            aspectRatio: '1',
            borderRadius: 7,
            background: c,
            border: `2.5px solid ${selected === c ? accentColor : 'transparent'}`,
            cursor: 'pointer',
            outline: selected === c ? `2px solid ${accentColor}44` : 'none',
            outlineOffset: 2,
            transition: 'border-color 100ms, outline 100ms, transform 100ms',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
        />
      ))}
    </div>
  )
}
