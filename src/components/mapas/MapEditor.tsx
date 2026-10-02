'use client'

import '@xyflow/react/dist/style.css'
import '@/components/mapas/proto/mapas.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, useNodesInitialized, useReactFlow } from '@xyflow/react'
import { saveMap } from '@/lib/mapas/api'
import {
  autoLayoutGraph,
  toGraphDoc,
  type GraphDoc,
  type GraphEdge,
  type GraphNode,
} from '@/lib/mapas/graph'
import { useCozyCursorOff } from '@/hooks/useCozyCursorOff'
import { fileNameFor, serializeMap } from '@/lib/mapas/json'
import { setTextMeasurer } from '@/lib/mapas/layout'
import { MindMapCanvas } from '@/components/mapas/proto/components/Canvas/MindMapCanvas'
import { InteractiveBackground } from '@/components/mapas/proto/components/Canvas/InteractiveBackground'
import { CustomMiniMap } from '@/components/mapas/proto/components/Canvas/CustomMiniMap'
import { MainToolbar } from '@/components/mapas/proto/components/Toolbar/MainToolbar'
import { BrandCorner } from '@/components/mapas/proto/components/Toolbar/BrandCorner'
import { CategoryStylesPanel } from '@/components/mapas/proto/components/Toolbar/CategoryStylesPanel'
import { MapTitleBar, type SaveState } from '@/components/mapas/proto/components/Toolbar/MapTitleBar'
import { StylePanel } from '@/components/mapas/proto/components/Toolbar/StylePanel'
import { TextFormatPopup } from '@/components/mapas/proto/components/Toolbar/TextFormatPopup'
import { ShortcutsPanel } from '@/components/mapas/proto/components/Toolbar/ShortcutsPanel'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { parentMap } from '@/components/mapas/proto/utils/tree'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

const AUTOSAVE_MS = 900

type Props = {
  mapId: string
  initialTitle: string
  /** Documento guardado tal cual: grafo (v2) o árbol (v1). */
  rawDoc: unknown
}

// ---------------------------------------------------------------------------
// Documento <-> motor del prototipo
// ---------------------------------------------------------------------------

function toEngine(doc: GraphDoc): { nodes: MindMapNode[]; edges: MindMapEdge[] } {
  const nodes: MindMapNode[] = doc.nodes.map((n) => ({
    id: n.id,
    type: 'mindmap',
    position: n.position,
    ...(n.width ? { width: n.width } : {}),
    ...(n.height ? { height: n.height } : {}),
    data: {
      label: n.data.label,
      style: n.data.style,
      ...(n.data.parentId ? { parentId: n.data.parentId } : {}),
      ...(n.data.category ? { category: n.data.category } : {}),
      ...(n.data.collapsed ? { collapsed: true } : {}),
      isEditing: false,
      isFocused: false,
      isNew: false,
      isRemoving: false,
    },
  }))
  const edges: MindMapEdge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: 'animated',
    data: { isAnimating: false, ...e.data },
  }))
  return { nodes, edges }
}

const round = (v: number) => Math.round(v * 10) / 10

/** Lo que se guarda: solo datos del mapa, nada de estado de interfaz (selección, edición, animaciones). */
function fromEngine(nodes: MindMapNode[], edges: MindMapEdge[]): GraphDoc {
  const gNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    type: 'mindmap',
    position: { x: round(n.position.x), y: round(n.position.y) },
    ...(typeof n.width === 'number' ? { width: round(n.width) } : {}),
    ...(typeof n.height === 'number' ? { height: round(n.height) } : {}),
    data: {
      label: n.data.label,
      style: n.data.style,
      ...(n.data.parentId ? { parentId: n.data.parentId } : {}),
      ...(n.data.category ? { category: n.data.category as GraphNode['data']['category'] } : {}),
      ...(n.data.collapsed ? { collapsed: true } : {}),
    },
  }))
  const gEdges: GraphEdge[] = edges.map((e) => {
    const d = e.data
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      type: 'animated',
      data: {
        ...(d?.variant ? { variant: d.variant } : {}),
        ...(d?.color ? { color: d.color } : {}),
        ...(typeof d?.strokeWidth === 'number' ? { strokeWidth: d.strokeWidth } : {}),
        ...(d?.label ? { label: d.label } : {}),
      },
    }
  })
  const { theme, bgStyle, categoryStyles } = useUIStore.getState()
  return {
    version: 2,
    nodes: gNodes,
    edges: gEdges,
    settings: { theme, bgStyle, ...(Object.keys(categoryStyles).length ? { categoryStyles } : {}) },
  }
}

/** Medición real con la tipografía de la web para el primer ordenado. */
function installMeasurer() {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return
  const family = getComputedStyle(document.body).fontFamily
  setTextMeasurer((line, bold) => {
    ctx.font = `${bold ? 700 : 500} 14px ${family}`
    return ctx.measureText(line).width
  })
}

