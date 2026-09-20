'use client'

import { useCallback, useEffect, useRef } from 'react'

/** Un hueco mayor entre dos avisos del temporizador se toma por suspensión. */
export const SLEEP_GAP_MS = 30_000
/** Tope de tiempo contado por pregunta: el MIR da ~77 s; más es abandono. */
export const MAX_SECONDS_PER_QUESTION = 600

/**
 * Cronómetro de UNA pregunta para la analítica de tiempos. Arranca de cero
 * cada vez que cambia `key` (la pregunta en pantalla; null = sin pregunta) y
 * devuelve una función que lee los segundos acumulados.
 *
 * Igual que en el simulacro: cada segundo suma lo transcurrido y un hueco de
 * más de SLEEP_GAP_MS (portátil suspendido, pestaña dormida) se descarta, para
 * que una suspensión no acabe como "13 horas en una pregunta".
 */
export function useQuestionStopwatch(key: string | null): () => number {
  const spentMsRef = useRef(0)
  const lastRef = useRef(0)

  const accrue = useCallback(() => {
    const now = Date.now()
    const delta = now - lastRef.current
    lastRef.current = now
    if (delta <= SLEEP_GAP_MS) spentMsRef.current += delta
  }, [])

  useEffect(() => {
    spentMsRef.current = 0
    lastRef.current = Date.now()
    if (key == null) return
    const id = window.setInterval(accrue, 1000)
    return () => window.clearInterval(id)
  }, [key, accrue])

  return useCallback(() => {
    accrue()
    return Math.min(MAX_SECONDS_PER_QUESTION, Math.round(spentMsRef.current / 1000))
  }, [accrue])
}
