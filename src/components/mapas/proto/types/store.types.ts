import type { CategoryStyles, FuenteIA, LabelStyle } from '@/lib/mapas/graph'
import type { AccionRama } from '@/lib/mapas/ia/rama'
import type { MapTable } from '@/lib/mapas/table'
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
  /** Tabla nueva colgando de `parentId` (o suelta). Devuelve su id. */
  addTable: (parentId?: string) => string
  /** Cambia la tabla de un nodo (y su label, que es su copia en texto). */
  updateTable: (id: string, fn: (t: MapTable) => MapTable) => void
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

/** Tabla abierta en su editor (el popup). Celda de entrada: fila -2 = título, -1 = cabecera. */
export type TableEditorTarget = {
  id: string
  r: number
  c: number
  /** Texto que sustituye al de la celda (se abrió escribiendo con la tabla seleccionada). */
  seed: string | null
  /** Entrar con el contenido seleccionado (lo que se escribe lo sustituye). */
  select: boolean
}

export interface UIState {
  /**
   * Modo estudio: las hojas (o el dato tras «Faceta:») se tapan y se destapan con un clic. El
   * lienzo se puede mover y plegar, pero no editar. No se guarda en el mapa.
   */
  studyMode: boolean
  setStudyMode: (v: boolean) => void
  /** Hojas destapadas en el modo estudio. */
  revealed: ReadonlySet<string>
  /** Destapa (`on`) o vuelve a tapar esas hojas. */
  setRevealed: (ids: Iterable<string>, on: boolean) => void
  /** Tapa todo otra vez. */
  coverAll: () => void
  /** Cómo se ven los rótulos (forma `label`) en este mapa. Se guarda en sus ajustes. */
  labelStyle: LabelStyle
  setLabelStyle: (s: LabelStyle) => void
  /** Panel «Convertir subgrupos en rótulos» abierto. */
  subgroupConvertOpen: boolean
  setSubgroupConvertOpen: (v: boolean) => void
  /** Id del mapa abierto (el documento de la IA se guarda en el navegador por mapa). */
  mapaId: string | null
  setMapaId: (id: string | null) => void
  /** Archivo del que salió el mapa con IA (hash y nombre). Se guarda en sus ajustes. */
  fuente: FuenteIA | null
  setFuente: (f: FuenteIA | null) => void
  /** La IA de mapas está disponible para este usuario: el clic derecho abre el menú de rama. */
  iaRamas: boolean
  setIaRamas: (v: boolean) => void
  /** Menú de clic derecho de un nodo (rehacer, ampliar o resumir con IA). */
  menuRama: { id: string; x: number; y: number } | null
  setMenuRama: (m: { id: string; x: number; y: number } | null) => void
  /** Diálogo «Añadir un documento al mapa» abierto. */
  anadirDoc: boolean
  setAnadirDoc: (v: boolean) => void
  /** Diálogo de rama con IA abierto. */
  ramaIA: { id: string; accion: AccionRama } | null
  setRamaIA: (r: { id: string; accion: AccionRama } | null) => void
  /** Nodo del que se van a crear flashcards (abre su diálogo). */
  flashcardsFrom: string | null
  setFlashcardsFrom: (id: string | null) => void
  /** Tabla abierta en el popup de edición. */
  tableEditor: TableEditorTarget | null
  setTableEditor: (target: TableEditorTarget | null) => void
  stylePanelOpen: boolean
  /** Hay más de un nodo seleccionado: la barra de grupo sustituye a la de cada nodo. */
  multiSelect: boolean
  /** Diálogo de exportación abierto. */
  exportOpen: boolean
  setExportOpen: (v: boolean) => void
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
