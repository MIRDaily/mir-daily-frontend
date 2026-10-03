import { useEffect, type RefObject } from 'react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'

/** Pausa antes de "soltar" el foco al salir de un nodo: evita el parpadeo al cruzar los huecos entre nodos. */
const RELEASE_MS = 140
/** Lo que tarda en terminar la transición de CSS (750 ms) antes de retirar el aviso de "hay foco". */
const SETTLE_MS = 800

/**
 * Modo foco: al pasar el ratón por un nodo, los que no están conectados con él se
 * difuminan y sus líneas se atenúan.
 *
 * Antes cada nodo y cada línea se suscribía al hover y se re-renderizaba entero en cada
 * cambio (~80 nodos + ~80 líneas con animaciones de JS). Ahora un solo controlador
 * calcula quién es vecino de quién y escribe `data-focus-state` en los elementos de React
 * Flow; el difuminado y la opacidad los pinta CSS (ver mapas.css). React no se entera.
 *
 * Estados de un nodo: focused | adjacent | background. De una línea: relevant | dim.
 */
export function useFocusController(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let frame = 0
    let release: ReturnType<typeof setTimeout> | null = null
    let settle: ReturnType<typeof setTimeout> | null = null
    let shown: string | null = null // nodo enfocado que ya está pintado

    const paint = (id: string | null) => {
      shown = id
      const nodeEls = root.querySelectorAll<HTMLElement>('.react-flow__node')
      const edgeEls = root.querySelectorAll<SVGElement>('.react-flow__edge')

      if (id === null) {
        nodeEls.forEach((el) => el.removeAttribute('data-focus-state'))
        edgeEls.forEach((el) => el.removeAttribute('data-focus-state'))
        // Las capas de composición (will-change) se conservan hasta que acaba la transición.
        if (settle) clearTimeout(settle)
        settle = setTimeout(() => root.removeAttribute('data-focusing'), SETTLE_MS)
        return
      }

      if (settle) clearTimeout(settle)
      root.setAttribute('data-focusing', 'on')

      const neighbours = new Set<string>()
      const relevantEdges = new Set<string>()
      for (const e of useMindMapStore.getState().edges) {
        if (e.source === id) {
          neighbours.add(e.target)
          relevantEdges.add(e.id)
        } else if (e.target === id) {
          neighbours.add(e.source)
          relevantEdges.add(e.id)
        }
      }
      nodeEls.forEach((el) => {
        const nid = el.dataset.id ?? ''
        const state = nid === id ? 'focused' : neighbours.has(nid) ? 'adjacent' : 'background'
        if (el.dataset.focusState !== state) el.dataset.focusState = state
      })
      edgeEls.forEach((el) => {
        const state = relevantEdges.has(el.dataset.id ?? '') ? 'relevant' : 'dim'
        if (el.dataset.focusState !== state) el.dataset.focusState = state
      })
    }

    const sync = () => {
      frame = 0
      const ui = useUIStore.getState()
      // Arrastrando, o con el desenfoque desactivado en la barra, no hay foco.
      const dragging = ui.isDragging || !ui.focusBlur
      const target = dragging ? null : useMindMapStore.getState().hoveredNodeId

      if (target !== null) {
        if (release) {
          clearTimeout(release)
          release = null
        }
        if (target !== shown) paint(target)
        return
      }
      if (shown === null) return
      // Arrastrar suelta el foco al instante; salir del nodo espera un momento por si el
      // ratón entra enseguida en otro.
      if (dragging) {
        if (release) clearTimeout(release)
        release = null
        paint(null)
      } else if (!release) {
        release = setTimeout(() => {
          release = null
          if (useMindMapStore.getState().hoveredNodeId === null) paint(null)
        }, RELEASE_MS)
      }
    }

    // Varios eventos en el mismo fotograma (salir de un nodo + entrar en otro) valen uno.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync)
    }

    const unsubMap = useMindMapStore.subscribe((s, p) => {
      if (s.hoveredNodeId !== p.hoveredNodeId) schedule()
      // Si cambian las conexiones con el foco puesto (borrar/conectar), se repinta.
      else if (shown !== null && s.edges !== p.edges) {
        const id = shown
        shown = null
        paint(id)
      }
    })
    const unsubUi = useUIStore.subscribe((s, p) => {
      if (s.isDragging !== p.isDragging || s.focusBlur !== p.focusBlur) schedule()
    })

    return () => {
      unsubMap()
      unsubUi()
      if (frame) cancelAnimationFrame(frame)
      if (release) clearTimeout(release)
      if (settle) clearTimeout(settle)
    }
  }, [rootRef])
}
