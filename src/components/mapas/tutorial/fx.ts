import { create } from 'zustand'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { getFlow } from '@/components/mapas/proto/utils/keyboard'

// Efectos de las demostraciones del tutorial: un cursor fantasma y unas teclas que se ven
// pulsar. Las demostraciones (demos.ts) los manejan con await, paso a paso, mientras ejecutan
// las acciones de verdad con el motor del editor.

export type FxCursor = { x: number; y: number; ms: number; pressed: boolean }

type FxState = {
  cursor: FxCursor | null
  /** Teclas que se ven pulsadas ahora mismo (en orden: "Ctrl", "Z"). */
  keys: string[]
}

export const useTutorialFx = create<FxState>(() => ({ cursor: null, keys: [] }))

/** Una demostración cortada a medias (el usuario ha saltado o ha cambiado de lección). */
export class DemoCancelled extends Error {}

let runId = 0

/** Empieza una demostración nueva; cualquier otra en curso se corta en su siguiente espera. */
export function newRun(): number {
  runId += 1
  return runId
}

export function cancelRuns() {
  runId += 1
  useTutorialFx.setState({ cursor: null, keys: [] })
}

/** Espera `ms`, y lanza DemoCancelled si mientras tanto la demostración se ha cortado. */
export async function wait(run: number, ms: number) {
  await new Promise((r) => setTimeout(r, ms))
  if (run !== runId) throw new DemoCancelled()
}

// ─── Cursor ──────────────────────────────────────────────────────────────────

export async function cursorTo(run: number, x: number, y: number, ms = 650) {
  const prev = useTutorialFx.getState().cursor
  // La primera vez aparece cerca del destino, sin cruzar media pantalla.
  if (!prev) {
    useTutorialFx.setState({ cursor: { x: x + 60, y: y + 70, ms: 0, pressed: false } })
    await wait(run, 30)
  }
  useTutorialFx.setState((s) => ({ cursor: { x, y, ms, pressed: s.cursor?.pressed ?? false } }))
  await wait(run, ms + 40)
}

/** Centro de un nodo en coordenadas de pantalla (o null si no está). */
export function nodeScreenCenter(id: string): { x: number; y: number } | null {
  const flow = getFlow()
  const n = useMindMapStore.getState().nodes.find((x) => x.id === id)
  if (!flow || !n) return null
  return flow.flowToScreenPosition({
    x: n.position.x + (n.measured?.width ?? 160) / 2,
    y: n.position.y + (n.measured?.height ?? 50) / 2,
  })
}

export async function cursorToNode(run: number, id: string, ms = 650) {
  const p = nodeScreenCenter(id)
  if (p) await cursorTo(run, p.x, p.y, ms)
}

export async function cursorToElement(run: number, selector: string, ms = 650) {
  const r = document.querySelector(selector)?.getBoundingClientRect()
  if (r) await cursorTo(run, r.left + r.width / 2, r.top + r.height / 2, ms)
}

export function setPressed(pressed: boolean) {
  useTutorialFx.setState((s) => (s.cursor ? { cursor: { ...s.cursor, pressed } } : s))
}

export async function click(run: number) {
  setPressed(true)
  await wait(run, 140)
  setPressed(false)
  await wait(run, 120)
}

export function hideCursor() {
  useTutorialFx.setState({ cursor: null })
}

// ─── Teclas ──────────────────────────────────────────────────────────────────

/** Enseña las teclas pulsadas un momento (un atajo: "Ctrl" + "Z"). */
export async function press(run: number, keys: string[], holdMs = 650) {
  useTutorialFx.setState({ keys })
  await wait(run, holdMs)
  useTutorialFx.setState({ keys: [] })
  await wait(run, 180)
}

/** Deja teclas pulsadas hasta nuevo aviso (Ctrl mientras se arrastra). */
export function hold(keys: string[]) {
  useTutorialFx.setState({ keys })
}

export function release() {
  useTutorialFx.setState({ keys: [] })
}

// ─── Animación fotograma a fotograma ─────────────────────────────────────────

/** Espera al siguiente fotograma (y lanza DemoCancelled si la demostración se ha cortado). */
export async function frame(run: number) {
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  if (run !== runId) throw new DemoCancelled()
}

/** Pone el cursor en un punto YA, sin transición (para seguir algo que se mueve cada fotograma). */
export function cursorAt(x: number, y: number) {
  useTutorialFx.setState((s) => ({ cursor: { x, y, ms: 0, pressed: s.cursor?.pressed ?? false } }))
}
