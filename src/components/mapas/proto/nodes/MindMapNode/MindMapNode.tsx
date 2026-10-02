import { memo, useCallback, useEffect, useRef } from 'react'
import { NodeToolbar, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { motion, useAnimationControls } from 'framer-motion'
import { Trash2, Plus, Palette } from 'lucide-react'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { nodeVariants } from '@/components/mapas/proto/animations/variants'
import { NodeBody } from './NodeBody'
import { NodeLabel } from './NodeLabel'
import { NodeEditor } from './NodeEditor'
import { NodeHandles } from './NodeHandles'
import { BranchToggle } from './BranchToggle'

function MindMapNodeInner({ id, data, selected }: NodeProps<MindMapNode>) {
  // Solo se lee lo que este nodo pinta; las acciones se piden a la store en el momento de
  // usarlas. Suscribirse a toda la store re-renderizaba los ~80 nodos en cada cambio.
  const { setCenter } = useReactFlow()
  const controls = useAnimationControls()
  const isFirstMount = useRef(true)

  // Entry animation for new nodes
  useEffect(() => {
    if (!isFirstMount.current) return
    isFirstMount.current = false
    if (data.isNew) {
      controls.start('visible')
    } else {
      controls.set('idle')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = useMindMapStore((s) => s.editingNodeId === id)

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      useMindMapStore.getState().setEditing(id)
    },
    [id]
  )

  const handleSave = useCallback(
    (text: string) => {
      useMindMapStore.getState().updateNodeData(id, { label: text })
    },
    [id]
  )

  const handleExit = useCallback(() => {
    useMindMapStore.getState().setEditing(null)
  }, [])

  const spawnChild = useCallback((direction?: 'top' | 'bottom' | 'left' | 'right') => {
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    controls.start('dividing').then(() => controls.start('idle'))
    const newId = store.addNode(id, direction)
    setTimeout(() => {
      const newNode = useMindMapStore.getState().nodes.find((n) => n.id === newId)
      if (newNode) {
        setCenter(newNode.position.x, newNode.position.y, { duration: 600, zoom: 1 })
      }
    }, 150)
  }, [id, controls, setCenter])

  const handleAddChild = useCallback(() => spawnChild(), [spawnChild])

  const handleDelete = useCallback(() => {
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    store.deleteNode(id)
  }, [id])

  const handleOpenStyle = useCallback(() => {
    const ui = useUIStore.getState()
    ui.setSelectedNodeId(id)
    ui.setStylePanelOpen(true)
  }, [id])

  // Ctrl+Right-click → open style popup
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      const ui = useUIStore.getState()
      ui.setSelectedNodeId(id)
      ui.setStylePanelOpen(true)
    },
    [id],
  )

  const animateState = isEditing ? 'editing' : selected ? 'selected' : 'idle'
  const t = useTheme()

  return (
    <div
      className="mindmap-node-root"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => useMindMapStore.getState().setHovered(id)}
      onMouseLeave={() => useMindMapStore.getState().setHovered(null)}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <NodeResizer
        isVisible={!!selected && !isEditing}
        minWidth={100}
        minHeight={36}
        lineStyle={{ display: 'none' }}
      />
      <NodeHandles onQuickAdd={spawnChild} />
      {!!data.childCount && !isEditing && (
        <BranchToggle
          nodeId={id}
          collapsed={!!data.collapsed}
          hiddenCount={data.hiddenCount ?? 0}
          side={data.childSide ?? 'right'}
          accent={data.style.glowColor}
        />
      )}

      <motion.div
        initial={data.isNew ? 'initial' : 'idle'}
        animate={data.isNew ? controls : animateState}
        variants={nodeVariants}
        whileHover={isEditing ? undefined : 'hovered'}
        style={{
          width: '100%',
          height: '100%',
          filter: selected ? `drop-shadow(0 0 14px ${data.style.glowColor}88)` : undefined,
        }}
      >
        <NodeBody style={data.style} isSelected={!!selected} isDark={t.isDark}>
          {isEditing ? (
            <NodeEditor label={data.label} style={data.style} onSave={handleSave} onExit={handleExit} />
          ) : (
            <NodeLabel label={data.label} style={data.style} />
          )}
        </NodeBody>
      </motion.div>

      <NodeToolbar isVisible={!!selected && !isEditing} position={Position.Top}>
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: '4px 6px',
            boxShadow: `0 4px 16px ${t.shadow}`,
          }}
        >
          <ToolbarBtn onClick={handleAddChild} title="Añadir nodo hijo" color={t.accent} hoverBg={t.hoverBg}>
            <Plus size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={handleOpenStyle} title="Estilos" color={t.accentGreen} hoverBg={t.hoverBg}>
            <Palette size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={handleDelete} title="Eliminar (Del)" color={t.danger} hoverBg={t.hoverBg}>
            <Trash2 size={14} />
          </ToolbarBtn>
        </div>
      </NodeToolbar>
    </div>
  )
}

function ToolbarBtn({
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
        padding: '5px 7px',
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

export const MindMapNodeComponent = memo(MindMapNodeInner, (prev, next) => {
  // Skip re-render for position changes — RF handles those via transform
  return (
    prev.selected === next.selected &&
    prev.data.label === next.data.label &&
    prev.data.isNew === next.data.isNew &&
    prev.data.isRemoving === next.data.isRemoving &&
    prev.data.collapsed === next.data.collapsed &&
    prev.data.childCount === next.data.childCount &&
    prev.data.hiddenCount === next.data.hiddenCount &&
    prev.data.childSide === next.data.childSide &&
    JSON.stringify(prev.data.style) === JSON.stringify(next.data.style) &&
    (prev as { id: string }).id === (next as { id: string }).id
  )
})
