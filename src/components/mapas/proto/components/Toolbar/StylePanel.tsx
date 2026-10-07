import { type CSSProperties, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useReactFlow, useNodes } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import type { NodeShape, NodeStyle } from '@/components/mapas/proto/types/node.types'
import { categoryAccent, categoryLabel, LABEL_FONT_SIZE } from '@/lib/mapas/graph'
import { applyCategoryToNodes, resetNodesStyle } from '@/components/mapas/proto/utils/categories'
import { MAP_CATEGORY_LIST, categoryNumber, type MapCategoryId } from '@/lib/mapas/types'

const BG_COLORS = [
  // Neutros cálidos
  '#FFFFFF', '#FAF7F4', '#EDE6DE',
  // Salmón y acentos
  '#E8A598', '#D4756A', '#F0C8BC', '#FAEAE6',
  // Pizarra y fríos
  '#7D8A96', '#A0B4BC', '#D4E0E6', '#EEF3F6',
  // Verdes
  '#8BA89A', '#B8D4CC', '#DDEEE8',
  // Oscuros
  '#2A2420', '#4A3F38', '#6A5D54', '#1C1815',
]

const TEXT_COLORS = ['#2A2420', '#4A3F38', '#FFFFFF', '#E8A598', '#D4756A', '#7D8A96', '#5A8870', '#C4944A']

const SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rectangle', label: 'Rectángulo' },
  { value: 'pill', label: 'Píldora' },
  { value: 'circle', label: 'Círculo' },
  { value: 'diamond', label: 'Rombo' },
  // Rótulo: texto pequeño en mayúsculas, sin caja (los subgrupos, «Concepto y epidemiología»).
  { value: 'label', label: 'Rótulo' },
]

function ShapeIcon({ shape }: { shape: NodeShape }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 } as const
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden>
      {shape === 'rectangle' && <rect x="3" y="4" width="20" height="12" rx="3" {...common} />}
      {shape === 'pill' && <rect x="2" y="5" width="22" height="10" rx="5" {...common} />}
      {shape === 'circle' && <circle cx="13" cy="10" r="7.5" {...common} />}
      {shape === 'diamond' && <path d="M13 2 L23 10 L13 18 L3 10 Z" strokeLinejoin="round" {...common} />}
      {shape === 'label' && <path d="M4 8 H22 M7 12.5 H19" strokeLinecap="round" {...common} strokeWidth={2.2} />}
    </svg>
  )
}

const POPUP_W = 272
const POPUP_H_EST = 420
/** Debajo de la barra superior (y de la caja del título). */
const TOP_SAFE = 52 + 14 // debajo de la cabecera del editor (BAR_H) y un respiro
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

/**
 * Solo monta el contenido cuando el panel está abierto: con él cerrado no hay suscripciones a los
 * nodos de React Flow (`useNodes`) ni selectores que recorran el mapa en cada fotograma de un
 * arrastre.
 */
export function StylePanel() {
  const open = useUIStore((s) => s.stylePanelOpen)
  const id = useUIStore((s) => s.selectedNodeId)
  return <AnimatePresence>{open && id && <StylePanelBody key={id} />}</AnimatePresence>
}

