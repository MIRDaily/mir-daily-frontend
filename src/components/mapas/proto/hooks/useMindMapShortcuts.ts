import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'
import { applyCategoryToNodes } from '@/components/mapas/proto/utils/categories'
import { categoryForKey } from '@/lib/mapas/types'

interface Clipboard {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}

export function useMindMapShortcuts() {
  const { getNodes, getEdges } = useReactFlow()
  const clipboardRef = useRef<Clipboard | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isEditing =
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA'

      if (isEditing) return

      const isMod = e.metaKey || e.ctrlKey
      // Estado leído en el momento del evento: suscribirse a las stores enteras re-registraba
      // este listener (y re-renderizaba el lienzo) en cada cambio, incluido cada hover.
      const store   = useMindMapStore.getState()
      const history = useHistoryStore.getState()
      const ui      = useUIStore.getState()

      // ── Delete / Backspace ──────────────────────────────────────────────────
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = getNodes().filter((n) => n.selected)
        const selectedEdges = getEdges().filter((edge) => edge.selected)
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          history.pushSnapshot(store.nodes, store.edges)
          selectedNodes.forEach((n) => store.deleteNode(n.id))
          selectedEdges.forEach((edge) => store.deleteEdge(edge.id))
        }
      }

      // ── Copy ────────────────────────────────────────────────────────────────
      if (isMod && e.key === 'c') {
        const selectedNodes = getNodes().filter((n) => n.selected) as MindMapNode[]
        if (selectedNodes.length === 0) return
        const selectedIds = new Set(selectedNodes.map((n) => n.id))
        const internalEdges = getEdges().filter(
          (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
        ) as MindMapEdge[]
        clipboardRef.current = { nodes: selectedNodes, edges: internalEdges }
      }

      // ── Cut ─────────────────────────────────────────────────────────────────
      if (isMod && e.key === 'x') {
        const selectedNodes = getNodes().filter((n) => n.selected) as MindMapNode[]
        const selectedEdges = getEdges().filter((edge) => edge.selected) as MindMapEdge[]
        if (selectedNodes.length === 0 && selectedEdges.length === 0) return

        const selectedIds = new Set(selectedNodes.map((n) => n.id))
        const internalEdges = getEdges().filter(
          (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
        ) as MindMapEdge[]
        clipboardRef.current = { nodes: selectedNodes, edges: internalEdges }

        history.pushSnapshot(store.nodes, store.edges)
        selectedNodes.forEach((n) => store.deleteNode(n.id))
        // Delete selected standalone edges not removed by deleteNode
        selectedEdges
          .filter((edge) => !selectedIds.has(edge.source) && !selectedIds.has(edge.target))
          .forEach((edge) => store.deleteEdge(edge.id))
      }

      // ── Paste ───────────────────────────────────────────────────────────────
      if (isMod && e.key === 'v') {
        const cb = clipboardRef.current
        if (!cb || cb.nodes.length === 0) return
        e.preventDefault()
        history.pushSnapshot(store.nodes, store.edges)
        store.pasteNodes(cb.nodes, cb.edges)
      }

      // ── Undo / Redo ─────────────────────────────────────────────────────────
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        history.undo()
      }
      if (isMod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        history.redo()
      }

      // ── 1–7: categoría del nodo bajo el cursor ─────────────────────────────
      // Si ese nodo forma parte de una selección múltiple, se aplica a toda la selección.
      if (!isMod && !e.altKey && !e.shiftKey) {
        const category = categoryForKey(e.key)
        const hovered = useMindMapStore.getState().hoveredNodeId
        if (category && hovered) {
          e.preventDefault()
          const selected = getNodes()
            .filter((n) => n.selected)
            .map((n) => n.id)
          applyCategoryToNodes(selected.includes(hovered) ? selected : [hovered], category)
        }
      }

      // ── Escape ──────────────────────────────────────────────────────────────
      if (e.key === 'Escape') {
        store.setEditing(null)
        ui.setSelectedNodeId(null)
        ui.setStylePanelOpen(false)
      }

      // ── New node (n) ────────────────────────────────────────────────────────
      if (e.key === 'n' && !isMod) {
        history.pushSnapshot(store.nodes, store.edges)
        store.addNode()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [getNodes, getEdges])
}
