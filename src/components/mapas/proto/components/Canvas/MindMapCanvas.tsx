import {
  ReactFlow,
  useReactFlow,
  Controls,
  SelectionMode,
  ConnectionMode,
  type CoordinateExtent,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'
import { EdgeStylePanel } from './EdgeStylePanel'
import { GroupToolbar } from './GroupToolbar'
import { registerFlow } from '@/components/mapas/proto/utils/keyboard'

// Props de React Flow fuera del render: un objeto/array nuevo en cada render (como estaban
// escritos en línea) cuenta como prop cambiada y React Flow vuelve a procesar todos los nodos
// (p. ej. reencajarlos en `nodeExtent`) en cada fotograma de un arrastre.
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 }
// Botón izquierdo libre para seleccionar; se mueve el lienzo con el central/derecho o la rueda.
const PAN_ON_DRAG = [1, 2]
const FLOW_STYLE = { background: 'transparent', zIndex: 1 }
const DEFAULT_EDGE_OPTIONS = { type: 'animated', data: { isAnimating: false } }
// El prototipo acotaba el lienzo a 8000×6000; un mapa de decenas de nodos
// (o uno generado) es más alto que eso y los nodos del final se apilaban en el borde.
const TRANSLATE_EXTENT: CoordinateExtent = [[-40000, -40000], [40000, 40000]]
const NODE_EXTENT: CoordinateExtent = [[-38000, -38000], [38000, 38000]]
const PRO_OPTIONS = { hideAttribution: true }

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

  // Las acciones de teclado (utils/keyboard) necesitan la vista para llevarla hasta un nodo.
  const flow = useReactFlow<MindMapNode, MindMapEdge>()
  useEffect(() => {
    registerFlow(flow)
    return () => registerFlow(null)
  }, [flow])

  const onPaneClick = useCallback(() => setStylePanelOpen(false), [setStylePanelOpen])
  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    if (wrapperRef.current) wrapperRef.current.dataset.selectedCount = String(sel.length)
    useUIStore.getState().setMultiSelect(sel.length > 1)
  }, [])
  const controlsStyle = useMemo(
    () => ({
      background: t.bgPanel,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: `0 2px 12px ${t.shadow}`,
    }),
    [t.bgPanel, t.border, t.shadow],
  )

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
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        selectionMode={SelectionMode.Partial}
        // Left-drag on empty canvas = box selection
        selectionOnDrag
        panOnDrag={PAN_ON_DRAG}
        panOnScroll
        deleteKeyCode={null}
        // Las flechas navegan entre nodos (useMindMapShortcuts); sin esto React Flow además
        // movería el nodo enfocado 5 px y Tab saltaría de nodo en nodo.
        disableKeyboardA11y
        style={FLOW_STYLE}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        minZoom={0.05}
        maxZoom={3}
        translateExtent={TRANSLATE_EXTENT}
        nodeExtent={NODE_EXTENT}
        proOptions={PRO_OPTIONS}
      >
        <Controls style={controlsStyle} />
        <EdgeStylePanel />
        <GroupToolbar />
      </ReactFlow>
    </div>
  )
}
