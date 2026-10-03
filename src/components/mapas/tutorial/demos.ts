import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { navigate, selectOnly, getFlow } from '@/components/mapas/proto/utils/keyboard'
import { reparentNode, showUpToLevel, toggleBranch } from '@/components/mapas/proto/utils/branches'
import { settleNodes } from '@/components/mapas/proto/hooks/usePhysics'
import { applyCategoryToNodes } from '@/components/mapas/proto/utils/categories'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import { PRACTICE_IDS as P } from '@/lib/mapas/tutorial/practiceMap'
import { TUTORIAL_FIT } from './layout'
import {
  click,
  cursorAt,
  frame,
  cursorTo,
  cursorToElement,
  cursorToNode,
  hideCursor,
  hold,
  nodeScreenCenter,
  press,
  release,
  setPressed,
  wait,
} from './fx'

// Las demostraciones del tutorial. Todo lo que se ve pasar en el mapa lo hace el motor de
// verdad (las mismas funciones que los atajos): el cursor y las teclas solo enseñan qué se
// está pulsando. Así la demostración no puede contar algo distinto de lo que hace el editor.

export type DemoId = 'export' | 'edges' | 'panel' | 'mouse' | 'tab' | 'arrows' | 'fold' | 'drag' | 'reparent' | 'search' | 'category' | 'layout'

/** El selector si ese elemento se ve; si no (ventana estrecha: pasa al menú «Vista»), el de reserva. */
function visibleOr(selector: string, fallback: string): string {
  const el = document.querySelector(selector)
  return el && el.getClientRects().length > 0 ? selector : fallback
}

/** El cursor fantasma va hasta un elemento y lo pulsa de verdad (sus cambios se ven en directo). */
async function liveClick(run: number, el: Element | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return
  await cursorTo(run, r.left + r.width / 2, r.top + r.height / 2, 600)
  await click(run)
  ;(el as HTMLElement).click()
}

/** Escribe en un nodo letra a letra (sin abrir el editor de texto). */
async function typeInto(run: number, id: string, text: string) {
  const store = useMindMapStore.getState()
  for (let i = 1; i <= text.length; i++) {
    store.updateNodeData(id, { label: text.slice(0, i) })
    await wait(run, 55)
  }
}

/**
 * Mueve un nodo y toda su rama `dx, dy` (lienzo) con el cursor agarrándolo. Un paso por fotograma
 * (requestAnimationFrame): antes cada paso esperaba ~40 ms y se veía a unos 25 fps.
 */
async function dragBranch(run: number, id: string, dx: number, dy: number, ms = 800) {
  const { nodes, edges } = useMindMapStore.getState()
  const ids = new Set([id, ...descendantsOf([id], childrenMap(parentMap(nodes, edges)))])
  const start = new Map(nodes.filter((n) => ids.has(n.id)).map((n) => [n.id, { ...n.position }]))
  const zoom = getFlow()?.getViewport().zoom ?? 1
  const c0 = nodeScreenCenter(id)
  if (!c0) return
  const t0 = performance.now()
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / ms)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    useMindMapStore.setState((s) => {
      for (const n of s.nodes) {
        const p = start.get(n.id)
        if (p) n.position = { x: p.x + dx * e, y: p.y + dy * e }
      }
    })
    cursorAt(c0.x + dx * zoom * e, c0.y + dy * zoom * e)
    if (k >= 1) break
    await frame(run)
  }
}

/** Mueve varios nodos a la vez a nuevas posiciones, con una transición suave (un paso por fotograma). */
async function animateTo(run: number, targets: Map<string, { x: number; y: number }>, ms = 600) {
  const start = new Map(
    useMindMapStore
      .getState()
      .nodes.filter((n) => targets.has(n.id))
      .map((n) => [n.id, { ...n.position }]),
  )
  const t0 = performance.now()
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / ms)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    useMindMapStore.setState((s) => {
      for (const n of s.nodes) {
        const a = start.get(n.id)
        const b = targets.get(n.id)
        if (a && b) n.position = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      }
    })
    if (k >= 1) break
    await frame(run)
  }
}

/**
 * Descoloca el mapa (cada rama a su aire, con sus hijos) para que «Ordenar» tenga algo que hacer.
 * Se usa al acabar la demostración de ordenar: si no, el usuario pulsaría un botón que no se nota.
 */
