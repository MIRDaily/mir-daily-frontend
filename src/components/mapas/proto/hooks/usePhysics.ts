import { useEffect } from 'react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'

// La física del prototipo era d3-force: repulsión entre TODOS los nodos (-180, hasta 350 px) y
// colisión con un círculo fijo de 90 px puesto en la esquina del nodo. Sin nada que los anclara,
// cada nodo nuevo hacía estallar el mapa entero. Ahora solo se deshacen solapes, con el tamaño
// real de cada nodo, y lo que no se pisa no se mueve.

const GAP = 16          // separación mínima entre nodos
const MAX_ITER = 120
const ANIM_MS = 320

type Box = { id: string; x: number; y: number; w: number; h: number; m: number }

/**
 * Separa las cajas que se solapan empujándolas por el eje de menor penetración. `m` es lo que
 * cede cada caja: 0 = fija, 1 = se mueve entera.
 */
export function resolveOverlaps(boxes: Box[]): Map<string, { x: number; y: number }> {
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP
        if (ox <= 0) continue
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP
        if (oy <= 0) continue
        const total = a.m + b.m
        if (total === 0) continue
        const ka = a.m / total, kb = b.m / total
        // Si es casi lo mismo, se prefiere apilar en vertical (como en un mapa en árbol).
        if (ox < oy * 0.7) {
          const dir = a.x + a.w / 2 <= b.x + b.w / 2 ? -1 : 1
          a.x += dir * ox * ka
          b.x -= dir * ox * kb
        } else {
          const dir = a.y + a.h / 2 < b.y + b.h / 2 || (a.y + a.h / 2 === b.y + b.h / 2 && a.m <= b.m) ? -1 : 1
          a.y += dir * oy * ka
          b.y -= dir * oy * kb
        }
        moved = true
      }
    }
    if (!moved) break
  }
  return new Map(boxes.map((b) => [b.id, { x: b.x, y: b.y }]))
}

function sizeOf(n: MindMapNode) {
  return { w: n.measured?.width ?? 160, h: n.measured?.height ?? 44 }
}

let anim: number | null = null

let suppressed = false

/**
 * Aplica un cambio sin que la física reaccione (deshacer/rehacer: los nodos que reaparecen no son
 * nuevos y no hay que apartarlos). Corta además la animación en curso, que si no seguiría moviendo
 * el estado restaurado.
 */
export function withoutPhysics(fn: () => void) {
  cancelSettle()
  suppressed = true
  try {
    fn()
  } finally {
    suppressed = false
  }
}

/** Corta la animación en curso. */
export function cancelSettle() {
  if (anim !== null) cancelAnimationFrame(anim)
  anim = null
}

/**
 * Deshace los solapes alrededor de `movers` y anima el resultado. Los nodos de `movers` (recién
 * creados) ceden casi todo; los de `pinned` (el que se acaba de soltar) no se mueven; el resto
 * cede poco, para que el mapa se aparte sin desordenarse.
 */
export function settleNodes({ movers = [], pinned = [] }: { movers?: string[]; pinned?: string[] }) {
  // Lo oculto en ramas plegadas no ocupa sitio.
  const nodes = useMindMapStore.getState().nodes.filter((n) => !n.hidden)
  if (nodes.length < 2) return
  const moverSet = new Set(movers), pinnedSet = new Set(pinned)
  const boxes: Box[] = nodes.map((n) => {
    const { w, h } = sizeOf(n)
    const m = pinnedSet.has(n.id) || n.dragging ? 0 : moverSet.has(n.id) ? 1 : movers.length ? 0.15 : 1
    return { id: n.id, x: n.position.x, y: n.position.y, w, h, m }
  })
  const target = resolveOverlaps(boxes)

  const from = new Map(nodes.map((n) => [n.id, n.position]))
  const changed = nodes.filter((n) => {
    const t = target.get(n.id)!
    return Math.abs(t.x - n.position.x) > 0.5 || Math.abs(t.y - n.position.y) > 0.5
  }).map((n) => n.id)
  if (changed.length === 0) return

  if (anim !== null) cancelAnimationFrame(anim)
  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ANIM_MS)
    const e = 1 - Math.pow(1 - k, 3)
    useMindMapStore.setState((s) => {
      for (const id of changed) {
        const node = s.nodes.find((n) => n.id === id)
        const a = from.get(id), b = target.get(id)
        if (!node || !a || !b || node.dragging) continue
        node.position = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      }
    })
    anim = k < 1 ? requestAnimationFrame(step) : null
  }
  anim = requestAnimationFrame(step)
}

/** Espera a que React Flow haya medido los nodos indicados (hasta ~10 fotogramas). */
function whenMeasured(ids: string[], fn: () => void, tries = 10) {
  requestAnimationFrame(() => {
    const nodes = useMindMapStore.getState().nodes
    const ready = ids.every((id) => nodes.find((n) => n.id === id)?.measured?.width)
    if (ready || tries <= 0) fn()
    else whenMeasured(ids, fn, tries - 1)
  })
}

export function usePhysics() {
  useEffect(() => {
    const unsub = useMindMapStore.subscribe((state, prev) => {
      // Cargar un mapa cambia el número de nodos pero no debe recolocarlos.
      if (state.loadTick !== prev.loadTick || suppressed) return
      if (!useUIStore.getState().physicsEnabled) return
      if (state.nodes.length <= prev.nodes.length) return
      const before = new Set(prev.nodes.map((n) => n.id))
      const added = state.nodes.filter((n) => !before.has(n.id)).map((n) => n.id)
      if (added.length) whenMeasured(added, () => settleNodes({ movers: added }))
    })
    return () => {
      unsub()
      if (anim !== null) cancelAnimationFrame(anim)
      anim = null
    }
  }, [])
}
