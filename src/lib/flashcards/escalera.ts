// Escalera de dificultad de un grupo de flashcards: lo que pinta la web. La REGLA (qué nivel está
// abierto, cuántas hacen falta) NO se calcula aquí: la calcula la función SQL get_flashcard_ladder, la
// misma que usa la cola de estudio, y llega por GET /api/studio/flashcard-decks/:id/ladder. Aquí solo
// se sanea lo que llega, se redacta («Difícil: 12 de 20 dominadas de fácil y media») y se compara lo
// de antes y después de una sesión para decir qué se ha desbloqueado. Puro: se prueba con `npm test`.

import { isFlashcardLevel, LEVEL_INFO, type FlashcardLevel } from '@/lib/studioFlashcards'

export type EscalonEscalera = {
  level: FlashcardLevel
  /** Tarjetas de este nivel en el tema. */
  total: number
  mastered: number
  /** Tarjetas (y dominadas) de los niveles inferiores del tema: lo que lo abre. */
  lowerTotal: number
  lowerMastered: number
  /** Dominadas de lo inferior que hacen falta (el 80 %, redondeado hacia arriba). */
  needed: number
  unlocked: boolean
}

export type TemaEscalera = { topic: string | null; levels: EscalonEscalera[] }
export type Escalera = { topics: TemaEscalera[] }

const entero = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0)

/** Lo que manda el servidor → escalera válida (lo demás se ignora). */
export function sanearEscalera(raw: unknown): Escalera {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const topics: TemaEscalera[] = []
  for (const t of Array.isArray(r.topics) ? r.topics.slice(0, 500) : []) {
    if (!t || typeof t !== 'object') continue
    const x = t as Record<string, unknown>
    const levels: EscalonEscalera[] = []
    for (const l of Array.isArray(x.levels) ? x.levels : []) {
      const y = l && typeof l === 'object' ? (l as Record<string, unknown>) : null
      if (!y || !isFlashcardLevel(y.level) || levels.some((e) => e.level === y.level)) continue
      levels.push({
        level: y.level,
        total: entero(y.total),
        mastered: entero(y.mastered),
        lowerTotal: entero(y.lowerTotal),
        lowerMastered: entero(y.lowerMastered),
        needed: entero(y.needed),
        unlocked: y.unlocked === true,
      })
    }
    if (!levels.length) continue
    levels.sort((a, b) => a.level - b.level)
    topics.push({ topic: typeof x.topic === 'string' && x.topic.trim() ? x.topic.slice(0, 120) : null, levels })
  }
  return { topics }
}

/** ¿Hay escalera que enseñar? (algún tema con más de un nivel; con uno solo, todo está abierto). */
export const hayEscalera = (e: Escalera | null | undefined) => !!e && e.topics.some((t) => t.levels.length > 1)

/** «fácil», «fácil y media», «fácil, media y difícil». */
export function nombresNiveles(niveles: FlashcardLevel[]): string {
  const n = niveles.map((k) => LEVEL_INFO[k].name.toLowerCase())
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
}

/** Niveles del tema por debajo de `level`. */
export const nivelesInferiores = (t: TemaEscalera, level: FlashcardLevel) => t.levels.filter((l) => l.level < level).map((l) => l.level)

/**
 * Cuánto falta para abrir un nivel cerrado: «12 de 20 dominadas de fácil y media (hacen falta 16)».
 * Si lo de abajo ya cumple pero un escalón anterior sigue cerrado, se dice cuál.
 */
export function textoFalta(t: TemaEscalera, e: EscalonEscalera): string {
  const de = nombresNiveles(nivelesInferiores(t, e.level))
  const base = `${e.lowerMastered} de ${e.lowerTotal} dominadas de ${de}`
  if (e.lowerMastered >= e.needed) {
    const cerrado = t.levels.find((l) => l.level < e.level && !l.unlocked)
    if (cerrado) return `${base}; antes hay que abrir ${LEVEL_INFO[cerrado.level].name.toLowerCase()}`
  }
  return `${base} (hacen falta ${e.needed})`
}

/** Lo que se ha abierto entre dos fotos de la escalera (antes y después de una sesión). */
export function desbloqueados(antes: Escalera | null, despues: Escalera | null): { topic: string | null; level: FlashcardLevel }[] {
  if (!antes || !despues) return []
  const clave = (topic: string | null, level: number) => `${topic ?? ''}\u0000${level}`
  const abiertos = new Set<string>()
  for (const t of antes.topics) for (const l of t.levels) if (l.unlocked) abiertos.add(clave(t.topic, l.level))
  const out: { topic: string | null; level: FlashcardLevel }[] = []
  for (const t of despues.topics) {
    for (const l of t.levels) {
      // Solo si antes existía y estaba cerrado (un nivel nuevo que aparece abierto no es un logro).
      const existia = antes.topics.some((a) => a.topic === t.topic && a.levels.some((x) => x.level === l.level))
      if (l.unlocked && existia && !abiertos.has(clave(t.topic, l.level))) out.push({ topic: t.topic, level: l.level })
    }
  }
  return out
}

/** «Has desbloqueado Difícil en Arteritis de células gigantes» (uno o varios). */
export function textoDesbloqueo(lista: { topic: string | null; level: FlashcardLevel }[]): string {
  if (!lista.length) return ''
  const uno = (d: { topic: string | null; level: FlashcardLevel }) => `${LEVEL_INFO[d.level].name}${d.topic ? ` en ${d.topic}` : ''}`
  if (lista.length === 1) return `Has desbloqueado ${uno(lista[0])}`
  if (lista.length <= 3) return `Has desbloqueado ${lista.slice(0, -1).map(uno).join(', ')} y ${uno(lista[lista.length - 1])}`
  return `Has desbloqueado ${lista.length} niveles: ${lista.slice(0, 2).map(uno).join(', ')} y ${lista.length - 2} más`
}

/** Cuántas tarjetas abiertas hay (para «X tarjetas abiertas» y para no empezar una sesión vacía). */
export function resumenEscalera(e: Escalera): { abiertas: number; cerradas: number; nivelesCerrados: number } {
  let abiertas = 0
  let cerradas = 0
  let nivelesCerrados = 0
  for (const t of e.topics) {
    for (const l of t.levels) {
      if (l.unlocked) abiertas += l.total
      else {
        cerradas += l.total
        nivelesCerrados += 1
      }
    }
  }
  return { abiertas, cerradas, nivelesCerrados }
}

