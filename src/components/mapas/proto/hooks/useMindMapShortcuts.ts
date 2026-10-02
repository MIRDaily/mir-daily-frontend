import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'
import { applyCategoryToNodes } from '@/components/mapas/proto/utils/categories'
import { categoryForKey } from '@/lib/mapas/types'
import { parentMap } from '@/components/mapas/proto/utils/tree'
import { showUpToLevel, toggleBranch } from '@/components/mapas/proto/utils/branches'
import {
  addChildAndEdit,
  addSiblingAndEdit,
  navigate,
  selectOnly,
  type Direction,
} from '@/components/mapas/proto/utils/keyboard'

const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

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

      // ── Teclado tipo XMind: Tab = hijo, Enter = hermano, F2 = editar, flechas = moverse ──
      // Solo con exactamente un nodo seleccionado y el foco en el lienzo (o en ninguna parte): con
      // el foco en un botón de la barra, Enter debe pulsar ese botón.
      // ── Ctrl+F: buscador del mapa (en vez del de la página) ─────────────────
      if (isMod && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        ui.setSearchOpen(true)
        return
      }

      // ── Alt+1/2/3: ver hasta ese nivel · Alt+0: desplegarlo todo ───────────
      if (e.altKey && !isMod && /^Digit[0-3]$/.test(e.code)) {
        e.preventDefault()
        const level = Number(e.code.slice(5))
        showUpToLevel(level === 0 ? null : level)
        return
      }

      const inCanvas = target === document.body || !!target.closest?.('.react-flow')
      if (!isMod && !e.altKey && inCanvas && !store.editingNodeId) {
        const sel = getNodes().filter((n) => n.selected)
        const one = sel.length === 1 ? sel[0].id : null
        if (one && e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault()
          addChildAndEdit(one)
          return
        }
        if (one && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          addSiblingAndEdit(one)
          return
        }
        if (one && e.key === ' ') {
          // Espacio: plegar/desplegar la rama del nodo seleccionado.
          e.preventDefault()
          toggleBranch(one)
          return
        }
        if (one && e.key === 'F2') {
          e.preventDefault()
          store.setEditing(one)
          return
        }
        const dir = ARROWS[e.key]
        if (one && dir) {
          e.preventDefault()
          navigate(one, dir)
          return
        }
      }

      // ── Delete / Backspace ──────────────────────────────────────────────────
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = getNodes().filter((n) => n.selected)
        const selectedEdges = getEdges().filter((edge) => edge.selected)
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          // Al borrar un solo nodo, la selección pasa a su padre: se puede seguir con el teclado.
          const parent =
            selectedNodes.length === 1 ? parentMap(store.nodes, store.edges).get(selectedNodes[0].id) : undefined
          history.pushSnapshot(store.nodes, store.edges)
          selectedNodes.forEach((n) => store.deleteNode(n.id))
          selectedEdges.forEach((edge) => store.deleteEdge(edge.id))
          if (parent) selectOnly(parent)
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
