import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { MindMapState } from '@/components/mapas/proto/types/store.types'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import { DEFAULT_NODE_STYLE } from '@/components/mapas/proto/types/node.types'
import { nanoid } from '@/components/mapas/proto/utils/nanoid'
import { useHistoryStore } from './history.store'

// Debounce: only push a snapshot once per 600ms window to avoid flooding history on slider drags
let lastStyleSnapshot = 0
const STYLE_SNAPSHOT_COOLDOWN = 600

function maybeSnapshotStyle() {
  const now = Date.now()
  if (now - lastStyleSnapshot > STYLE_SNAPSHOT_COOLDOWN) {
    lastStyleSnapshot = now
    const s = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(s.nodes, s.edges)
  }
}

/**
 * Sitio para un hijo nuevo sin dirección (botón "+"). El prototipo lo tiraba a un ángulo al azar
 * y los "Nueva idea" acababan encima de cualquier rama. Ahora va como en un mapa en árbol: hacia
 * fuera (el lado contrario al abuelo; a la derecha si es la raíz), en la columna de sus hermanos
 * y debajo del último.
 */
function childSlot(parent: MindMapNode, nodes: MindMapNode[]) {
  const pw = parent.measured?.width ?? 160
  const grand = nodes.find((n) => n.id === parent.data.parentId)
  const side = grand && grand.position.x > parent.position.x ? -1 : 1
  const siblings = nodes.filter(
    (n) => n.data.parentId === parent.id && Math.sign(n.position.x - parent.position.x) === side,
  )
  if (siblings.length === 0) {
    return side > 0
      ? { x: parent.position.x + pw + 90, y: parent.position.y }
      : { x: parent.position.x - 90 - 160, y: parent.position.y }
  }
  const last = siblings.reduce((a, b) =>
    b.position.y + (b.measured?.height ?? 44) > a.position.y + (a.measured?.height ?? 44) ? b : a,
  )
  const x = side > 0
    ? Math.min(...siblings.map((n) => n.position.x))
    : Math.max(...siblings.map((n) => n.position.x + (n.measured?.width ?? 160))) - 160
  return { x, y: last.position.y + (last.measured?.height ?? 44) + 16 }
}

export const useMindMapStore = create<MindMapState>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],
    loadTick: 0,
    editingNodeId: null,
    focusedNodeId: null,
    hoveredNodeId: null,

    load: (nodes, edges) =>
      set((s) => {
        s.nodes = nodes
        s.edges = edges
        s.editingNodeId = null
        s.focusedNodeId = null
        s.hoveredNodeId = null
        s.loadTick += 1
      }),

    onNodesChange: (changes) =>
      set((s) => {
        s.nodes = applyNodeChanges(changes, s.nodes) as MindMapNode[]
      }),

    onEdgesChange: (changes) =>
      set((s) => {
        s.edges = applyEdgeChanges(changes, s.edges) as typeof s.edges
      }),

    addNode: (parentId, direction) => {
      const id = nanoid()
      const nodes = get().nodes
      const parent = nodes.find((n) => n.id === parentId)
      const distance = 230
      const directionAngles = { right: 0, bottom: Math.PI / 2, left: Math.PI, top: -Math.PI / 2 }
      const position = parent
        ? direction
          ? {
              x: parent.position.x + Math.cos(directionAngles[direction]) * distance,
              y: parent.position.y + Math.sin(directionAngles[direction]) * distance,
            }
          : childSlot(parent, nodes)
        : { x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300 }

      // Style inheritance: from parent if child node, otherwise from last created node
      const inheritedStyle = parent
        ? { ...parent.data.style }
        : nodes.length > 0
        ? { ...nodes[nodes.length - 1].data.style }
        : { ...DEFAULT_NODE_STYLE }

      const newNode: MindMapNode = {
        id,
        type: 'mindmap',
        position,
        data: {
          label: 'Nueva idea',
          style: inheritedStyle,
          isEditing: false,
          isFocused: false,
          isNew: true,
          isRemoving: false,
          parentId,
        },
      }

      const oppositeHandle = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' } as const

      set((s) => {
        s.nodes.push(newNode)
        if (parentId) {
          s.edges.push({
            id: `e-${parentId}-${id}`,
            source: parentId,
            target: id,
            sourceHandle: direction ?? null,
            targetHandle: direction ? oppositeHandle[direction] : null,
            type: 'animated',
            data: { isAnimating: true },
          })
        }
      })

      // Clear isNew after animation completes
      setTimeout(() => {
        set((s) => {
          const node = s.nodes.find((n) => n.id === id)
          if (node) node.data.isNew = false
        })
      }, 700)

      return id
    },

    deleteNode: (id) =>
      set((s) => {
        s.nodes = s.nodes.filter((n) => n.id !== id)
        s.edges = s.edges.filter((e) => e.source !== id && e.target !== id)
        if (s.editingNodeId === id) s.editingNodeId = null
        if (s.focusedNodeId === id) s.focusedNodeId = null
        if (s.hoveredNodeId === id) s.hoveredNodeId = null
      }),

    updateNodeData: (id, data) =>
      set((s) => {
        const node = s.nodes.find((n) => n.id === id)
        if (node) Object.assign(node.data, data)
      }),

    updateNodeStyle: (id, style) => {
      maybeSnapshotStyle()
      set((s) => {
        const node = s.nodes.find((n) => n.id === id)
        if (node) Object.assign(node.data.style, style)
      })
    },

    updateEdgeAnimating: (id, val) =>
      set((s) => {
        const edge = s.edges.find((e) => e.id === id)
        if (edge?.data) edge.data.isAnimating = val
      }),

    updateEdgeData: (id, data) => {
      maybeSnapshotStyle()
      set((s) => {
        const edge = s.edges.find((e) => e.id === id)
        if (edge?.data) Object.assign(edge.data, data)
      })
    },

    pasteNodes: (nodes, edges) =>
      set((s) => {
        const idMap = new Map<string, string>()
        const OFFSET = 44

        nodes.forEach((n) => {
          const newId = nanoid()
          idMap.set(n.id, newId)
          s.nodes.push({
            ...n,
            id: newId,
            selected: true,
            position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
            data: { ...n.data, isNew: false, isRemoving: false },
          })
        })

        edges.forEach((e) => {
          const newSrc = idMap.get(e.source)
          const newTgt = idMap.get(e.target)
          if (newSrc && newTgt) {
            s.edges.push({
              ...e,
              id: `e-${newSrc}-${newTgt}-${nanoid()}`,
              source: newSrc,
              target: newTgt,
              selected: false,
              data: { ...(e.data ?? {}), isAnimating: false },
            })
          }
        })
      }),

    setEditing: (id) => set((s) => { s.editingNodeId = id }),
    setFocused: (id) => set((s) => { s.focusedNodeId = id }),
    setHovered: (id) => set((s) => { s.hoveredNodeId = id }),

    connectNodes: (connection) =>
      set((s) => {
        if (!connection.source || !connection.target) return
        // Deduplicate only when the exact same handle pair is already connected
        const exists = s.edges.some(
          (e) =>
            e.source === connection.source &&
            e.target === connection.target &&
            e.sourceHandle === (connection.sourceHandle ?? null) &&
            e.targetHandle === (connection.targetHandle ?? null)
        )
        if (exists) return
        s.edges.push({
          id: `e-${connection.source}-${connection.target}-${nanoid()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? null,
          type: 'animated',
          data: { isAnimating: true },
        })
      }),

    deleteEdge: (id) =>
      set((s) => {
        s.edges = s.edges.filter((e) => e.id !== id)
      }),
  }))
)
