'use client'

import '@xyflow/react/dist/style.css'
import '@/components/mapas/proto/mapas.css'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, useNodesInitialized, useReactFlow, type FitViewOptions } from '@xyflow/react'
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
import { ExportDialog } from '@/components/mapas/proto/components/Toolbar/ExportDialog'
import { TableEditorDialog } from '@/components/mapas/proto/components/TableEditor/TableEditorDialog'
import { BAR_H, EditorTopBar, type SaveState } from '@/components/mapas/proto/components/Toolbar/EditorTopBar'
import { CategoryStylesPanel } from '@/components/mapas/proto/components/Toolbar/CategoryStylesPanel'
import { StylePanel } from '@/components/mapas/proto/components/Toolbar/StylePanel'
import { TextFormatPopup } from '@/components/mapas/proto/components/Toolbar/TextFormatPopup'
import { ShortcutsPanel } from '@/components/mapas/proto/components/Toolbar/ShortcutsPanel'
import { SearchBar } from '@/components/mapas/proto/components/Toolbar/SearchBar'
import ReviewBanner from '@/components/mapas/ia/ReviewBanner'
import { StudyBar } from '@/components/mapas/proto/components/Toolbar/StudyBar'
import { SubgroupConvertPanel } from '@/components/mapas/proto/components/Toolbar/SubgroupConvertPanel'
import { FlashcardsFromBranch } from '@/components/mapas/flashcards/FlashcardsFromBranch'
import { MenuRamaIA } from '@/components/mapas/ia/MenuRamaIA'
import { RamaIADialog } from '@/components/mapas/ia/RamaIADialog'
import { AnadirDocumentoIA } from '@/components/mapas/ia/AnadirDocumentoIA'
import { iaEstado } from '@/lib/mapas/ia/api'
import { animarEntrada } from '@/components/mapas/proto/utils/entryAnimation'
import { reducedMotion } from '@/components/mapas/proto/utils/positionTween'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { MAP_FONT_CLASSES } from '@/components/mapas/proto/fonts'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

const AUTOSAVE_MS = 900

/** Lo que dice el servidor de la IA de mapas, pedido una vez por sesión. */
let estadoIA: ReturnType<typeof iaEstado> | null = null

