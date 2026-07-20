// Helpers de la API de flashcards personalizadas del usuario.
//
// Los GRUPOS de flashcards son mazos con kind='flashcards' en el backend, pero
// tienen sus propios endpoints (`/api/studio/flashcard-decks`) para no mezclarse
// con la biblioteca de mazos de preguntas. El ESTUDIO reutiliza el motor SRS de
// los mazos (start-session / log / end en `/api/studio/decks/...`) mas una cola
// propia (`/flashcard-decks/:id/next`). Nada de esto cuenta para las
// estadisticas globales del usuario.

export type FlashcardDeck = {
  id: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  created_at?: string | null
  position?: number | null
  totalCards: number
  dueCards: number
}

export type Flashcard = {
  itemId: number
  flashcardId: string
  front: string
  back: string
  topic?: string | null
  subject_id?: number | null
  topic_id?: number | null
  added_at?: string | null
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
  }
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
  input: { front: string; back: string; topic?: string; subjectId?: number | null; topicId?: number | null },
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
  patch: { front?: string; back?: string; topic?: string; subjectId?: number | null; topicId?: number | null },
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/studio/flashcards/${flashcardId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo actualizar la tarjeta'))
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
): Promise<string> {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/start-session`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ limit }),
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

export async function logFlashcard(
  token: string,
  deckId: string,
  input: { deckItemId: number; isCorrect: boolean; sessionId: string },
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/log`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      deckItemId: input.deckItemId,
      isCorrect: input.isCorrect,
      sessionId: input.sessionId,
    }),
  })
  if (!res.ok) throw new Error(await readError(res, 'No se pudo registrar la respuesta'))
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
