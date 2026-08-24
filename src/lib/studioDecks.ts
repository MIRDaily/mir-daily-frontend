// Helpers de la API de Studio (mazos del usuario). Comparten el mismo backend
// que el dashboard: /api/studio/decks y /api/studio/decks/:id/items.
// Pensados para reutilizarse desde cualquier vista (daily, simulacro, etc.).

export type StudioDeck = {
  id: string | number
  name: string
  deleted_at?: string | null
  auto_type?: string | null
  description?: string | null
  banner_gradient?: string | null
}

// Límite de producto para la bio corta del mazo (la columna en BD es texto
// libre): que quepa en dos líneas del banner, no una biografía.
export const DECK_DESCRIPTION_MAX_LENGTH = 120

// auto_type del mazo automático de fallos. Es de solo lectura para el usuario:
// se rellena solo con sus últimos fallos, así que NO debe aceptar inserciones
// manuales (bandera) ni ofrecerse como destino para guardar preguntas.
export const FAILED_GLOBAL_AUTO_TYPE = 'failed_global'

export function isAutoFailedDeck(deck: { auto_type?: string | null }): boolean {
  return deck.auto_type === FAILED_GLOBAL_AUTO_TYPE
}

export type StudioDeckItem = {
  id: string | number
  question_id?: string | number | null
  questionId?: string | number | null
}

type StudioDecksPayload = StudioDeck[] | { decks?: StudioDeck[] } | null
type StudioDeckItemsPayload = StudioDeckItem[] | { items?: StudioDeckItem[] } | null

function apiBase(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL no definida.')
  }
  return apiUrl
}

export async function fetchStudioDecks(token: string): Promise<StudioDeck[]> {
  const res = await fetch(`${apiBase()}/api/studio/decks`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error loading decks')

  const payload = (await res.json().catch(() => null)) as StudioDecksPayload
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.decks)) return payload.decks
  return []
}

export async function fetchStudioDeckItems(
  token: string,
  deckId: string,
): Promise<StudioDeckItem[]> {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/items`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error loading deck items')

  const payload = (await res.json().catch(() => null)) as StudioDeckItemsPayload
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.items)) return payload.items
  return []
}

export async function addQuestionToDeck(token: string, deckId: string, questionId: string) {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ questionIds: [questionId] }),
  })
  if (!res.ok) throw new Error('Error saving question')
  return res.json().catch(() => null)
}

export async function removeQuestionFromDeck(token: string, deckId: string, itemId: string) {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/items/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error removing question')
  return res.json().catch(() => null)
}

export async function updateDeckDescription(
  token: string,
  deckId: string,
  description: string,
): Promise<StudioDeck> {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ description }),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || 'Error al guardar la descripción')
  }
  const payload = (await res.json().catch(() => null)) as { deck?: StudioDeck } | null
  if (!payload?.deck) throw new Error('Respuesta inválida del servidor')
  return payload.deck
}

// Persiste el preset de gradiente de la cabecera del mazo en BD (antes solo
// vivía en localStorage, por navegador, sin viajar entre dispositivos).
export async function updateDeckGradient(
  token: string,
  deckId: string,
  gradient: string,
): Promise<StudioDeck> {
  const res = await fetch(`${apiBase()}/api/studio/decks/${deckId}/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ gradient }),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || 'Error al guardar el fondo del mazo')
  }
  const payload = (await res.json().catch(() => null)) as { deck?: StudioDeck } | null
  if (!payload?.deck) throw new Error('Respuesta inválida del servidor')
  return payload.deck
}

export async function createStudioDeck(token: string, name: string) {
  const res = await fetch(`${apiBase()}/api/studio/decks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Error creating deck')
  return res.json().catch(() => null)
}
