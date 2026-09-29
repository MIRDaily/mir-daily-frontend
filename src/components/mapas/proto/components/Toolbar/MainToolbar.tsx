import { Plus, Undo2, Redo2, HelpCircle, Moon, Sun, FileDown, FileJson, Network, Orbit, Shapes, Loader2 } from 'lucide-react'
import type { BgStyle } from '@/components/mapas/proto/types/store.types'
import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { exportToPdf } from '@/components/mapas/proto/utils/exportPdf'

interface MainToolbarProps {
  onExportJson: () => void
  onAutoLayout: () => void
}

export function MainToolbar({ onExportJson, onAutoLayout }: MainToolbarProps) {
  const { theme, setTheme, bgStyle, setBgStyle, physicsEnabled, setPhysicsEnabled, categoriesPanelOpen, setCategoriesPanelOpen } = useUIStore()
  const { setCenter, setNodes } = useReactFlow()
  const [showHelp, setShowHelp]       = useState(false)
  const [exporting, setExporting]     = useState(false)
  const t = useTheme()
  const isDark = theme === 'dark'

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportToPdf(useMindMapStore.getState().nodes, setNodes)
    } finally {
      setExporting(false)
    }
  }

  const handleAddRoot = () => {
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    const newId = store.addNode()
    setTimeout(() => {
      const node = useMindMapStore.getState().nodes.find((n) => n.id === newId)
      if (node) setCenter(node.position.x, node.position.y, { duration: 600, zoom: 1 })
    }, 150)
  }

  const isLight = !isDark

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: 'calc(100% - 24px)',
          overflowX: 'auto',
          background: t.bgPanel,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: '6px 10px',
          display: 'flex',
          gap: 2,
          boxShadow: `0 4px 24px ${t.shadow}`,
          backdropFilter: 'blur(16px)',
          alignItems: 'center',
          transition: 'background 400ms ease, border-color 400ms ease',
        }}
      >
        <span
          style={{
            color: t.textMuted,
            fontSize: 11,
            fontWeight: 700,
            marginRight: 4,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Mapa Mental
        </span>

        <Divider color={t.border} />

        <Btn onClick={handleAddRoot} title="Nuevo nodo (N)" color={t.accent} hoverBg={t.hoverBg}>
          <Plus size={15} />
          <span style={{ fontSize: 12 }}>Añadir</span>
        </Btn>

        <Divider color={t.border} />

        <Btn onClick={() => useHistoryStore.getState().undo()} title="Deshacer (Cmd+Z)" color={t.textSecondary} hoverBg={t.hoverBg}>
          <Undo2 size={15} />
        </Btn>
        <Btn onClick={() => useHistoryStore.getState().redo()} title="Rehacer (Cmd+Shift+Z)" color={t.textSecondary} hoverBg={t.hoverBg}>
          <Redo2 size={15} />
        </Btn>

        <Divider color={t.border} />

        {/* Background style picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 2px' }}>
          {(['flat', 'dots-light', 'dots'] as BgStyle[]).map((s) => (
            <button
              key={s}
              title={s === 'flat' ? 'Fondo plano' : s === 'dots-light' ? 'Puntos sutiles' : 'Puntos'}
              onClick={() => setBgStyle(s)}
              style={{
                width: 26, height: 26,
                borderRadius: 6,
                border: bgStyle === s ? `1.5px solid ${t.accent}` : `1.5px solid transparent`,
                background: bgStyle === s ? `${t.accent}18` : 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 150ms, background 150ms',
              }}
            >
              <BgIcon type={s} color={bgStyle === s ? t.accent : t.textMuted} />
            </button>
          ))}
        </div>

        <Divider color={t.border} />

        <Btn
          onClick={handleExport}
          title="Exportar como PDF"
          color={exporting ? t.accent : t.textSecondary}
          hoverBg={t.hoverBg}
        >
          {exporting
            ? <Loader2 size={15} style={{ animation: 'mapa-spin 1s linear infinite' }} />
            : <FileDown size={15} />}
          <span style={{ fontSize: 12 }}>PDF</span>
        </Btn>

        <Btn onClick={onExportJson} title="Descargar copia en JSON" color={t.textSecondary} hoverBg={t.hoverBg}>
          <FileJson size={15} />
          <span style={{ fontSize: 12 }}>JSON</span>
        </Btn>

        <Divider color={t.border} />

        <Btn
          onClick={() => setCategoriesPanelOpen(!categoriesPanelOpen)}
          title="Estilos de las categorías"
          color={categoriesPanelOpen ? t.accent : t.textSecondary}
          hoverBg={t.hoverBg}
        >
          <Shapes size={15} />
          <span style={{ fontSize: 12 }}>Categorías</span>
        </Btn>

        <Divider color={t.border} />

        <Btn onClick={onAutoLayout} title="Ordenar el mapa automáticamente" color={t.textSecondary} hoverBg={t.hoverBg}>
          <Network size={15} />
          <span style={{ fontSize: 12 }}>Ordenar</span>
        </Btn>
        <Btn
          onClick={() => setPhysicsEnabled(!physicsEnabled)}
          title={physicsEnabled ? 'Física activada: los nodos se apartan al añadir' : 'Física desactivada'}
          color={physicsEnabled ? t.accent : t.textMuted}
          hoverBg={t.hoverBg}
        >
          <Orbit size={15} />
        </Btn>

        <Divider color={t.border} />

        {/* Theme toggle slider — left=light(off), right=dark(on) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '4px 6px',
          }}
          title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          <Sun size={13} color={isLight ? t.accent : t.textMuted} />
          <div
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: isLight ? t.border2 : t.accent,
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 300ms ease',
              border: `1px solid ${t.border2}`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: isLight ? 2 : 17,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#ffffff',
                transition: 'left 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            />
          </div>
          <Moon size={13} color={isLight ? t.textMuted : t.accent} />
        </div>

        <Divider color={t.border} />

        <Btn
          onClick={() => setShowHelp((v) => !v)}
          title="Atajos de teclado"
          color={showHelp ? t.accent : t.textMuted}
          hoverBg={t.hoverBg}
        >
          <HelpCircle size={15} />
        </Btn>
      </div>

      {showHelp && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: '14px 20px',
            boxShadow: `0 8px 32px ${t.shadow}`,
            minWidth: 300,
            transition: 'background 400ms ease',
          }}
        >
          <div
            style={{
              color: t.textMuted,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 12,
            }}
          >
            Atajos de teclado
          </div>
          {[
            ['Doble clic', 'Editar nodo'],
            ['N', 'Nuevo nodo raíz'],
            ['+ (toolbar)', 'Añadir nodo hijo'],
            ['Delete / Backspace', 'Eliminar seleccionado'],
            ['Cmd/Ctrl + Z', 'Deshacer'],
            ['Cmd/Ctrl + Shift + Z', 'Rehacer'],
            ['Escape', 'Salir de edición'],
            ['Drag handle →', 'Conectar nodos (cualquier punto)'],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 6 }}>
              <kbd
                style={{
                  background: t.kbd,
                  color: t.accent,
                  padding: '2px 8px',
                  borderRadius: 5,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${t.border}`,
                }}
              >
                {key}
              </kbd>
              <span style={{ color: t.textSecondary, fontSize: 13 }}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** Mini SVG icons representing each background style */
function BgIcon({ type, color }: { type: BgStyle; color: string }) {
  if (type === 'flat') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <rect x="1" y="1" width="12" height="12" rx="2" fill={color} />
      </svg>
    )
  }
  if (type === 'dots-light') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        {[2,7,12].flatMap(x => [2,7,12].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={color} opacity="0.5" />
        )))}
      </svg>
    )
  }
  // dots
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      {[2,7,12].flatMap(x => [2,7,12].map(y => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill={color} />
      )))}
    </svg>
  )
}

function Divider({ color }: { color: string }) {
  return <div style={{ width: 1, background: color, height: 20, margin: '0 4px', flexShrink: 0 }} />
}

function Btn({
  onClick,
  title,
  color,
  hoverBg,
  children,
}: {
  onClick: () => void
  title: string
  color: string
  hoverBg: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color,
        padding: '6px 9px',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 13,
        fontWeight: 500,
        transition: 'background 150ms, color 400ms',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = hoverBg)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
    >
      {children}
    </button>
  )
}
