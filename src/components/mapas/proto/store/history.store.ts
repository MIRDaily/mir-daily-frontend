import { create } from 'zustand'
import type { HistoryState } from '@/components/mapas/proto/types/store.types'
import { useMindMapStore } from './mindmap.store'
import { withoutPhysics } from '@/components/mapas/proto/hooks/usePhysics'

const MAX_HISTORY = 50

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  clear: () => set({ past: [], future: [] }),

  pushSnapshot: (nodes, edges) =>
    set((s) => {
      const snapshot = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      }
      const past = [...s.past, snapshot].slice(-MAX_HISTORY)
      return { past, future: [] }
    }),

  undo: () => {
    const { past, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    const currentNodes = useMindMapStore.getState().nodes
    const currentEdges = useMindMapStore.getState().edges
    set({
      past: past.slice(0, -1),
      future: [
        { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) },
        ...future,
      ],
    })
    withoutPhysics(() => useMindMapStore.setState({ nodes: previous.nodes, edges: previous.edges }))
  },

  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return
    const next = future[0]
    const currentNodes = useMindMapStore.getState().nodes
    const currentEdges = useMindMapStore.getState().edges
    set({
      past: [
        ...past,
        { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) },
      ],
      future: future.slice(1),
    })
    withoutPhysics(() => useMindMapStore.setState({ nodes: next.nodes, edges: next.edges }))
  },
}))
