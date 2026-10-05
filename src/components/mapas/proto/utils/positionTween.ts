// Interpolación de posiciones en la store, fotograma a fotograma: las líneas siguen solas a los
// nodos porque se calculan a partir de sus posiciones. Lo usan las animaciones que mueven ramas
// (p. ej. pasar una rama al otro lado en espejo).
//
// Cualquier cambio que restaure el estado (deshacer/rehacer) debe cortar la animación en curso;
// si no, seguiría moviendo los nodos del estado restaurado. Para eso está `cancelTweens`, que
// llama `cancelSettle` (usePhysics) junto con el corte de la física.

import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'

type Punto = { x: number; y: number }

let activa: { frame: number; terminar: () => void } | null = null

export function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Corta la interpolación en curso SIN aplicar su final (deshacer manda). */
export function cancelTweens() {
  if (!activa) return
  cancelAnimationFrame(activa.frame)
  activa = null
}

/** Termina en el acto la interpolación en curso, dejando los nodos en su destino. */
export function finishTweens() {
  if (!activa) return
  const { terminar } = activa
  cancelAnimationFrame(activa.frame)
  activa = null
  terminar()
}

/** Suave al arrancar y al llegar. */
export const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

/**
 * Lleva los nodos de `destinos` desde su posición actual hasta su destino en `ms` milisegundos.
 * `alTerminar` corre una vez, con los nodos ya en su sitio (también si otra animación la termina
 * antes de tiempo). Sin animación si el sistema pide reducir el movimiento.
 */
export function tweenPositions(
  destinos: Map<string, Punto>,
  { ms, ease = easeInOutCubic, alTerminar }: { ms: number; ease?: (k: number) => number; alTerminar?: () => void },
) {
  finishTweens()
  const origen = new Map(
    useMindMapStore.getState().nodes.filter((n) => destinos.has(n.id)).map((n) => [n.id, { ...n.position }]),
  )
  const colocar = (e: number) =>
    useMindMapStore.setState((s) => {
      for (const n of s.nodes) {
        const a = origen.get(n.id)
        const b = destinos.get(n.id)
        if (!a || !b || n.dragging) continue
        n.position = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      }
    })
  const terminar = () => {
    colocar(1)
    alTerminar?.()
  }
  if (reducedMotion() || ms <= 0) {
    terminar()
    return
  }
  const t0 = performance.now()
  const paso = (ahora: number) => {
    const k = Math.min(1, (ahora - t0) / ms)
    if (k >= 1) {
      activa = null
      terminar()
      return
    }
    colocar(ease(k))
    if (activa) activa.frame = requestAnimationFrame(paso)
  }
  activa = { frame: requestAnimationFrame(paso), terminar }
}
