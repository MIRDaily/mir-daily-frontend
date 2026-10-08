// Ajustes de una sesión de estudio de un grupo de flashcards: lo que el usuario elige al pulsar
// «Estudiar» (cuántas, qué tarjetas, temas, dificultad y escalera). Los aplica el SERVIDOR (la cola,
// con las mismas definiciones que los contadores de la lista); aquí solo se arma la petición, se
// cuenta cuántas coinciden para avisar antes de empezar y se recuerdan los últimos ajustes de cada
// grupo en este navegador. Puro (salvo lo de localStorage, que nunca lanza): se prueba con `npm test`.

import { FLASHCARD_LEVELS, isFlashcardLevel, type Flashcard, type FlashcardLevel } from '@/lib/studioFlashcards'
import type { Escalera } from '@/lib/flashcards/escalera'

export type SoloTarjetas = 'todas' | 'failed' | 'due' | 'new'

export type AjustesSesion = {
  /** Cuántas tarjetas distintas (null = todas las que coincidan). */
  cantidad: number | null
  solo: SoloTarjetas
  /** Temas elegidos (topic tal cual; '' = sin tema). null = todos. */
  temas: string[] | null
  niveles: FlashcardLevel[]
  escalera: boolean
}

export const CANTIDADES = [10, 20, 50] as const

export const OPCIONES_SOLO: { id: SoloTarjetas; titulo: string; descripcion: string }[] = [
  { id: 'todas', titulo: 'Todas', descripcion: 'Primero lo fallado y lo que toca repasar.' },
  { id: 'due', titulo: 'Pendientes', descripcion: 'Las que ya has visto y toca repasar.' },
  { id: 'failed', titulo: 'Solo falladas', descripcion: 'Las que fallaste la última vez.' },
  { id: 'new', titulo: 'Solo nuevas', descripcion: 'Las que aún no has estudiado.' },
]

export const AJUSTES_POR_DEFECTO: AjustesSesion = { cantidad: 20, solo: 'todas', temas: null, niveles: [...FLASHCARD_LEVELS], escalera: true }

/** El tema de una tarjeta como clave ('' = sin tema). */
export const temaDe = (c: Pick<Flashcard, 'topic'>) => (c.topic ?? '').trim()

/** ¿Entra la tarjeta en «qué tarjetas»? Las mismas definiciones que el servidor (flashcardStatus/IsDue). */
export function coincideSolo(c: Pick<Flashcard, 'status' | 'isDue'>, solo: SoloTarjetas): boolean {
  if (solo === 'failed') return c.status === 'failed'
  if (solo === 'new') return c.status === 'new'
  if (solo === 'due') return c.status !== 'new' && c.isDue
  return true
}

/**
 * Las tarjetas que coinciden con los ajustes (sin el tope). Con filtro de niveles, las que no tienen
 * nivel no entran (como en la cola). Con escalera y su foto (`escalera`, la del servidor), las nuevas
 * de un nivel cerrado tampoco: así el número que se avisa es el que va a salir.
 */
export function coinciden(cards: Flashcard[], a: AjustesSesion, escalera?: Escalera | null): Flashcard[] {
  const todosNiveles = a.niveles.length === FLASHCARD_LEVELS.length
  const temas = a.temas ? new Set(a.temas) : null
  const cerrados = new Set<string>()
  if (a.escalera && escalera) {
    for (const t of escalera.topics) for (const l of t.levels) if (!l.unlocked) cerrados.add(`${(t.topic ?? '').trim()}|${l.level}`)
  }
  return cards.filter(
    (c) =>
      coincideSolo(c, a.solo) &&
      (!temas || temas.has(temaDe(c))) &&
      (todosNiveles || (c.level != null && a.niveles.includes(c.level))) &&
      !(c.status === 'new' && c.level != null && cerrados.has(`${temaDe(c)}|${c.level}`)),
  )
}

/** Los temas del grupo con cuántas tarjetas tiene cada uno, por orden alfabético (sin tema, al final). */
export function temasDelGrupo(cards: Flashcard[]): { tema: string; total: number }[] {
  const m = new Map<string, number>()
  for (const c of cards) m.set(temaDe(c), (m.get(temaDe(c)) ?? 0) + 1)
  return [...m.entries()]
    .map(([tema, total]) => ({ tema, total }))
    .sort((x, y) => (x.tema === '' ? 1 : y.tema === '' ? -1 : x.tema.localeCompare(y.tema, 'es')))
}

/**
 * Ajustes → lo que se manda al empezar: los filtros (solo los que filtran algo) y el tope de servidas
 * (con las repeticiones de las falladas: el doble de las tarjetas, entre 20 y 200).
 */
export function paraEmpezar(a: AjustesSesion, cards: Flashcard[], conNivel: boolean, escalera?: Escalera | null) {
  const n = coinciden(cards, { ...a, escalera: conNivel && a.escalera }, escalera).length
  const tarjetas = a.cantidad ? Math.min(a.cantidad, n) : n
  const todosTemas = !a.temas || temasDelGrupo(cards).every((t) => a.temas!.includes(t.tema))
  return {
    limit: Math.min(200, Math.max(20, tarjetas * 2)),
    opciones: {
      ...(conNivel && a.niveles.length < FLASHCARD_LEVELS.length ? { levels: a.niveles } : {}),
      ladder: conNivel && a.escalera,
      ...(!todosTemas && a.temas?.length ? { topics: a.temas } : {}),
      ...(a.solo !== 'todas' ? { onlyStatus: a.solo } : {}),
      ...(a.cantidad ? { cardLimit: a.cantidad } : {}),
    },
  }
}

/** Lo leído (de localStorage o de la dirección) no se da por bueno: se reconstruye con valores válidos. */
export function sanearAjustes(raw: unknown): AjustesSesion {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const cantidad = r.cantidad === null ? null : CANTIDADES.includes(r.cantidad as (typeof CANTIDADES)[number]) ? (r.cantidad as number) : AJUSTES_POR_DEFECTO.cantidad
  const solo = OPCIONES_SOLO.some((o) => o.id === r.solo) ? (r.solo as SoloTarjetas) : 'todas'
  const temas = Array.isArray(r.temas) ? r.temas.filter((t): t is string => typeof t === 'string').slice(0, 200) : null
  const niveles = Array.isArray(r.niveles) ? FLASHCARD_LEVELS.filter((n) => (r.niveles as unknown[]).some((x) => isFlashcardLevel(x) && x === n)) : []
  return {
    cantidad,
    solo,
    temas: temas && temas.length ? temas : null,
    niveles: niveles.length ? niveles : [...FLASHCARD_LEVELS],
    escalera: r.escalera !== false,
  }
}

// ---------------------------------------------------------------------------
// Los últimos ajustes de cada grupo, solo en este navegador (comodidad: si se pierden, por defecto).
// ---------------------------------------------------------------------------

const CLAVE = (deckId: string) => `mirdaily:flashcards:ajustes:${deckId}`

export function leerAjustesGuardados(deckId: string): AjustesSesion | null {
  try {
    const v = localStorage.getItem(CLAVE(deckId))
    return v ? sanearAjustes(JSON.parse(v)) : null
  } catch {
    return null
  }
}

export function guardarAjustes(deckId: string, a: AjustesSesion): void {
  try {
    localStorage.setItem(CLAVE(deckId), JSON.stringify(a))
  } catch {
    /* sin almacenamiento (navegación privada…): la próxima vez, por defecto */
  }
}
