// Helpers de la API de flashcards personalizadas del usuario.
//
// Los GRUPOS de flashcards son mazos con kind='flashcards' en el backend, pero
// tienen sus propios endpoints (`/api/studio/flashcard-decks`) para no mezclarse
// con la biblioteca de mazos de preguntas. El ESTUDIO reutiliza el motor SRS de
// los mazos (start-session / log / end en `/api/studio/decks/...`) mas una cola
// propia (`/flashcard-decks/:id/next`). Nada de esto cuenta para las
// estadisticas globales del usuario.

// Los cuatro cubos del motor SRS, con los mismos nombres que usan los mazos de
// preguntas (STATUS_TONE en components/studio/deckUi.tsx).
export type FlashcardSummary = {
  new: number
  failed: number
  learning: number
  mastered: number
}

export type FlashcardStatus = keyof FlashcardSummary

/**
 * Dificultad del CONTENIDO de una tarjeta (columna flashcards.level): la ponen las flashcards con
 * IA y se puede cambiar a mano. No es la «difficulty» de FSRS (FlashcardSrs), que la calcula el
 * repaso.
 */
export type FlashcardLevel = 1 | 2 | 3 | 4
export const FLASHCARD_LEVELS: FlashcardLevel[] = [1, 2, 3, 4]
export const LEVEL_INFO: Record<FlashcardLevel, { name: string; color: string; soft: string }> = {
  1: { name: 'Fácil', color: '#5E8C5A', soft: '#E7F0E5' },
  2: { name: 'Media', color: '#3F7EA6', soft: '#E3EEF5' },
  3: { name: 'Difícil', color: '#B07A1E', soft: '#FBF0DA' },
  4: { name: 'Demencial', color: '#B04A5E', soft: '#FAE3E8' },
}
export const isFlashcardLevel = (v: unknown): v is FlashcardLevel => v === 1 || v === 2 || v === 3 || v === 4

export type FlashcardDeck = {
  id: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  created_at?: string | null
  position?: number | null
  totalCards: number
  // Pendientes en total, nuevas incluidas.
  dueCards: number
  // Vencidas que ya se vieron alguna vez: dueCards menos las nuevas.
  dueReviewCards: number
  summary: FlashcardSummary
}

export type Flashcard = {
  itemId: number
  flashcardId: string
  front: string
  back: string
  topic?: string | null
  /** Dificultad del contenido (1 fácil … 4 demencial); null en las tarjetas sin nivel. */
  level?: FlashcardLevel | null
  /** La tarjeta salió de la IA (flashcards con IA). */
  aiGenerated?: boolean
  subject_id?: number | null
  topic_id?: number | null
  added_at?: string | null
  status: FlashcardStatus
  isDue: boolean
  nextDueAt?: string | null
  totalReviews: number
}

/**
 * Grados de FSRS, los mismos que usa Anki.
 *
 * No se calcula nada de esto en el cliente: los cuatro intervalos vienen ya
 * resueltos desde el servidor con cada tarjeta. Duplicar aquí el planificador
 * obligaría a mantener los mismos parámetros en los dos lados, y en cuanto
 * divergieran los botones prometerían fechas que el servidor no cumple.
 */
export const GRADE = { again: 1, hard: 2, good: 3, easy: 4 } as const
export type Grade = (typeof GRADE)[keyof typeof GRADE]

/** Lo que pasaría con la tarjeta si se respondiera con cada grado. */
export type GradePreview = {
  scheduledDays: number
  due: string
}

export type FlashcardSrs = {
  stability: number | null
  difficulty: number | null
  state: number | null
  reps: number | null
  lapses: number | null
  scheduledDays: number | null
  lastReview: string | null
  dueAt: string | null
}

// Item devuelto por la cola de estudio.
export type StudyFlashcard = {
  id: number // deck_item_id
  item_type: 'flashcard'
  flashcard: {
    id: string
    front: string
    back: string
    subject_id?: number | null
    topic_id?: number | null
    topic?: string | null
    level?: FlashcardLevel | null
  }
  srs?: FlashcardSrs | null
  preview?: Record<string, GradePreview>
}

export type NextFlashcardResult =
  | { kind: 'card'; card: StudyFlashcard }
  | { kind: 'done' }
  | { kind: 'expired' }
  | { kind: 'limit' }

function apiBase(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL no definida.')
  }
  return apiUrl
}

async function readError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = (await res.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null
    if (payload?.error) return payload.error
    if (payload?.message) return payload.message
  }
  const text = await res.text().catch(() => '')
  return text || fallback
}

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

export async function fetchFlashcardDecks(token: string): Promise<FlashcardDeck[]> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron cargar los grupos de flashcards'))
  const payload = (await res.json().catch(() => null)) as { decks?: FlashcardDeck[] } | null
  return payload?.decks ?? []
}

export type FlashcardForecast = {
  /** Vencidas de días anteriores. Van aparte para que no escondan el atasco. */
  overdue: number
  days: { date: string; count: number }[]
}