type Props = {
  mapId: string
  initialTitle: string
  /** Documento guardado tal cual: grafo (v2) o árbol (v1). */
  rawDoc: unknown
  /**
   * Mapa de práctica (tutorial): no se guarda nunca (ni autoguardado, ni al salir, ni aviso de
   * cambios sin guardar). La barra del título lo dice.
   */
  sandbox?: boolean
  /** Capa extra dentro del editor (y del ReactFlowProvider): el entrenador del tutorial. */
  overlay?: React.ReactNode
  /** Márgenes al encuadrar el mapa (el tutorial deja sitio a su panel, a la izquierda). */
  fitOptions?: FitViewOptions
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
      ...(n.data.table ? { table: n.data.table } : {}),
      ...(n.data.ia ? { ia: n.data.ia } : {}),
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
type EditorSettings = Pick<ReturnType<typeof useUIStore.getState>, 'theme' | 'bgStyle' | 'categoryStyles' | 'labelStyle' | 'fuente'>

function fromEngine(nodes: MindMapNode[], edges: MindMapEdge[], settings?: EditorSettings): GraphDoc {
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
      ...(n.data.table ? { table: n.data.table } : {}),
      ...(n.data.ia ? { ia: n.data.ia } : {}),
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
  const { theme, bgStyle, categoryStyles, labelStyle, fuente } = settings ?? useUIStore.getState()
  return {
    version: 2,
    nodes: gNodes,
    edges: gEdges,
    settings: {
      theme,
      bgStyle,
      ...(Object.keys(categoryStyles).length ? { categoryStyles } : {}),
      ...(labelStyle && Object.keys(labelStyle).length ? { labelStyle } : {}),
      // Archivo de origen de un mapa con IA (hash y nombre, nunca el documento).
      ...(fuente ? { fuente } : {}),
    },
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
  // El documento se convierte durante el render (cálculo puro, una vez)…
  const [prepared] = useState(() => {
    const { doc, fromTree } = toGraphDoc(props.rawDoc)
    const engine = toEngine(doc)
    // Lo ya guardado (título + documento): si no cambia nada, no se vuelve a escribir. Un árbol
    // recién convertido cuenta como "sin guardar" para que se grabe ya como grafo.
    const saved = fromTree
      ? ''
      : JSON.stringify({ ...fromEngine(engine.nodes, engine.edges), title: props.initialTitle })
    // Carga de la store antes de la nuestra: el editor está listo cuando el contador la supera.
    return { doc, engine, fromTree, saved, tickBefore: useMindMapStore.getState().loadTick }
  })

  // …pero se mete en las stores en un layout effect, NO en el render. Antes se cargaba dentro del
  // inicializador de useState, y si había algo suscrito a la store (el lienzo de otro editor, o un
  // replay de Suspense del import dinámico) React avisaba "Cannot update MindMapCanvas while
  // rendering MapEditor". El layout effect corre antes de pintar, así que el lienzo se monta en el
  // render siguiente ya con los nodos (su fitView inicial los necesita) y sin parpadeo. El editor
  // es ssr:false: aquí siempre hay navegador. Cargar dos veces (StrictMode) es inocuo.
  const loaded = useMindMapStore((s) => s.loadTick !== prepared.tickBefore)
  // La carga que es de ESTE editor (ver EditorInner: guardar solo lo propio).
  const ownTick = useRef(-1)
  useLayoutEffect(() => {
    const { doc, engine } = prepared
    installMeasurer()
    useMindMapStore.getState().load(engine.nodes, engine.edges)
    useHistoryStore.getState().clear()
    const ui = useUIStore.getState()
    ui.setTheme(doc.settings?.theme ?? 'light')
    ui.setBgStyle(doc.settings?.bgStyle ?? 'dots-light')
    ui.setCategoryStyles(doc.settings?.categoryStyles ?? {})
    ui.setLabelStyle(doc.settings?.labelStyle ?? {})
    ui.setFuente(doc.settings?.fuente ?? null)
    ui.setMapaId(props.sandbox ? null : props.mapId)
    ui.setMenuRama(null)
    ui.setRamaIA(null)
    ui.setAnadirDoc(false)
    ui.setCategoriesPanelOpen(false)
    ui.setSearchOpen(false)
    // La física solo deshace solapes (no recoloca el mapa), así que vale también en mapas grandes.
    ui.setPhysicsEnabled(true)
    ui.setSelectedNodeId(null)
    ui.setStylePanelOpen(false)
    ui.setFocusBlur(true) // el desenfoque al pasar el ratón empieza siempre activado
    ui.setStudyMode(false) // cada mapa se abre para editar, con todo tapado si se entra a estudiar
    ui.setFlashcardsFrom(null)
    ui.setSubgroupConvertOpen(false)
    ownTick.current = useMindMapStore.getState().loadTick
  }, [prepared, props.mapId, props.sandbox])

  if (!loaded) return null

  return (
    <ReactFlowProvider>
      <EditorInner {...props} fromTree={prepared.fromTree} initialSaved={prepared.saved} ownTick={ownTick} />
    </ReactFlowProvider>
  )
}

function EditorInner({
  mapId,
  initialTitle,
  fromTree,
  initialSaved,
  sandbox = false,
  overlay,
  fitOptions,
  ownTick,
}: Props & { fromTree: boolean; initialSaved: string; ownTick: React.RefObject<number> }) {
  const theme = useUIStore((s) => s.theme)
  const bgStyle = useUIStore((s) => s.bgStyle)
  const studyMode = useUIStore((s) => s.studyMode)
  const labelStyle = useUIStore((s) => s.labelStyle)
  const isDark = theme === 'dark'
  const { fitView, getNodes, getViewport, setViewport } = useReactFlow()
  const nodesInitialized = useNodesInitialized()

  const [title, setTitle] = useState(initialTitle)
  const [save, setSave] = useState<SaveState>('saved')
  const [retry, setRetry] = useState(0)
  const titleRef = useRef(initialTitle)
  const lastSaved = useRef(initialSaved)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const needsRelayout = useRef(fromTree)
  // Entrada animada al abrir cualquier mapa: no se enseña nada hasta que los nodos están medidos y
  // en su sitio (en uno recién generado o importado, ya ordenado: antes saltaban de una posición
  // provisional a la buena) y luego el mapa crece desde la raíz. No en el tutorial.
  const [entrada, setEntrada] = useState(!sandbox)
  const entradaPendiente = useRef(!sandbox)

  // ---- guardado -----------------------------------------------------------

  // Las stores son globales: al pasar de un editor a otro sin recargar (p. ej. de un mapa al
  // tutorial), el nuevo carga sus nodos ANTES de que el viejo termine de desmontarse. El viejo,
  // al salir, guardaba "lo pendiente" leyendo la store… que ya era la del otro: así se grabó el
  // mapa de práctica encima de un mapa real. Ahora cada editor solo guarda lo suyo: la store es
  // suya mientras `loadTick` sea el de su carga, y guarda aparte su última copia (nodos, líneas y
  // ajustes) para el guardado al salir.
  const isMine = useCallback(() => useMindMapStore.getState().loadTick === ownTick.current, [ownTick])
  const own = useRef(
    (() => {
      const s = useMindMapStore.getState()
      const u = useUIStore.getState()
      return {
        nodes: s.nodes,
        edges: s.edges,
        settings: { theme: u.theme, bgStyle: u.bgStyle, categoryStyles: u.categoryStyles, labelStyle: u.labelStyle, fuente: u.fuente } as EditorSettings,
      }
    })(),
  )

  const flush = useCallback(async () => {
    if (inFlight.current) return
    if (!isMine()) return // otro editor ha cargado su mapa: esto ya no es nuestro
    const { nodes, edges } = useMindMapStore.getState()
    // Un mapa sin nodos no se guarda nunca: el editor siempre tiene al menos uno, así que una
    // store vacía es un estado roto (p. ej. la recarga en caliente del servidor de desarrollo
    // reinicia la store), y grabarla borraba el mapa.
    if (nodes.length === 0) return
    if (sandbox) return // el mapa de práctica no se guarda
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
  }, [mapId, sandbox, isMine])

  const schedule = useCallback(() => {
    setSave((s) => (s === 'saving' || s === 'error' ? s : 'dirty'))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS)
  }, [flush])

  useEffect(() => {
    const unsubMap = useMindMapStore.subscribe((s, p) => {
      // Cambios de otro editor (que ya ha cargado su mapa) no son nuestros.
      if (s.loadTick !== ownTick.current) return
      if (s.nodes !== p.nodes || s.edges !== p.edges) {
        own.current = { ...own.current, nodes: s.nodes, edges: s.edges }
        schedule()
      }
    })
    const unsubUi = useUIStore.subscribe((s, p) => {
      if (!isMine()) return
      if (s.theme !== p.theme || s.bgStyle !== p.bgStyle || s.categoryStyles !== p.categoryStyles || s.labelStyle !== p.labelStyle || s.fuente !== p.fuente) {
        own.current = {
          ...own.current,
          settings: { theme: s.theme, bgStyle: s.bgStyle, categoryStyles: s.categoryStyles, labelStyle: s.labelStyle, fuente: s.fuente },
        }
        schedule()
      }
    })
    return () => {
      unsubMap()
      unsubUi()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [schedule, isMine, ownTick])

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
      const { nodes, edges, settings } = own.current
      const snap = JSON.stringify({ ...fromEngine(nodes, edges, settings), title: titleRef.current })
      if (!sandbox && snap !== lastSaved.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      // Al salir del editor, lo pendiente se manda sin esperar al debounce. Con NUESTRA última
      // copia, no con la store: puede que otro editor ya haya cargado la suya (ver `own`).
      const { nodes, edges, settings } = own.current
      const doc = fromEngine(nodes, edges, settings)
      if (!sandbox && nodes.length > 0 && JSON.stringify({ ...doc, title: titleRef.current }) !== lastSaved.current) {
        void saveMap(mapId, { title: titleRef.current, doc }).catch(() => {})
      }
    }
  }, [mapId, sandbox])

  // ---- ordenar --------------------------------------------------------------

  /**
   * Ordena el mapa en árbol. Con `only` (ordenar por bloques: lo seleccionado), coloca solo esos
   * nodos, con su esquina superior izquierda donde estaba la del bloque, y no toca nada más ni
   * mueve la cámara.
   */
  const layoutNow = useCallback(
    (animate: boolean, only?: Set<string>) => {
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
      const scope = nodes.filter((n) => !n.hidden && (!only || only.has(n.id)))
      const scopeIds = new Set(scope.map((n) => n.id))
      const pos = autoLayoutGraph(
        scope.map((n) => ({ id: n.id, data: { label: n.data.label, parentId: n.data.parentId, table: n.data.table } })),
        edges
          .filter((e) => scopeIds.has(e.source) && scopeIds.has(e.target))
          .map((e) => ({ source: e.source, target: e.target })),
        (id) => sizes.get(id),
      )
      if (only && scope.length) {
        // El bloque ordenado empieza donde empezaba: misma esquina superior izquierda.
        const minOf = (xs: number[]) => Math.min(...xs)
        const dx = minOf(scope.map((n) => n.position.x)) - minOf([...pos.values()].map((p) => p.x))
        const dy = minOf(scope.map((n) => n.position.y)) - minOf([...pos.values()].map((p) => p.y))
        for (const [id, p] of pos) pos.set(id, { x: p.x + dx, y: p.y + dy })
      }
      if (nodes.some((n) => n.hidden)) {
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
      if (!only) {
        requestAnimationFrame(
          () => void fitView({ padding: 0.25, maxZoom: 1.1, ...fitOptions, duration: animate ? 500 : 0 }),
        )
      }
    },
    [fitView, getNodes, fitOptions],
  )

  // Un mapa que viene de un árbol (importado o generado) se dibuja con el tamaño
  // real de cada nodo en cuanto el navegador lo ha medido. Después (o enseguida, en un mapa ya
  // guardado como grafo), la entrada.
  useEffect(() => {
    if (!nodesInitialized) return
    if (needsRelayout.current) {
      needsRelayout.current = false
      layoutNow(false)
    }
    if (!entradaPendiente.current) return
    entradaPendiente.current = false
    // Dos fotogramas: en el primero se encuadra (layoutNow, o el fitView inicial de React Flow);
    // en el segundo los nodos ya están en su sitio.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!reducedMotion()) {
          // La cámara empieza un poco acercada y se asienta mientras el mapa crece.
          const v = getViewport()
          const caja = document.querySelector('.mapa-root .react-flow')?.getBoundingClientRect()
          if (caja) {
            const k = 1.12
            const cx = caja.width / 2
            const cy = caja.height / 2
            void setViewport({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, zoom: v.zoom * k })
            void setViewport(v, { duration: 1100 })
          }
          animarEntrada()
        }
        setEntrada(false)
      }),
    )
  }, [nodesInitialized, layoutNow, getViewport, setViewport])

  // Red de seguridad: si el editor no llega a medir los nodos (pestaña en segundo plano), el mapa
  // se enseña igual.
  useEffect(() => {
    if (!entrada) return
    const t = setTimeout(() => setEntrada(false), 3000)
    return () => clearTimeout(t)
  }, [entrada])

  const onAutoLayout = useCallback(() => {
    const { nodes, edges } = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(nodes, edges)
    // Con varios nodos seleccionados se ordena solo ese bloque (con todo lo que cuelga de ellos);
    // el resto no se toca.
    const selected = nodes.filter((n) => n.selected && !n.hidden).map((n) => n.id)
    if (selected.length > 1) {
      const block = new Set([...selected, ...descendantsOf(selected, childrenMap(parentMap(nodes, edges)))])
      layoutNow(true, block)
    } else {
      layoutNow(true)
    }
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

  // ¿Está la IA de mapas para este usuario? Si sí, el clic derecho en un nodo abre el menú de
  // rama (rehacer, ampliar, resumir). Se pregunta una vez por sesión.
  useEffect(() => {
    if (sandbox) return
    let vivo = true
    void (estadoIA ??= iaEstado()).then((e) => {
      if (vivo) useUIStore.getState().setIaRamas(!!e?.opciones?.ramas)
    })
    return () => {
      vivo = false
    }
  }, [sandbox])

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
      // El tutorial deja a la izquierda la columna de la mascota: los popups anchos se centran al resto.
      ...(sandbox ? ({ '--mapa-inset-left': '424px' } as React.CSSProperties) : null),
      // Rótulos (forma «label»): los colores que haya elegido el usuario para este mapa (ver mapas.css).
      ...(labelStyle.color ? ({ '--rotulo-color': labelStyle.color } as React.CSSProperties) : null),
      ...(labelStyle.studyColor ? ({ '--rotulo-estudio': labelStyle.studyColor } as React.CSSProperties) : null),
    }),
    [isDark, sandbox, labelStyle.color, labelStyle.studyColor],
  )

  return (
    <div className={`mapa-root ${MAP_FONT_CLASSES}`} data-theme={theme} data-study={studyMode ? '' : undefined} data-entrada={entrada ? '' : undefined} data-rotulo-minusculas={labelStyle.upper === false ? '' : undefined} style={rootStyle}>
      {/* Capa 0: fondo de puntos interactivo. Capa 1+: lienzo y controles (transparentes). */}
      <InteractiveBackground isDark={isDark} bgStyle={bgStyle} />
      {/* Cabecera única: título, acciones y vista en una sola franja (nada flota ni se pisa). */}
      <EditorTopBar
        title={title}
        onTitleChange={onTitleChange}
        save={save}
        onRetry={() => void flush()}
        statusText={sandbox ? 'Práctica · no se guarda' : undefined}
        onAutoLayout={onAutoLayout}
      />
      {/* El lienzo y sus paneles ocupan lo que queda debajo de la cabecera. */}
      <div style={{ position: 'absolute', top: BAR_H, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <MindMapCanvas />
        <CategoryStylesPanel />
        <StylePanel />
        <SearchBar />
        <ReviewBanner />
        <StudyBar />
        <SubgroupConvertPanel />
        <TextFormatPopup />
        <ShortcutsPanel />
        <CustomMiniMap />
        {overlay}
      </div>
      <ExportDialog mapTitle={title} onExportJson={onExportJson} />
      <TableEditorDialog />
      <FlashcardsFromBranch mapTitle={title} />
      <MenuRamaIA />
      <RamaIADialog mapTitle={title} />
      <AnadirDocumentoIA mapTitle={title} />
    </div>
  )
}
