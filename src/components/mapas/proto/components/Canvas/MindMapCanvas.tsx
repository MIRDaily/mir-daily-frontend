import {
  ReactFlow,
  Controls,
  SelectionMode,
  ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { nodeTypes } from '@/components/mapas/proto/nodes/nodeTypes'
import { edgeTypes } from '@/components/mapas/proto/edges/edgeTypes'
import { useMindMapShortcuts } from '@/components/mapas/proto/hooks/useMindMapShortcuts'
import { useFocusController } from '@/components/mapas/proto/hooks/useFocusMode'
import { usePhysics } from '@/components/mapas/proto/hooks/usePhysics'
import { useBranchDrag } from '@/components/mapas/proto/hooks/useBranchDrag'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { EdgeStylePanel } from './EdgeStylePanel'

export function MindMapCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, connectNodes } = useMindMapStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      connectNodes: s.connectNodes,
    }))
  )

  const t               = useTheme()
  const setStylePanelOpen = useUIStore((s) => s.setStylePanelOpen)
  // Used to set data-selected-count for CSS-based multi-select indicator
  const wrapperRef = useRef<HTMLDivElement>(null)

  useMindMapShortcuts()
  useFocusController(wrapperRef)
  usePhysics()
  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useBranchDrag()

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connectNodes}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={() => setStylePanelOpen(false)}
        onSelectionChange={({ nodes: sel }) => {
          if (wrapperRef.current)
            wrapperRef.current.dataset.selectedCount = String(sel.length)
        }}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        selectionMode={SelectionMode.Partial}
        // Left-drag on empty canvas = box selection
        selectionOnDrag
        // Free left button for selection; pan with middle/right click or scroll
        panOnDrag={[1, 2]}
        panOnScroll
        deleteKeyCode={null}
        style={{ background: 'transparent', zIndex: 1 }}
        defaultEdgeOptions={{ type: 'animated', data: { isAnimating: false } }}
        minZoom={0.05}
        maxZoom={3}
        // El prototipo acotaba el lienzo a 8000×6000; un mapa de decenas de nodos
        // (o uno generado) es más alto que eso y los nodos del final se apilaban en el borde.
        translateExtent={[[-40000, -40000], [40000, 40000]]}
        nodeExtent={[[-38000, -38000], [38000, 38000]]}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          style={{
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: `0 2px 12px ${t.shadow}`,
          }}
        />
        <EdgeStylePanel />
      </ReactFlow>
    </div>
  )
}