export type FlashcardStats = {
  /** Reparto por intervalo asignado, no por racha. */
  maturity: { new: number; learning: number; young: number; mature: number }
  retention: {
    reviews: number
    passed: number
    /** Null mientras no haya repasos sobre tarjetas ya programadas. */
    rate: number | null
    matureReviews: number
    matureRate: number | null
  }
}

export async function fetchFlashcardForecast(
  token: string,
  days = 30,
): Promise<FlashcardForecast> {
  const res = await fetch(`${apiBase()}/api/studio/flashcards/forecast?days=${days}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar la previsión'))
  const payload = (await res.json().catch(() => null)) as FlashcardForecast | null
  return payload ?? { overdue: 0, days: [] }
}

export async function fetchFlashcardStats(token: string): Promise<FlashcardStats | null> {
  const res = await fetch(`${apiBase()}/api/studio/flashcards/stats`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron cargar las estadísticas'))
  return (await res.json().catch(() => null)) as FlashcardStats | null
}

export async function createFlashcardDeck(
  token: string,
  input: { name: string; color?: string; icon?: string; description?: string },
): Promise<FlashcardDeck> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo crear la asignatura'))
  const payload = (await res.json().catch(() => null)) as { deck?: FlashcardDeck } | null
  if (!payload?.deck) throw new Error('Respuesta invalida al crear la asignatura')
  return payload.deck
}

export async function updateFlashcardDeck(
  token: string,
  deckId: string,
  patch: { name?: string; color?: string; icon?: string; description?: string },
): Promise<FlashcardDeck> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks/${deckId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo actualizar la asignatura'))
  const payload = (await res.json().catch(() => null)) as { deck?: FlashcardDeck } | null
  if (!payload?.deck) throw new Error('Respuesta invalida al actualizar la asignatura')
  return payload.deck
}

// El borrado de un grupo reutiliza el soft-delete generico de mazos.
export async function deleteFlashcardDeck(token: string, deckId: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/delete`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo eliminar el grupo'))
}

export async function restoreFlashcardDeck(token: string, deckId: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/restore`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo restaurar el grupo'))
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------

export type FlashcardDeckMeta = {
  id: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
}

export async function fetchFlashcards(
  token: string,
  deckId: string,
): Promise<{ deck: FlashcardDeckMeta; cards: Flashcard[] }> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks/${deckId}/cards`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron cargar las tarjetas'))
  const payload = (await res.json().catch(() => null)) as {
    deck?: FlashcardDeckMeta
    cards?: Flashcard[]
  } | null
  return {
    deck: payload?.deck ?? { id: deckId, name: '' },
    cards: payload?.cards ?? [],
  }
}

export async function createFlashcard(
  token: string,
  deckId: string,
  input: { front: string; back: string; topic?: string; level?: FlashcardLevel | null; subjectId?: number | null; topicId?: number | null },
): Promise<Flashcard> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks/${deckId}/cards`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo crear la tarjeta'))
  const payload = (await res.json().catch(() => null)) as { card?: Flashcard } | null
  if (!payload?.card) throw new Error('Respuesta invalida al crear la tarjeta')
  return payload.card
}

export async function updateFlashcard(
  token: string,
  flashcardId: string,
  patch: { front?: string; back?: string; topic?: string; level?: FlashcardLevel | null; subjectId?: number | null; topicId?: number | null },
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/studio/flashcards/${flashcardId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo actualizar la tarjeta'))
}

/** Tarjetas por petición en el alta en bloque (el backend admite 250 y el cuerpo, 100 kB). */
const BULK_CHUNK = 150

export type NewFlashcard = { front: string; back: string; topic?: string | null; level?: FlashcardLevel | null }

/**
 * Alta en bloque (flashcards con IA): en tandas, una detrás de otra. El backend omite las que ya
 * estén en el grupo (mismo anverso y reverso) y no crea ninguna de una tanda que no quepa en el
 * tope del grupo. `onProgress` recibe las procesadas hasta ahora.
 */
export async function createFlashcardsBulk(
  token: string,
  deckId: string,
  cards: NewFlashcard[],
  opts: { aiGenerated?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ created: number; duplicates: number }> {
  let created = 0
  let duplicates = 0
  for (let i = 0; i < cards.length; i += BULK_CHUNK) {
    const chunk = cards.slice(i, i + BULK_CHUNK)
    const res = await fetch(`${apiBase()}/api/studio/flashcard-decks/${deckId}/cards/bulk`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ cards: chunk, ...(opts.aiGenerated ? { aiGenerated: true } : {}) }),
    })
    if (!res.ok) {
      const msg = await readError(res, 'No se pudieron guardar las tarjetas')
      throw new Error(created ? `${msg}. Se guardaron ${created} antes del error.` : msg)
    }
    const payload = (await res.json().catch(() => null)) as { created?: number; duplicates?: number } | null
    created += payload?.created ?? 0
    duplicates += payload?.duplicates ?? 0
    opts.onProgress?.(Math.min(cards.length, i + chunk.length), cards.length)
  }
  return { created, duplicates }
}

export type BulkResult = { done: number; alreadyThere: number }

export async function moveFlashcards(
  token: string,
  itemIds: number[],
  targetDeckId: string,
): Promise<BulkResult> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-cards/move`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ itemIds, targetDeckId }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron mover las tarjetas'))
  const payload = (await res.json().catch(() => null)) as { moved?: number; alreadyThere?: number } | null
  return { done: payload?.moved ?? 0, alreadyThere: payload?.alreadyThere ?? 0 }
}

