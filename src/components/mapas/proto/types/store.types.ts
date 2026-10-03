import type { CategoryStyles } from '@/lib/mapas/graph'
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react'
import type { MindMapNode, NodeData, NodeStyle } from './node.types'
import type { MindMapEdge, EdgeData } from './edge.types'

export interface MindMapState {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  /** Sube en cada carga de un mapa: el motor de física no debe reaccionar a eso. */
  loadTick: number
  editingNodeId: string | null
  editSeed: string | null
  focusedNodeId: string | null
  hoveredNodeId: string | null

  load: (nodes: MindMapNode[], edges: MindMapEdge[]) => void
  onNodesChange: (changes: NodeChange<MindMapNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  addNode: (parentId?: string, direction?: 'top' | 'bottom' | 'left' | 'right') => string
  deleteNode: (id: string) => void
  updateNodeData: (id: string, data: Partial<NodeData>) => void
  updateNodeStyle: (id: string, style: Partial<NodeStyle>) => void
  /** Lo mismo para varios nodos a la vez (selección múltiple): un solo paso de deshacer. */
  updateNodesStyle: (ids: string[], style: Partial<NodeStyle>) => void
  updateEdgeAnimating: (id: string, val: boolean) => void
  updateEdgeData: (id: string, data: Partial<EdgeData>) => void
  pasteNodes: (nodes: MindMapNode[], edges: MindMapEdge[]) => void
  /** Abre el editor de texto de un nodo. `seed`: texto con el que arranca (lo escrito con el nodo seleccionado). */
  setEditing: (id: string | null, seed?: string | null) => void
  setFocused: (id: string | null) => void
  setHovered: (id: string | null) => void
  connectNodes: (connection: Connection) => void
  deleteEdge: (id: string) => void
  /** Pliega o despliega la rama de un nodo. */
  toggleCollapse: (id: string) => void
  /** Recalcula lo oculto por ramas plegadas (tras cambios en la jerarquía). */
  syncCollapse: () => void
}

export type BgStyle = 'flat' | 'dots-light' | 'dots'

export interface UIState {
  stylePanelOpen: boolean
  /** Hay más de un nodo seleccionado: la barra de grupo sustituye a la de cada nodo. */
  multiSelect: boolean
  /** La cámara no se mueve sola (las demostraciones del tutorial la tienen fijada). */
  cameraLocked: boolean
  setCameraLocked: (v: boolean) => void
  /** Desenfocar lo que no está conectado al nodo bajo el ratón (por defecto, sí). */
  focusBlur: boolean
  setFocusBlur: (v: boolean) => void
  setMultiSelect: (v: boolean) => void
  selectedNodeId: string | null
  theme: 'dark' | 'light'
  bgStyle: BgStyle
  isDragging: boolean
  physicsEnabled: boolean
  /** Colores y formas que el usuario ha redefinido para las categorías de este mapa. */
  categoryStyles: CategoryStyles
  categoriesPanelOpen: boolean
  /** Buscador de nodos (Ctrl+F) abierto. */
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  setCategoryStyles: (styles: CategoryStyles) => void
  setCategoriesPanelOpen: (open: boolean) => void
  setPhysicsEnabled: (v: boolean) => void
  setStylePanelOpen: (open: boolean) => void
  setSelectedNodeId: (id: string | null) => void
  setTheme: (theme: 'dark' | 'light') => void
  setBgStyle: (bg: BgStyle) => void
  setDragging: (v: boolean) => void
}

export interface HistoryState {
  past: Array<{ nodes: MindMapNode[]; edges: MindMapEdge[] }>
  future: Array<{ nodes: MindMapNode[]; edges: MindMapEdge[] }>
  pushSnapshot: (nodes: MindMapNode[], edges: MindMapEdge[]) => void
  clear: () => void
  undo: () => void
  redo: () => void
}
