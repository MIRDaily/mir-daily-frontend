import { resolveFont } from '@/components/mapas/proto/utils/font'
import { MAP_FONTS } from '@/lib/mapas/fonts'
import { type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useReactFlow, useNodes } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'

const FONTS: { value: string; label: string }[] = MAP_FONTS.map((f) => ({ value: f.id, label: f.label }))

const FONT_SIZES = [11, 12, 13, 14, 16, 18, 20, 24]

const POPUP_W = 268
const POPUP_H = 90   // two rows
const GAP     = 10
const MARGIN  = 8

// Run an execCommand on whatever contentEditable currently has focus
function execFmt(cmd: string) {
  document.execCommand(cmd, false)
}

/** Solo monta el contenido mientras se edita un texto: el resto del tiempo no vigila los nodos. */
export function TextFormatPopup() {
  const editing = useMindMapStore((s) => s.editingNodeId !== null)
  return editing ? <TextFormatBody /> : null
}

function TextFormatBody() {
  const editingNodeId = useMindMapStore((s) => s.editingNodeId)
  const node = useMindMapStore(useShallow((s) => s.nodes.find((n) => n.id === editingNodeId)))
  const updateNodeStyle = useMindMapStore((s) => s.updateNodeStyle)
  const t = useTheme()

  const { flowToScreenPosition } = useReactFlow()
  const allNodes = useNodes()

  const update = (style: Partial<NodeStyle>) => {
    if (!editingNodeId) return
    updateNodeStyle(editingNodeId, style)
  }

  const getPopupStyle = (): CSSProperties => {
    const nodeInFlow = allNodes.find((n) => n.id === editingNodeId)
    if (!nodeInFlow) return { position: 'fixed', top: MARGIN, left: MARGIN }

    const nW = (nodeInFlow.measured?.width as number | undefined) ?? 160
    const screenPos = flowToScreenPosition({ x: nodeInFlow.position.x, y: nodeInFlow.position.y })

    let left = screenPos.x + nW / 2 - POPUP_W / 2
    left = Math.max(MARGIN, Math.min(window.innerWidth - POPUP_W - MARGIN, left))

    let top = screenPos.y - POPUP_H - GAP
    top = Math.max(MARGIN, top)

    return { position: 'fixed', left, top }
  }

  if (!editingNodeId || !node) return null

  const style = node.data.style
  const currentFontSize = style.fontSize ?? 14
  const currentSizeIdx  = FONT_SIZES.indexOf(currentFontSize)

  const decreaseSize = () => {
    if (currentSizeIdx > 0) update({ fontSize: FONT_SIZES[currentSizeIdx - 1] })
  }
  const increaseSize = () => {
    if (currentSizeIdx < FONT_SIZES.length - 1) update({ fontSize: FONT_SIZES[currentSizeIdx + 1] })
  }

  return (
    <AnimatePresence>
      <motion.div
        key={editingNodeId}
        initial={{ scale: 0.90, opacity: 0, y: 6 }}
        animate={{ scale: 1,    opacity: 1, y: 0,
          transition: { type: 'spring', stiffness: 480, damping: 30 } }}
        exit={{    scale: 0.90, opacity: 0, y: 6,
          transition: { duration: 0.12, ease: 'easeIn' } }}
        style={{
          ...getPopupStyle(),
          width: POPUP_W,
          background: t.bgPanel,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: '8px 10px',
          zIndex: 1100,
          boxShadow: `0 6px 28px ${t.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'all',
          transition: 'background 400ms ease, border-color 400ms ease',
        }}
        // Prevent clicks from stealing focus from the editor
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Row 1 — Font family */}
        <div style={{ display: 'flex', gap: 4 }}>
          {FONTS.map((f) => {
            const isActive = (style.fontFamily ?? 'Lexend') === f.value
            return (
              <button
                key={f.value}
                title={f.label}
                aria-label={f.label}
                onClick={() => update({ fontFamily: f.value })}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: 7,
                  border: `1.5px solid ${isActive ? t.accent : t.border}`,
                  background: isActive ? (t.isDark ? '#313244' : t.bgPanel2) : 'transparent',
                  color: isActive ? t.accent : t.textSecondary,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: resolveFont(f.value),
                  fontWeight: 600,
                  transition: 'all 120ms',
                }}
              >
                Aa
              </button>
            )
          })}
        </div>

        {/* Row 2 — Bold / Italic / Underline / Strike | size | alignment */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>

          {/* Rich-text formatting */}
          <FmtBtn onClick={() => execFmt('bold')}          label="N" style={{ fontWeight: 800 }}                            t={t} title="Negrita (Ctrl+B)" />
          <FmtBtn onClick={() => execFmt('italic')}        label="K" style={{ fontStyle: 'italic', fontWeight: 600 }}       t={t} title="Cursiva (Ctrl+I)" />
          <FmtBtn onClick={() => execFmt('underline')}     label="S" style={{ textDecoration: 'underline' }}                t={t} title="Subrayado (Ctrl+U)" />
          <FmtBtn onClick={() => execFmt('strikeThrough')} label="T" style={{ textDecoration: 'line-through' }}             t={t} title="Tachado" />

          <Divider color={t.border} />

          {/* Font size */}
          <button
            onClick={decreaseSize}
            disabled={currentSizeIdx <= 0}
            style={sizeBtn(t, currentSizeIdx <= 0)}
          >−</button>
          <span style={{
            minWidth: 24, textAlign: 'center',
            fontSize: 11, fontWeight: 700,
            color: t.textPrimary, userSelect: 'none',
          }}>
            {currentFontSize}
          </span>
          <button
            onClick={increaseSize}
            disabled={currentSizeIdx >= FONT_SIZES.length - 1}
            style={sizeBtn(t, currentSizeIdx >= FONT_SIZES.length - 1)}
          >+</button>

          <Divider color={t.border} />

          {/* Text alignment */}
          {(['left', 'center', 'right'] as const).map((align) => {
            const isActive = (style.textAlign ?? 'center') === align
            const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
            return (
              <button
                key={align}
                onClick={() => update({ textAlign: align })}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: 7,
                  border: `1.5px solid ${isActive ? t.accent : t.border}`,
                  background: isActive ? (t.isDark ? '#313244' : t.bgPanel2) : 'transparent',
                  color: isActive ? t.accent : t.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 120ms',
                }}
              >
                <Icon size={13} />
              </button>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function Divider({ color }: { color: string }) {
  return <div style={{ width: 1, height: 18, background: color, margin: '0 1px', flexShrink: 0 }} />
}

function FmtBtn({
  onClick, label, style: labelStyle, t, title,
}: {
  onClick: () => void
  label: string
  style: React.CSSProperties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26,
        borderRadius: 7,
        border: `1.5px solid ${t.border}`,
        background: 'transparent',
        color: t.textSecondary,
        cursor: 'pointer',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 120ms',
        ...labelStyle,
      }}
    >
      {label}
    </button>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sizeBtn(t: any, disabled: boolean): React.CSSProperties {
  return {
    width: 26, height: 26,
    borderRadius: 7,
    border: `1.5px solid ${t.border}`,
    background: 'transparent',
    color: disabled ? t.textMuted : t.textSecondary,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 14, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
    flexShrink: 0,
    transition: 'all 120ms',
  }
}