// ---------------------------------------------------------------------------

export default function MapEditor(props: Props) {
  // Carga el mapa en el motor una sola vez, antes del primer pintado: el lienzo
  // hace `fitView` al montarse y necesita ya los nodos. El editor es ssr:false, así
  // que aquí siempre hay navegador. Cargar dos veces (StrictMode) es inocuo.
  const [prepared] = useState(() => {
    installMeasurer()
    const { doc, fromTree } = toGraphDoc(props.rawDoc)
    const engine = toEngine(doc)
    useMindMapStore.getState().load(engine.nodes, engine.edges)
    useHistoryStore.getState().clear()
    const ui = useUIStore.getState()
    ui.setTheme(doc.settings?.theme ?? 'light')
    ui.setBgStyle(doc.settings?.bgStyle ?? 'dots-light')
    ui.setCategoryStyles(doc.settings?.categoryStyles ?? {})
    ui.setCategoriesPanelOpen(false)
    // La física solo deshace solapes (no recoloca el mapa), así que vale también en mapas grandes.
    ui.setPhysicsEnabled(true)
    ui.setSelectedNodeId(null)
    ui.setStylePanelOpen(false)
    // Lo ya guardado (título + documento): si no cambia nada, no se vuelve a escribir. Un árbol
    // recién convertido cuenta como "sin guardar" para que se grabe ya como grafo.
    const saved = fromTree
      ? ''
      : JSON.stringify({ ...fromEngine(engine.nodes, engine.edges), title: props.initialTitle })
    return { fromTree, saved }
  })

  return (
    <ReactFlowProvider>
      <EditorInner {...props} fromTree={prepared.fromTree} initialSaved={prepared.saved} />
    </ReactFlowProvider>
  )
}

