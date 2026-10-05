import { memo } from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import { ChevronsDownUp, FlipHorizontal2, Palette, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { applyCategoryToNodes } from '@/components/mapas/proto/utils/categories'
import { mirrorBranches, toggleBranches } from '@/components/mapas/proto/utils/branches'
import { categoryAccent, categoryLabel } from '@/lib/mapas/graph'
import { MAP_CATEGORY_LIST, categoryNumber } from '@/lib/mapas/types'

/**
 * Barra única para una selección múltiple: aparece sobre el conjunto (no una por nodo) y actúa
 * sobre todos a la vez. Con un solo nodo seleccionado sigue saliendo la barra propia del nodo.
 */
function GroupToolbarInner() {
  const ids = useMindMapStore(useShallow((s) => s.nodes.filter((n) => n.selected && !n.hidden).map((n) => n.id)))
  const editing = useMindMapStore((s) => s.editingNodeId !== null)
  const dragging = useUIStore((s) => s.isDragging)
  const categoryStyles = useUIStore((s) => s.categoryStyles)
  const t = useTheme()

  if (ids.length < 2) return null

  const openStyle = () => {
    const ui = useUIStore.getState()
    ui.setSelectedNodeId(ids[0])
    ui.setStylePanelOpen(true)
  }
  const remove = () => {
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    ids.forEach((id) => store.deleteNode(id))
  }

  return (
    <NodeToolbar nodeId={ids} isVisible={!editing && !dragging} position={Position.Top} offset={14}>
      <div
        data-tuto="group-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: t.bgPanel,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: '5px 8px',
          boxShadow: `0 6px 22px ${t.shadow}`,
        }}
      >
        <span style={{ color: t.textSecondary, fontSize: 11, fontWeight: 700, padding: '0 4px', whiteSpace: 'nowrap' }}>
          {ids.length} nodos
        </span>
        <Sep color={t.border} />
        <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Categoría de la selección">
          {MAP_CATEGORY_LIST.map((c) => {
            const color = categoryAccent(c.id, categoryStyles)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => applyCategoryToNodes(ids, c.id)}
                title={`${categoryLabel(c.id, categoryStyles)} (${categoryNumber(c.id)})`}
                aria-label={`Categoría ${categoryLabel(c.id, categoryStyles)}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: color,
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  padding: 0,
                  lineHeight: '18px',
                  textAlign: 'center',
                }}
              >
                {categoryNumber(c.id)}
              </button>
            )
          })}
        </div>
        <Sep color={t.border} />
        <Btn onClick={openStyle} title="Estilo de la selección (Ctrl+E)" color={t.accentGreen} hoverBg={t.hoverBg}>
          <Palette size={14} />
        </Btn>
        <Btn onClick={() => toggleBranches(ids)} title="Plegar / desplegar las ramas (Espacio)" color={t.textSecondary} hoverBg={t.hoverBg}>
          <ChevronsDownUp size={14} />
        </Btn>
        <Btn onClick={() => mirrorBranches(ids)} title="Pasar las ramas al otro lado, en espejo (Alt+M)" color={t.textSecondary} hoverBg={t.hoverBg}>
          <FlipHorizontal2 size={14} />
        </Btn>
        <Btn onClick={remove} title="Eliminar la selección (Supr)" color={t.danger} hoverBg={t.hoverBg}>
          <Trash2 size={14} />
        </Btn>
      </div>
    </NodeToolbar>
  )
}

/** Solo monta la barra con una selección múltiple (la marca `ui.multiSelect`): si no, no recorre los nodos. */
function GroupToolbarGate() {
  const multi = useUIStore((s) => s.multiSelect)
  return multi ? <GroupToolbarInner /> : null
}

export const GroupToolbar = memo(GroupToolbarGate)

function Sep({ color }: { color: string }) {
  return <span aria-hidden style={{ width: 1, height: 16, background: color }} />
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
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color,
        padding: '5px 6px',
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        transition: 'background 150ms',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = hoverBg)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
    >
      {children}
    </button>
  )
}
