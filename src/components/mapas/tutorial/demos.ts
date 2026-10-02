import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { navigate, selectOnly, getFlow } from '@/components/mapas/proto/utils/keyboard'
import { reparentNode, showUpToLevel, toggleBranch } from '@/components/mapas/proto/utils/branches'
import { settleNodes } from '@/components/mapas/proto/hooks/usePhysics'
import { applyCategoryToNodes } from '@/components/mapas/proto/utils/categories'
import { childrenMap, descendantsOf, parentMap } from '@/components/mapas/proto/utils/tree'
import { PRACTICE_IDS as P } from '@/lib/mapas/tutorial/practiceMap'
import {
  click,
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

export type DemoId = 'tab' | 'arrows' | 'fold' | 'drag' | 'reparent' | 'search' | 'category' | 'layout'

/** Escribe en un nodo letra a letra (sin abrir el editor de texto). */
async function typeInto(run: number, id: string, text: string) {
  const store = useMindMapStore.getState()
  for (let i = 1; i <= text.length; i++) {
    store.updateNodeData(id, { label: text.slice(0, i) })
    await wait(run, 55)
  }
}

/** Mueve un nodo y toda su rama `dx, dy` (lienzo) con el cursor agarrándolo. */
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
    await cursorTo(run, c0.x + dx * zoom * e, c0.y + dy * zoom * e, 0)
    if (k >= 1) break
  }
}

const DEMOS: Record<DemoId, (run: number) => Promise<void>> = {
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
    // F2 abre de verdad el editor de texto del seleccionado; Esc lo cierra.
    await press(run, ['F2'])
    if (cur) useMindMapStore.getState().setEditing(cur)
    await wait(run, 1100)
    await press(run, ['Esc'], 450)
    useMindMapStore.getState().setEditing(null)
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
    await press(run, ['Alt', '1'])
    showUpToLevel(1)
    await wait(run, 1200)
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
    hideCursor()
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
