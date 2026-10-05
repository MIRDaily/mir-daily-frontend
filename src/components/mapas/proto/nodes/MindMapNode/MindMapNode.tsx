import { memo, useCallback } from 'react'
import { NodeToolbar, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Trash2, Plus, Palette, FlipHorizontal2 } from 'lucide-react'
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
import { addChildAndEdit } from '@/components/mapas/proto/utils/keyboard'
import { mirrorBranches } from '@/components/mapas/proto/utils/branches'

function MindMapNodeInner({ id, data, selected }: NodeProps<MindMapNode>) {
  // Solo se lee lo que este nodo pinta; las acciones se piden a la store en el momento de
  // usarlas. Suscribirse a toda la store re-renderizaba los ~80 nodos en cada cambio.
  const { setCenter } = useReactFlow()

  // Entrada de un nodo nuevo: declarativa (animate="visible" mientras es nuevo). Antes se lanzaba
  // con controls.start() en un efecto de montaje que solo corría una vez; con el doble montaje de
  // React en desarrollo la animación no arrancaba y el nodo se quedaba en opacity 0 / scale 0. Si
  // además estaba en edición (creado con Tab), seguía invisible mientras se escribía.

  const isEditing = useMindMapStore((s) => s.editingNodeId === id)
  // Con varios seleccionados la barra es una sola para el grupo (GroupToolbar), no una por nodo.
  const multiSelect = useUIStore((s) => s.multiSelect)
  const editSeed = useMindMapStore((s) => (s.editingNodeId === id ? s.editSeed : null))

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

  // Tab mientras se escribe: el texto ya se ha guardado; se crea un hijo y se sigue escribiendo.
  const handleTab = useCallback(() => {
    addChildAndEdit(id)
  }, [id])

  const handleExit = useCallback(() => {
    useMindMapStore.getState().setEditing(null)
  }, [])

  const spawnChild = useCallback((direction?: 'top' | 'bottom' | 'left' | 'right') => {
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    const newId = store.addNode(id, direction)
    setTimeout(() => {
      const newNode = useMindMapStore.getState().nodes.find((n) => n.id === newId)
      if (newNode && !useUIStore.getState().cameraLocked) {
        setCenter(newNode.position.x, newNode.position.y, { duration: 600, zoom: 1 })
      }
    }, 150)
  }, [id, setCenter])

  const handleAddChild = useCallback(() => spawnChild(), [spawnChild])

  const handleDelete = useCallback(() => {
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    store.deleteNode(id)
  }, [id])

  const handleMirror = useCallback(() => {
    mirrorBranches([id])
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
        animate={data.isNew ? 'visible' : animateState}
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
            <NodeEditor
              label={data.label}
              style={data.style}
              onSave={handleSave}
              onExit={handleExit}
              onTab={handleTab}
              selectAll={data.label === 'Nueva idea'}
              seed={editSeed}
            />
          ) : (
            <NodeLabel label={data.label} style={data.style} />
          )}
        </NodeBody>
      </motion.div>

      <NodeToolbar isVisible={!!selected && !isEditing && !multiSelect} position={Position.Top}>
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
          {data.parentId && (
            <ToolbarBtn onClick={handleMirror} title="Pasar la rama al otro lado, en espejo (Alt+M)" color={t.textSecondary} hoverBg={t.hoverBg}>
              <FlipHorizontal2 size={14} />
            </ToolbarBtn>
          )}
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