async function scrambleMap(run: number) {
  const { nodes, edges } = useMindMapStore.getState()
  const children = childrenMap(parentMap(nodes, edges))
  const shifts: [string, number, number][] = [
    [P.definicion, -90, 170],
    [P.etiologia, 130, -60],
    [P.clinica, -120, 120],
    [P.diagnostico, 150, 40],
    [P.tratamiento, -70, -150],
  ]
  const targets = new Map<string, { x: number; y: number }>()
  for (const [id, dx, dy] of shifts) {
    for (const m of [id, ...descendantsOf([id], children)]) {
      const n = nodes.find((x) => x.id === m)
      if (n) targets.set(m, { x: n.position.x + dx, y: n.position.y + dy })
    }
  }
  await animateTo(run, targets, 700)
}

const DEMOS: Record<DemoId, (run: number) => Promise<void>> = {
  // Ratón: clic selecciona, la rueda mueve, Ctrl+rueda acerca, doble clic edita.
  async mouse(run) {
    const flow = getFlow()
    await cursorToNode(run, P.clinica)
    await click(run)
    selectOnly(P.clinica)
    await wait(run, 700)
    // Mover el mapa con la rueda.
    hold(['Rueda'])
    if (flow) {
      const v = flow.getViewport()
      await flow.setViewport({ x: v.x - 90, y: v.y + 50, zoom: v.zoom }, { duration: 700 })
    }
    await wait(run, 900)
    release()
    // Acercar con Ctrl + rueda y volver.
    hold(['Ctrl', 'Rueda'])
    if (flow) {
      const v = flow.getViewport()
      await flow.zoomTo(v.zoom * 1.25, { duration: 600 })
    }
    await wait(run, 900)
    release()
    if (flow) await flow.fitView({ ...TUTORIAL_FIT, duration: 600 })
    await wait(run, 800)
    // Doble clic: edita el nodo.
    await cursorToNode(run, P.definicion)
    await click(run)
    await click(run)
    selectOnly(P.definicion)
    useMindMapStore.getState().setEditing(P.definicion)
    await wait(run, 1100)
    useMindMapStore.getState().setEditing(null)
    // Sin selección: si no, la tarea "haz clic en un nodo" ya saldría hecha al empezar a practicar.
    selectOnly('')
    hideCursor()
    await wait(run, 300)
  },

  // Tab = hijo, Enter (tras escribir) = guardar, Enter otra vez = hermano.
  async tab(run) {
    await cursorToNode(run, P.clinica)
    await click(run)
    selectOnly(P.clinica)
    await wait(run, 300)
    hideCursor()
    await press(run, ['Tab'])
    const store = useMindMapStore.getState()
    const a = store.addNode(P.clinica)
    selectOnly(a)
    await wait(run, 350)
    await typeInto(run, a, 'Ortopnea')
    await press(run, ['Enter'])
    await press(run, ['Enter'])
    const b = useMindMapStore.getState().addNode(P.clinica)
    selectOnly(b)
    await wait(run, 350)
    await typeInto(run, b, 'Crepitantes')
    await press(run, ['Enter'])
  },

  // Flechas para ir de un nodo a su vecino; F2 para editar.
  async arrows(run) {
    selectOnly(P.root)
    await wait(run, 400)
    let cur: string | null = P.root
    for (const [key, dir] of [
      ['→', 'right'],
      ['↓', 'down'],
      ['↓', 'down'],
      ['→', 'right'],
      ['←', 'left'],
    ] as const) {
      await press(run, [key], 380)
      cur = cur ? navigate(cur, dir) ?? cur : cur
      await wait(run, 250)
    }
    // Escribir con un nodo seleccionado abre de verdad su editor de texto; Esc lo cierra.
    if (cur) {
      const original = useMindMapStore.getState().nodes.find((n) => n.id === cur)?.data.label
      await press(run, ['A – Z'])
      useMindMapStore.getState().setEditing(cur, 'Hola')
      await wait(run, 1100)
      await press(run, ['Esc'], 450)
      useMindMapStore.getState().setEditing(null)
      if (original !== undefined) useMindMapStore.getState().updateNodeData(cur, { label: original })
    }
  },

  // Plegar con Espacio y ver por niveles con Alt+1 / Alt+0.
  async fold(run) {
    await cursorToNode(run, P.diagnostico)
    await click(run)
    selectOnly(P.diagnostico)
    hideCursor()
    await wait(run, 250)
    await press(run, ['Espacio'])
    toggleBranch(P.diagnostico)
    await wait(run, 900)
    await press(run, ['Espacio'])
    toggleBranch(P.diagnostico)
    await wait(run, 800)
    for (const level of [1, 2, 3]) {
      await press(run, ['Alt', String(level)])
      showUpToLevel(level)
      await wait(run, 1100)
    }
    await press(run, ['Alt', '0'])
    showUpToLevel(null)
    await wait(run, 500)
  },

  // Arrastrar un nodo mueve su rama entera; Ctrl+Z lo deshace.
  async drag(run) {
    const { nodes, edges } = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(nodes, edges)
    await cursorToNode(run, P.etiologia)
    setPressed(true)
    await wait(run, 200)
    await dragBranch(run, P.etiologia, -140, -150)
    setPressed(false)
    await wait(run, 700)
    hideCursor()
    await press(run, ['Ctrl', 'Z'])
    useHistoryStore.getState().undo()
    await wait(run, 300)
  },

  // Ctrl mientras se arrastra: soltar encima de otro nodo lo cuelga de él.
  async reparent(run) {
    const from = 'eti-2' // "HTA"
    const target = P.clinica
    const { nodes, edges } = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(nodes, edges)
    await cursorToNode(run, from)
    setPressed(true)
    await wait(run, 150)
    const a = nodeScreenCenter(from)
    const b = nodeScreenCenter(target)
    const zoom = getFlow()?.getViewport().zoom ?? 1
    if (a && b) {
      // Primera mitad del camino sin Ctrl; luego se pulsa y aparece el destino.
      await dragBranch(run, from, ((b.x - a.x) / zoom) * 0.5, ((b.y - a.y) / zoom) * 0.5, 450)
      hold(['Ctrl'])
      await wait(run, 300)
      await dragBranch(run, from, ((b.x - a.x) / zoom) * 0.5 + 14, ((b.y - a.y) / zoom) * 0.5 + 10, 450)
    }
    const fromEl = document.querySelector(`.react-flow__node[data-id="${from}"]`)
    const targetEl = document.querySelector(`.react-flow__node[data-id="${target}"]`)
    targetEl?.classList.add('drop-target')
    fromEl?.classList.add('reparenting')
    await wait(run, 900)
    setPressed(false)
    targetEl?.classList.remove('drop-target')
    fromEl?.classList.remove('reparenting')
    release()
    const moved = reparentNode(from, target)
    if (moved && useUIStore.getState().physicsEnabled) settleNodes({ movers: moved })
    await wait(run, 1300)
    hideCursor()
    // "HTA" no es clínica: se deshace para dejar el mapa bien.
    await press(run, ['Ctrl', 'Z'])
    useHistoryStore.getState().undo()
    await wait(run, 300)
  },

  // Ctrl+F abre el buscador; marca y lleva a lo que coincide.
  async search(run) {
    await press(run, ['Ctrl', 'F'])
    useUIStore.getState().setSearchOpen(true)
    await wait(run, 350)
    const input = document.querySelector<HTMLInputElement>('.mapa-root [role=search] input')
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      for (const t of ['b', 'bn', 'bnp']) {
        setter?.call(input, t)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await wait(run, 260)
      }
    }
    await wait(run, 1600)
    useUIStore.getState().setSearchOpen(false)
    // Sin selección: si no, la tarea "busca BNP" ya saldría hecha al empezar a practicar.
    selectOnly('')
    await wait(run, 200)
  },

  // Exportar: se abre el diálogo y se recorren sus opciones con el cursor, viendo cómo cambia la vista
  // previa; al final se señala «Descargar» (sin descargar nada) y se cierra.
  async export(run) {
    await cursorToElement(run, '[data-tuto="export-open"]')
    await click(run)
    useUIStore.getState().setExportOpen(true)
    await wait(run, 1400)
    const btn = (re: RegExp) =>
      [...document.querySelectorAll<HTMLButtonElement>('[data-tuto="export-dialog"] button')].find((b) => re.test(b.innerText.trim())) ?? null
    // Formatos: PNG y vuelta al PDF.
    await liveClick(run, btn(/Imagen PNG/))
    await wait(run, 1000)
    await liveClick(run, btn(/PDF para imprimir/))
    await wait(run, 800)
    // Qué y cómo se reparte: a tamaño real en varias hojas, entero en una, y una hoja por rama.
    await liveClick(run, btn(/Tamaño real/))
    await wait(run, 1400)
    await liveClick(run, btn(/Entero en una hoja/))
    await wait(run, 900)
    await liveClick(run, btn(/Una hoja por rama/))
    await wait(run, 1600)
    // Papel.
    await liveClick(run, btn(/^A3$/))
    await wait(run, 900)
    await liveClick(run, btn(/^A4$/))
    await wait(run, 700)
    // Tinta: sin rellenos de color, para imprimir sin gastar.
    await liveClick(run, btn(/Ahorro de tinta/))
    await wait(run, 2200)
    await liveClick(run, btn(/Blanco y negro/))
    await wait(run, 1600)
    await liveClick(run, btn(/^Color$/))
    await wait(run, 900)
    // «Descargar» se señala, no se pulsa.
    await cursorToElement(run, '[data-tuto="export-go"]')
    await wait(run, 1100)
    await liveClick(run, btn(/Cancelar|Cerrar/))
    hideCursor()
    await wait(run, 500)
  },

  // Líneas: se elige una línea y se cambia su trazo, color y grosor con el cursor sobre la barra de
  // abajo; después, con un NODO seleccionado, la misma barra cambia todas las líneas que lo unen.
  async edges(run) {
    const { edges } = useMindMapStore.getState()
    const edge = edges.find((e) => e.target === P.clinica)
    if (!edge) return
    const affected = edges.filter((e) => e.source === P.clinica || e.target === P.clinica)
    const original = new Map(affected.map((e) => [e.id, { variant: e.data?.variant, color: e.data?.color, strokeWidth: e.data?.strokeWidth }]))
    const restore = () => {
      const upd = useMindMapStore.getState().updateEdgeData
      for (const [id, d] of original) upd(id, d)
    }
    const path = document.querySelector<SVGPathElement>('.react-flow__edge[data-id="' + edge.id + '"] path')
    const ctm = path?.getScreenCTM()
    if (path && ctm) {
      const p = path.getPointAtLength(path.getTotalLength() / 2)
      const pt = new DOMPoint(p.x, p.y).matrixTransform(ctm)
      await cursorTo(run, pt.x, pt.y)
      await click(run)
    }
    const setSelected = (on: boolean) =>
      useMindMapStore.setState((s) => {
        for (const e of s.edges) e.selected = on && e.id === edge.id
      })
    setSelected(true)
    await wait(run, 1100)
    const panel = (label: string) => document.querySelector<HTMLButtonElement>('[data-tuto="edge-panel"] button[aria-label="' + label + '"]')
    await liveClick(run, panel('Línea guiones'))
    await wait(run, 1000)
    await liveClick(run, panel('Color de línea: Azul'))
    await wait(run, 1000)
    await liveClick(run, panel('Grosor 4 px'))
    await wait(run, 1300)
    restore()
    setSelected(false)
    await wait(run, 600)
    // Con un nodo seleccionado, la misma barra edita todas las líneas que lo unen.
    await cursorToNode(run, P.clinica)
    await click(run)
    selectOnly(P.clinica)
    await wait(run, 1300)
    await liveClick(run, panel('Línea puntos'))
    await wait(run, 1000)
    await liveClick(run, panel('Color de línea: Verde'))
    await wait(run, 1700)
    restore()
    selectOnly('')
    hideCursor()
    await wait(run, 500)
  },

  // Panel de estilo: se abre desde la paleta del nodo y se prueban forma, colores y restablecer, con el
  // cursor pulsando cada opción (los cambios se ven en directo en el nodo).
  async panel(run) {
    const id = 'cli-2' // "Edemas"
    await cursorToNode(run, id)
    await click(run)
    selectOnly(id)
    await wait(run, 600)
    await liveClick(run, document.querySelector<HTMLButtonElement>('button[title="Estilos"]'))
    await wait(run, 1100)
    const opt = (label: string) => document.querySelector<HTMLButtonElement>('[data-tuto="style-panel"] button[aria-label="' + label + '"]')
    await liveClick(run, opt('Rombo'))
    await wait(run, 1200)
    await liveClick(run, opt('Píldora'))
    await wait(run, 900)
    await liveClick(run, opt('Color #B8D4CC (relleno)'))
    await wait(run, 1000)
    await liveClick(run, opt('Color #D4756A (borde)'))
    await wait(run, 1000)
    await liveClick(run, opt('Color #FFFFFF (texto)'))
    await wait(run, 900)
    await liveClick(run, document.querySelector<HTMLButtonElement>('[data-tuto="style-reset"]'))
    await wait(run, 1100)
    await liveClick(run, opt('Cerrar'))
    await wait(run, 500)
    // Sin selección: las tareas del panel no deben salir hechas al empezar a practicar.
    selectOnly('')
    hideCursor()
    await wait(run, 400)
  },

  // Ratón encima de un nodo + número = categoría (y su color).
  async category(run) {
    const id = 'cli-1' // "Disnea"
    await cursorToNode(run, id)
    useMindMapStore.getState().setHovered(id)
    await wait(run, 250)
    await press(run, ['7'])
    applyCategoryToNodes([id], 'perla')
    await wait(run, 900)
    await press(run, ['4'])
    applyCategoryToNodes([id], 'clinica')
    await wait(run, 500)
    useMindMapStore.getState().setHovered(null)
    // Menú «Categorías»: se abre con el botón y se cambia una categoría entera con el cursor.
    const trigger = visibleOr('button[title="Estilos de las categorías"]', '[data-tuto="vista"]')
    await cursorToElement(run, trigger)
    await click(run)
    useUIStore.getState().setCategoriesPanelOpen(true)
    await wait(run, 1100)
    const cp = (sel: string) => document.querySelector<HTMLButtonElement>('[data-tuto="categories-panel"] ' + sel)
    await liveClick(run, cp('[data-cat="clinica"]'))
    await wait(run, 900)
    await liveClick(run, cp('button[aria-label="Color #6E9BC5 (relleno)"]'))
    await wait(run, 1000)
    await liveClick(run, cp('button[aria-label="Color #FFFFFF (texto)"]'))
    await wait(run, 900)
    await liveClick(run, cp('button[aria-label="Rombo"]'))
    await wait(run, 1100)
    await liveClick(run, cp('button[title="Caveat"]'))
    await wait(run, 1300)
    const reset = [...document.querySelectorAll<HTMLButtonElement>('[data-tuto="categories-panel"] button')].find((b) => /Restablecer «/.test(b.innerText))
    await liveClick(run, reset ?? null)
    await wait(run, 1100)
    await liveClick(run, cp('button[aria-label="Cerrar"]'))
    await wait(run, 500)
    hideCursor()
    await wait(run, 300)
  },

  // Ordenar recoloca el mapa entero (o solo lo seleccionado).
  async layout(run) {
    const { nodes, edges } = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(nodes, edges)
    // Se desordena un poco una rama para que ordenar tenga algo que hacer.
    await cursorToNode(run, P.tratamiento)
    setPressed(true)
    await dragBranch(run, P.tratamiento, 220, 60, 600)
    setPressed(false)
    await wait(run, 300)
    const btn = 'button[title="Ordenar el mapa automáticamente"]'
    await cursorToElement(run, btn)
    await click(run)
    document.querySelector<HTMLButtonElement>(btn)?.click()
    await wait(run, 900)
    hideCursor()
    // Y se vuelve a descolocar: así la práctica empieza con un mapa que sí hay que ordenar.
    await wait(run, 500)
    await scrambleMap(run)
    selectOnly('')
    await wait(run, 300)
  },
}

/** Ejecuta una demostración. Termina limpia aunque se corte a medias. */
export async function runDemo(id: DemoId, run: number) {
  try {
    await DEMOS[id](run)
  } finally {
    release()
    setPressed(false)
    document.querySelectorAll('.mapa-root .drop-target, .mapa-root .reparenting').forEach((el) => {
      el.classList.remove('drop-target', 'reparenting')
    })
  }
}
