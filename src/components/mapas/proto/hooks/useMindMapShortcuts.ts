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
import { mirrorBranches, showUpToLevel, toggleBranch, toggleBranches } from '@/components/mapas/proto/utils/branches'
import { addTableAndEdit } from '@/components/mapas/proto/utils/tables'
import {
  addChildAndEdit,
  addSiblingAndEdit,
  navigate,
  selectOnly,
  getFlow,
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

      // ── Ctrl+P: exportar / imprimir (el diálogo, no el de la página) ────────
      if (isMod && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        ui.setExportOpen(true)
        return
      }

      // ── Ctrl+E: panel de estilo del nodo seleccionado (o de la selección) ───
      if (isMod && !e.altKey && e.key.toLowerCase() === 'e') {
        const first = getNodes().find((n) => n.selected && !n.hidden)
        if (first) {
          e.preventDefault()
          ui.setSelectedNodeId(first.id)
          ui.setStylePanelOpen(true)
        }
        return
      }

      // ── N: nodo nuevo sin relaciones ──────────────────────────────────────────
      // Con un nodo seleccionado, escribir lo edita (la N incluida), así que N a secas solo crea con
      // la selección vacía; Alt+N crea siempre.
      const wantsNew = !isMod && !e.shiftKey && (e.altKey ? e.code === 'KeyN' : e.key.toLowerCase() === 'n')
      if (wantsNew && !store.editingNodeId && (e.altKey || !getNodes().some((n) => n.selected))) {
        if (e.altKey || target === document.body || !!target.closest?.('.react-flow')) {
          e.preventDefault()
          history.pushSnapshot(store.nodes, store.edges)
          const newId = store.addNode()
          setTimeout(() => {
            const node = useMindMapStore.getState().nodes.find((n) => n.id === newId)
            if (node) void getFlow()?.setCenter(node.position.x, node.position.y, { duration: 600, zoom: 1 })
          }, 150)
          return
        }
      }

      // ── Alt+1…9: ver hasta ese nivel · Alt+0: desplegarlo todo ───────────
      if (e.altKey && !isMod && /^Digit[0-9]$/.test(e.code)) {
        e.preventDefault()
        const level = Number(e.code.slice(5))
        showUpToLevel(level === 0 ? null : level)
        return
      }

      // ── Alt+M: pasar las ramas seleccionadas al otro lado, en espejo ──────
      if (e.altKey && !isMod && e.code === 'KeyM' && !store.editingNodeId) {
        const sel = getNodes().filter((n) => n.selected).map((n) => n.id)
        if (sel.length) {
          e.preventDefault()
          mirrorBranches(sel)
          return
        }
      }

      // ── Alt+T: tabla hija del nodo seleccionado (o suelta) ────────────────────
      if (e.altKey && !isMod && e.code === 'KeyT' && !store.editingNodeId) {
        e.preventDefault()
        const sel = getNodes().filter((n) => n.selected && !n.hidden)
        addTableAndEdit(sel.length === 1 ? sel[0].id : undefined)
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
        if (sel.length > 1 && e.key === ' ') {
          // Espacio con varios seleccionados: pliega (o despliega) todas sus ramas a la vez.
          e.preventDefault()
          toggleBranches(sel.map((n) => n.id))
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
        // Escribir con un nodo seleccionado lo edita (como en una hoja de cálculo): la letra
        // sustituye al texto. Los números 1-7 con el ratón encima de un nodo siguen siendo categorías.
        if (one && e.key.length === 1 && e.key !== ' ' && !(categoryForKey(e.key) && store.hoveredNodeId)) {
          e.preventDefault()
          store.setEditing(one, e.key)
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
        const selected = category
          ? getNodes()
              .filter((n) => n.selected && !n.hidden)
              .map((n) => n.id)
          : []
        // Con varios nodos seleccionados el número se aplica a TODOS (con el ratón sobre uno de
        // ellos o sobre ningún nodo); con el ratón sobre un nodo ajeno a la selección, solo a ese.
        const target = hovered ? (selected.includes(hovered) ? selected : [hovered]) : selected.length > 1 ? selected : []
        if (category && target.length) {
          e.preventDefault()
          applyCategoryToNodes(target, category)
        }
      }

      // ── Escape ──────────────────────────────────────────────────────────────
      if (e.key === 'Escape') {
        store.setEditing(null)
        ui.setSelectedNodeId(null)
        ui.setStylePanelOpen(false)
      }

    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [getNodes, getEdges])
}