function StylePanelBody() {
  const { selectedNodeId, setStylePanelOpen } = useUIStore()
  const node = useMindMapStore(useShallow((s) => s.nodes.find((n) => n.id === selectedNodeId)))
  // Si el nodo desde el que se abre el panel forma parte de una selección múltiple, el panel
  // edita toda la selección; si no, solo ese nodo.
  const selectedIds = useMindMapStore(useShallow((s) => s.nodes.filter((n) => n.selected).map((n) => n.id)))
  const targetIds =
    selectedNodeId && selectedIds.length > 1 && selectedIds.includes(selectedNodeId) ? selectedIds : node ? [node.id] : []
  const targetStyles = useMindMapStore(
    useShallow((s) => s.nodes.filter((n) => targetIds.includes(n.id)).map((n) => n.data.style)),
  )
  const targetCategories = useMindMapStore(
    useShallow((s) => s.nodes.filter((n) => targetIds.includes(n.id)).map((n) => n.data.category)),
  )
  const updateNodesStyle = useMindMapStore((s) => s.updateNodesStyle)
  // Las tablas no tienen forma (son siempre un recuadro): con solo tablas, la sección lo dice.
  const onlyTables = useMindMapStore(
    (s) => targetIds.length > 0 && targetIds.every((tid) => !!s.nodes.find((n) => n.id === tid)?.data.table),
  )
  const categoryStyles = useUIStore((s) => s.categoryStyles)
  const t = useTheme()

  const { flowToScreenPosition } = useReactFlow()
  const allNodes = useNodes()

  const update = (style: Partial<NodeStyle>) => {
    if (targetIds.length) updateNodesStyle(targetIds, style)
  }

  /** El valor si todos los nodos editados lo comparten; si difieren, ninguno sale marcado. */
  const shared = <K extends keyof NodeStyle>(key: K): NodeStyle[K] | undefined => {
    const first = targetStyles[0]?.[key]
    return targetStyles.every((st) => st[key] === first) ? first : undefined
  }
  /**
   * Cambio de forma. A rótulo: letra pequeña (y borde ≥ 1, que no se dibuja: con borde 0 aplicar una
   * categoría lo pondría macizo con letra blanca). De rótulo a otra forma: la letra vuelve a 14.
   */
  const shapeChange = (shape: NodeShape): Partial<NodeStyle> => {
    if (shape === 'label') {
      return { shape, fontSize: LABEL_FONT_SIZE, ...(targetStyles.some((st) => st.borderWidth === 0) ? { borderWidth: 1 } : {}) }
    }
    if (shared('shape') === 'label' && shared('fontSize') === LABEL_FONT_SIZE) return { shape, fontSize: 14 }
    return { shape }
  }
  const sharedCategory = targetCategories.every((c) => c === targetCategories[0]) ? targetCategories[0] : undefined
  const many = targetIds.length > 1
  const borderWidth = shared('borderWidth')

  // Elegir categoría: la guarda en los nodos, recolorea su estilo y la línea que llega a ellos.
  const applyCategory = (category: MapCategoryId) => {
    if (targetIds.length) applyCategoryToNodes(targetIds, category)
  }

  // Devuelve los nodos editados a su estilo de serie (por nivel y categoría).
  const reset = () => {
    if (targetIds.length) resetNodesStyle(targetIds)
  }

  // Alto real del panel (cambia con el contenido: categorías, colores…). Callback ref + observer:
  // se mide al montarse y cada vez que crece o mengua.
  const [panelH, setPanelH] = useState<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    const ro = new ResizeObserver(() => setPanelH(el.scrollHeight))
    ro.observe(el)
    observer.current = ro
  }, [])

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

    // Centrado en el nodo pero dentro de la pantalla, con el alto REAL del panel (antes se usaba
    // uno estimado de 360 px y el panel, más alto, se salía por abajo). Por arriba, sin tapar la
    // barra superior.
    const h = Math.min(panelH ?? POPUP_H_EST, window.innerHeight - TOP_SAFE - MARGIN)
    let top = screenPos.y + nH / 2 - h / 2
    top = Math.max(TOP_SAFE, Math.min(window.innerHeight - h - MARGIN, top))

    return { position: 'fixed', left, top, transformOrigin }
  }

  return (
    <>
      {node && (
        <motion.div
          key={selectedNodeId}
          ref={measureRef}
          data-tuto="style-panel"
          variants={popupVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            ...getPopupStyle(),
            width: POPUP_W,
            maxHeight: `calc(100vh - ${TOP_SAFE + MARGIN}px)`,
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: '14px 16px',
            zIndex: 1000,
            boxShadow: `0 8px 40px ${t.shadow}`,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            transition: 'background 400ms ease, border-color 400ms ease',
          }}
        >
          {/* Cabecera */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: t.textPrimary, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
              {many ? `Estilo de ${targetIds.length} nodos` : 'Estilo del nodo'}
            </span>
            <button
              onClick={() => setStylePanelOpen(false)}
              aria-label="Cerrar"
              title="Cerrar (Esc)"
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {MAP_CATEGORY_LIST.map((c) => {
                const active = sharedCategory === c.id
                const color = categoryAccent(c.id, categoryStyles)
                return (
                  <button
                    key={c.id}
                    onClick={() => applyCategory(c.id)}
                    title={`${categoryLabel(c.id, categoryStyles)} (tecla ${categoryNumber(c.id)})`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 8px',
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
                    {categoryLabel(c.id, categoryStyles)}
                    <span style={{ opacity: 0.55, fontSize: 10, fontWeight: 700 }}>{categoryNumber(c.id)}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Forma */}
          <Section label="Forma" textMuted={t.textMuted}>
            {onlyTables ? (
              <p style={{ margin: 0, fontSize: 11, color: t.textMuted }}>Las tablas son siempre un recuadro.</p>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {SHAPES.map((sh) => {
                const isActive = shared('shape') === sh.value
                return (
                  <button
                    key={sh.value}
                    onClick={() => update(shapeChange(sh.value))}
                    title={sh.label}
                    aria-label={sh.label}
                    aria-pressed={isActive}
                    style={{
                      padding: '7px 0 5px',
                      borderRadius: 9,
                      border: `1.5px solid ${isActive ? t.accent : t.border}`,
                      background: isActive ? (t.isDark ? '#313244' : t.bgPanel2) : 'transparent',
                      color: isActive ? t.accent : t.textSecondary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      fontFamily: 'inherit',
                      fontSize: 9.5,
                      fontWeight: 600,
                      transition: 'all 150ms',
                    }}
                  >
                    <ShapeIcon shape={sh.value} />
                    {sh.label}
                  </button>
                )
              })}
            </div>
            )}
          </Section>

          {/* Relleno */}
          <Section label="Relleno" textMuted={t.textMuted}>
            <ColorGrid
              colors={BG_COLORS}
              selected={shared('color')}
              onSelect={(c) => update({ color: c })}
              accentColor={t.accent}
              name="relleno"
            />
          </Section>

          {/* Borde */}
          <Section label="Borde" textMuted={t.textMuted}>
            <ColorGrid
              colors={BG_COLORS}
              selected={shared('borderColor')}
              onSelect={(c) => update({ borderColor: c, glowColor: c })}
              accentColor={t.accent}
              name="borde"
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <span style={{ color: t.textSecondary, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Grosor {borderWidth === undefined ? '· varios' : `· ${borderWidth} px`}
              </span>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                aria-label="Grosor del borde"
                value={borderWidth ?? node.data.style.borderWidth}
                onChange={(e) => update({ borderWidth: Number(e.target.value) })}
                style={{ flex: 1, minWidth: 0, accentColor: t.accent }}
              />
            </div>
          </Section>

          {/* Texto */}
          <Section label="Color del texto" textMuted={t.textMuted}>
            <ColorGrid
              colors={TEXT_COLORS}
              selected={shared('textColor')}
              onSelect={(c) => update({ textColor: c })}
              accentColor={t.accent}
              name="texto"
            />
          </Section>

          {/* Pie: volver al estilo de serie */}
          <button
            type="button"
            data-tuto="style-reset"
            onClick={reset}
            title="Devuelve el nodo a su estilo de serie (Ctrl+Z lo deshace)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.textSecondary,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <RotateCcw size={13} />
            Restablecer estilo
          </button>
        </motion.div>
      )}
    </>
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
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

/** Si el color es claro (para elegir el color de la marca de selección encima). */
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return true
  const n = parseInt(m[1], 16)
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150
}

function ColorGrid({
  colors,
  selected,
  onSelect,
  accentColor,
  name,
}: {
  colors: string[]
  selected: string | undefined
  onSelect: (c: string) => void
  accentColor: string
  name: string
}) {
  const custom = selected !== undefined && !colors.some((c) => c.toLowerCase() === selected.toLowerCase())
  const customValue = custom && /^#[0-9a-f]{6}$/i.test(selected) ? selected : '#E8A598'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 5 }}>
      {colors.map((c) => {
        const on = selected?.toLowerCase() === c.toLowerCase()
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            title={c}
            aria-label={`Color ${c} (${name})`}
            aria-pressed={on}
            style={{
              aspectRatio: '1',
              borderRadius: 7,
              background: c,
              border: `2px solid ${on ? accentColor : 'rgba(0,0,0,0.12)'}`,
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLight(c) ? '#2A2420' : '#fff',
              transition: 'border-color 100ms, transform 100ms',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.12)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
          >
            {on && <Check size={11} strokeWidth={3.5} />}
          </button>
        )
      })}
      {/* Cualquier otro color */}
      <label
        title="Otro color…"
        style={{
          aspectRatio: '1',
          borderRadius: 7,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          border: `2px solid ${custom ? accentColor : 'rgba(0,0,0,0.12)'}`,
          background: custom
            ? customValue
            : 'conic-gradient(#f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)',
        }}
      >
        <input
          type="color"
          aria-label={`Otro color (${name})`}
          value={customValue}
          onChange={(e) => onSelect(e.target.value.toUpperCase())}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </label>
    </div>
  )
}