function EditorInner({
  mapId,
  initialTitle,
  fromTree,
  initialSaved,
}: Props & { fromTree: boolean; initialSaved: string }) {
  const theme = useUIStore((s) => s.theme)
  const bgStyle = useUIStore((s) => s.bgStyle)
  const isDark = theme === 'dark'
  const { fitView, getNodes } = useReactFlow()
  const nodesInitialized = useNodesInitialized()

  const [title, setTitle] = useState(initialTitle)
  const [save, setSave] = useState<SaveState>('saved')
  const [retry, setRetry] = useState(0)
  const titleRef = useRef(initialTitle)
  const lastSaved = useRef(initialSaved)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const needsRelayout = useRef(fromTree)

  // ---- guardado -----------------------------------------------------------

  const flush = useCallback(async () => {
    if (inFlight.current) return
    const { nodes, edges } = useMindMapStore.getState()
    // Un mapa sin nodos no se guarda nunca: el editor siempre tiene al menos uno, así que una
    // store vacía es un estado roto (p. ej. la recarga en caliente del servidor de desarrollo
    // reinicia la store), y grabarla borraba el mapa.
    if (nodes.length === 0) return
    const doc = fromEngine(nodes, edges)
    const snapshot = JSON.stringify({ ...doc, title: titleRef.current })
    if (snapshot === lastSaved.current) {
      setSave('saved')
      return
    }
    inFlight.current = true
    setSave('saving')
    try {
      await saveMap(mapId, { title: titleRef.current, doc })
      lastSaved.current = snapshot
      setSave('saved')
    } catch {
      setSave('error')
    } finally {
      inFlight.current = false
    }
  }, [mapId])

  const schedule = useCallback(() => {
    setSave((s) => (s === 'saving' || s === 'error' ? s : 'dirty'))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS)
  }, [flush])

  useEffect(() => {
    const unsubMap = useMindMapStore.subscribe((s, p) => {
      if (s.nodes !== p.nodes || s.edges !== p.edges) schedule()
    })
    const unsubUi = useUIStore.subscribe((s, p) => {
      if (s.theme !== p.theme || s.bgStyle !== p.bgStyle || s.categoryStyles !== p.categoryStyles) schedule()
    })
    return () => {
      unsubMap()
      unsubUi()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [schedule])

  // Un reintento tras un fallo de red o de permisos.
  useEffect(() => {
    if (save !== 'error') return
    const t = setTimeout(() => setRetry((n) => n + 1), 4000)
    return () => clearTimeout(t)
  }, [save])
  useEffect(() => {
    if (retry > 0) void flush()
  }, [retry, flush])

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      const { nodes, edges } = useMindMapStore.getState()
      const snap = JSON.stringify({ ...fromEngine(nodes, edges), title: titleRef.current })
      if (snap !== lastSaved.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      // Al salir del editor, lo pendiente se manda sin esperar al debounce.
      const { nodes, edges } = useMindMapStore.getState()
      const doc = fromEngine(nodes, edges)
      if (nodes.length > 0 && JSON.stringify({ ...doc, title: titleRef.current }) !== lastSaved.current) {
        void saveMap(mapId, { title: titleRef.current, doc }).catch(() => {})
      }
    }
  }, [mapId])

  // ---- ordenar --------------------------------------------------------------

  const layoutNow = useCallback(
    (animate: boolean) => {
      const rfNodes = getNodes()
      const sizes = new Map<string, { w: number; h: number }>()
      for (const n of rfNodes) {
        const w = n.measured?.width ?? (typeof n.width === 'number' ? n.width : undefined)
        const h = n.measured?.height ?? (typeof n.height === 'number' ? n.height : undefined)
        if (w && h) sizes.set(n.id, { w, h })
      }
      const { nodes, edges } = useMindMapStore.getState()
      // Las ramas plegadas no ocupan sitio: se ordena lo visible y lo oculto se mueve lo mismo
      // que su antepasado visible más cercano (al desplegar aparece donde estaba respecto a él).
      const visible = nodes.filter((n) => !n.hidden)
      const visibleIds = new Set(visible.map((n) => n.id))
      const pos = autoLayoutGraph(
        visible.map((n) => ({ id: n.id, data: { label: n.data.label, parentId: n.data.parentId } })),
        edges
          .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
          .map((e) => ({ source: e.source, target: e.target })),
        (id) => sizes.get(id),
      )
      if (visible.length < nodes.length) {
        const parents = parentMap(nodes, edges)
        const byId = new Map(nodes.map((n) => [n.id, n]))
        for (const n of nodes) {
          if (!n.hidden) continue
          let a = parents.get(n.id)
          const seen = new Set<string>()
          while (a && byId.get(a)?.hidden && !seen.has(a)) {
            seen.add(a)
            a = parents.get(a)
          }
          const anchor = a ? byId.get(a) : undefined
          const moved = a ? pos.get(a) : undefined
          if (!anchor || !moved) continue
          pos.set(n.id, {
            x: n.position.x + moved.x - anchor.position.x,
            y: n.position.y + moved.y - anchor.position.y,
          })
        }
      }
      useMindMapStore.setState((s) => ({
        nodes: s.nodes.map((n) => {
          const p = pos.get(n.id)
          return p ? { ...n, position: { x: p.x, y: p.y } } : n
        }),
      }))
      useMindMapStore.getState().syncCollapse()
      requestAnimationFrame(() => void fitView({ padding: 0.25, maxZoom: 1.1, duration: animate ? 500 : 0 }))
    },
    [fitView, getNodes],
  )

  // Un mapa que viene de un árbol (importado o generado) se dibuja con el tamaño
  // real de cada nodo en cuanto el navegador lo ha medido.
  useEffect(() => {
    if (!needsRelayout.current || !nodesInitialized) return
    needsRelayout.current = false
    layoutNow(false)
  }, [nodesInitialized, layoutNow])

  const onAutoLayout = useCallback(() => {
    const { nodes, edges } = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(nodes, edges)
    layoutNow(true)
  }, [layoutNow])

  // ---- exportar -------------------------------------------------------------

  const onExportJson = useCallback(() => {
    const { nodes, edges } = useMindMapStore.getState()
    const blob = new Blob([serializeMap(titleRef.current || 'Mapa sin título', fromEngine(nodes, edges))], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileNameFor(titleRef.current, 'json')
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const onTitleChange = useCallback(
    (v: string) => {
      titleRef.current = v
      setTitle(v)
      schedule()
    },
    [schedule],
  )

  // En el editor el cursor nativo es el que sirve (agarrar el lienzo, arrastrar nodos, conectar).
  useCozyCursorOff()

  const rootStyle = useMemo(
    () => ({
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      isolation: 'isolate' as const,
      background: isDark ? '#1C1815' : '#FAF7F4',
      transition: 'background 400ms ease',
    }),
    [isDark],
  )

  return (
    <div className="mapa-root" data-theme={theme} style={rootStyle}>
      {/* Capa 0: fondo de puntos interactivo. Capa 1+: lienzo y controles (transparentes). */}
      <InteractiveBackground isDark={isDark} bgStyle={bgStyle} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <MindMapCanvas />
        <MapTitleBar title={title} onTitleChange={onTitleChange} save={save} onRetry={() => void flush()} />
        <BrandCorner />
        <MainToolbar onExportJson={onExportJson} onAutoLayout={onAutoLayout} />
        <CategoryStylesPanel />
        <StylePanel />
        <TextFormatPopup />
        <ShortcutsPanel />
        <CustomMiniMap />
      </div>
    </div>
  )
}
