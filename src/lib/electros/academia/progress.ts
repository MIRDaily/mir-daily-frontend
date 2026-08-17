/* ════════════════════════════════════════════════════════════════════════
   Progreso de la Academia, guardado en el dispositivo.

   Deliberadamente local: la Academia es entrenamiento visual, no cuenta para
   las estadísticas de rendimiento (igual que la Sala Zen o el modo Versus), así
   que no toca ni el backend ni user_topic_day_stats. Toda la lectura/escritura
   pasa por aquí, de modo que migrar a servidor más adelante no obliga a tocar
   la interfaz.
═══════════════════════════════════════════════════════════════════════════ */
import { MODULES } from './curriculum'

const KEY = 'mirdaily_electros_academia_v1'

export type ModuleState = { done: boolean; step: number }
export type AcademiaProgress = Record<string, ModuleState>

/* ─── Store para useSyncExternalStore ──────────────────────────────────
   El servidor no tiene localStorage, así que renderiza con el progreso vacío
   y React vuelve a pintar con el real tras hidratar. Leerlo en un efecto daría
   el mismo resultado, pero esto evita el parpadeo de un estado intermedio.
*/
const EMPTY: AcademiaProgress = {}
let cache: AcademiaProgress | null = null
const listeners = new Set<() => void>()

export function subscribeToProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Debe devolver la misma referencia mientras nada cambie. */
export function getProgressSnapshot(): AcademiaProgress {
  if (cache === null) cache = loadProgress()
  return cache
}

export function getServerProgressSnapshot(): AcademiaProgress {
  return EMPTY
}

export function commitProgress(next: AcademiaProgress) {
  cache = next
  saveProgress(next)
  for (const listener of listeners) listener()
}

export function loadProgress(): AcademiaProgress {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as AcademiaProgress
  } catch {
    return {}
  }
}

export function saveProgress(progress: AcademiaProgress) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // Modo privado o cuota llena: el progreso se pierde, pero la lección sigue.
  }
}

/** Un módulo está desbloqueado si es el primero o si el anterior está hecho. */
export function isUnlocked(progress: AcademiaProgress, index: number): boolean {
  if (index === 0) return true
  const prev = MODULES[index - 1]
  return Boolean(prev && progress[prev.id]?.done)
}

/** Fracción completada (0–1) para el anillo del mapa. */
export function moduleProgress(progress: AcademiaProgress, index: number): number {
  const m = MODULES[index]
  const st = progress[m.id]
  if (!st) return 0
  if (st.done) return 1
  // Sin terminar nunca se muestra al 100%, aunque haya llegado al último paso.
  return Math.min(0.95, (st.step || 0) / m.steps.length)
}

/** Marca el avance dentro de un módulo sin retroceder nunca el máximo alcanzado. */
export function withStepReached(progress: AcademiaProgress, moduleId: string, step: number): AcademiaProgress {
  const prev = progress[moduleId] ?? { done: false, step: 0 }
  if (prev.step >= step) return progress
  return { ...progress, [moduleId]: { ...prev, step } }
}

export function withModuleDone(progress: AcademiaProgress, moduleId: string, steps: number): AcademiaProgress {
  return { ...progress, [moduleId]: { done: true, step: steps } }
}

export function countDone(progress: AcademiaProgress): number {
  return MODULES.filter((m) => progress[m.id]?.done).length
}