export async function copyFlashcards(
  token: string,
  itemIds: number[],
  targetDeckId: string,
): Promise<BulkResult> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-cards/copy`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ itemIds, targetDeckId }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron copiar las tarjetas'))
  const payload = (await res.json().catch(() => null)) as { copied?: number; alreadyThere?: number } | null
  return { done: payload?.copied ?? 0, alreadyThere: payload?.alreadyThere ?? 0 }
}

export async function bulkDeleteFlashcards(token: string, itemIds: number[]): Promise<number> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-cards/bulk-delete`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ itemIds }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudieron eliminar las tarjetas'))
  const payload = (await res.json().catch(() => null)) as { deleted?: number } | null
  return payload?.deleted ?? 0
}

export async function deleteFlashcard(
  token: string,
  deckId: string,
  itemId: number,
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks/${deckId}/cards/${itemId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo eliminar la tarjeta'))
}

// ---------------------------------------------------------------------------
// Estudio SRS (reutiliza los endpoints de sesion de los mazos)
// ---------------------------------------------------------------------------

export async function startFlashcardSession(
  token: string,
  deckId: string,
  limit: number,
  /** Estudiar solo estos niveles (null o los cuatro = todos). Va en la sesión: lo aplica la cola. */
  levels?: FlashcardLevel[] | null,
): Promise<string> {
  const filtro = levels && levels.length > 0 && levels.length < FLASHCARD_LEVELS.length ? levels : null
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/start-session`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ limit, ...(filtro ? { levels: filtro } : {}) }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo iniciar la sesion'))
  const payload = (await res.json().catch(() => null)) as { sessionId?: string } | null
  if (!payload?.sessionId) throw new Error('Respuesta invalida al iniciar la sesion')
  return payload.sessionId
}

export async function nextFlashcard(
  token: string,
  deckId: string,
  sessionId: string,
): Promise<NextFlashcardResult> {
  const params = new URLSearchParams({ sessionId })
  const res = await fetch(
    `${apiBase()}/api/studio/flashcard-decks/${deckId}/next?${params.toString()}`,
    { headers: authHeaders(token) },
  )
  if (!res.ok) throw new Error(await readError(res, 'No se pudo cargar la siguiente tarjeta'))
  const payload = (await res.json().catch(() => null)) as {
    item?: StudyFlashcard
    done?: boolean
    expired?: boolean
    limitReached?: boolean
  } | null

  if (payload?.item) return { kind: 'card', card: payload.item }
  if (payload?.expired) return { kind: 'expired' }
  if (payload?.limitReached) return { kind: 'limit' }
  return { kind: 'done' }
}

/**
 * Registra un repaso con su grado. Va a la ruta propia de flashcards, no a la
 * generica de mazos: aquella sigue esperando un booleano y planifica con la
 * escalera de tres intervalos fijos de siempre.
 */
export async function logFlashcard(
  token: string,
  deckId: string,
  input: { deckItemId: number; grade: Grade; sessionId: string; timeSpent?: number },
): Promise<{ srs: FlashcardSrs | null }> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks/${deckId}/log`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      deckItemId: input.deckItemId,
      grade: input.grade,
      sessionId: input.sessionId,
      timeSpent: input.timeSpent ?? 0,
    }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo registrar la respuesta'))
  const payload = (await res.json().catch(() => null)) as { srs?: FlashcardSrs } | null
  return { srs: payload?.srs ?? null }
}

/**
 * Deshace el ultimo repaso de la sesion y deja la tarjeta pendiente otra vez.
 * Devuelve `null` si no habia nada que deshacer o si ese repaso es anterior al
 * sistema de deshacer (el servidor contesta 409 y prefiere negarse a inventarse
 * un estado).
 */
export async function undoFlashcardReview(
  token: string,
  deckId: string,
  sessionId: string,
): Promise<{ deckItemId: number; srs: FlashcardSrs | null; preview: Record<string, GradePreview> } | null> {
  const res = await fetch(`${apiBase()}/api/studio/flashcard-decks/${deckId}/undo`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ sessionId }),
  })
  if (res.status === 409) return null
  if (!res.ok) throw new Error(await readError(res, 'No se pudo deshacer el repaso'))
  const payload = (await res.json().catch(() => null)) as {
    deckItemId?: number
    srs?: FlashcardSrs
    preview?: Record<string, GradePreview>
  } | null
  if (!payload?.deckItemId) return null
  return {
    deckItemId: payload.deckItemId,
    srs: payload.srs ?? null,
    preview: payload.preview ?? {},
  }
}

// Best-effort: cerrar la sesion no debe romper el flujo si falla.
export async function endFlashcardSession(token: string, sessionId: string): Promise<void> {
  try {
    await fetch(`${apiBase()}/api/studio/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: authHeaders(token),
    })
  } catch {
    /* no-op */
  }
}
