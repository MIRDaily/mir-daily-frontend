import { supabase } from '@/lib/supabaseBrowser'

type TrashQuestion = {
  id: string | number
  statement?: string | null
  subject?: string | null
  subject_id?: string | number | null
  topic_id?: string | number | null
}

export type DeckTrashItem = {
  id: string | number
  question_id?: string | number | null
  deleted_at?: string | null
  purge_at?: string | null
  questions?: TrashQuestion | null
}

export type TrashedDeck = {
  id: string | number
  name?: string | null
  subject?: string | null
  deleted_at?: string | null
  purge_at?: string | null
}

type DeckTrashItemsResponse = {
  trash?: DeckTrashItem[] | null
}

type TrashedDecksResponse = {
  decks?: TrashedDeck[] | null
  trash?: TrashedDeck[] | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

async function readError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = (await res.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null

    if (payload?.message) return payload.message
    if (payload?.error) return payload.error
  }

  const text = await res.text().catch(() => '')
  return text || fallback
}

function sortByDeletedAtDesc<T extends { deleted_at?: string | null }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const aTime = Date.parse(a.deleted_at ?? '')
    const bTime = Date.parse(b.deleted_at ?? '')
    if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0
    if (!Number.isFinite(aTime)) return 1
    if (!Number.isFinite(bTime)) return -1
    return bTime - aTime
  })
}

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')

  const token = await getToken()
  if (!token) throw new Error('No hay sesion activa.')

  const headers = new Headers(init.headers ?? {})
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  })
}

export async function fetchDeckItemsTrash(deckId: string): Promise<DeckTrashItem[]> {
  if (!deckId) throw new Error('deckId no valido.')

  const res = await authedFetch(`/api/studio/decks/${deckId}/items/trash`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cargar la papelera de preguntas (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as DeckTrashItemsResponse | null
  const list = Array.isArray(payload?.trash) ? payload.trash : []
  return sortByDeletedAtDesc(list)
}

export async function softDeleteDeckItem(deckId: string, itemId: number): Promise<void> {
  if (!deckId) throw new Error('deckId no valido.')
  if (!Number.isFinite(itemId) || itemId <= 0) throw new Error('itemId no valido.')

  const res = await authedFetch(`/api/studio/decks/${deckId}/items/${itemId}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo eliminar la pregunta (${res.status})`))
  }
}

export async function restoreDeckItem(deckId: string, itemId: number): Promise<void> {
  if (!deckId) throw new Error('deckId no valido.')
  if (!Number.isFinite(itemId) || itemId <= 0) throw new Error('itemId no valido.')

  const res = await authedFetch(`/api/studio/decks/${deckId}/items/${itemId}/restore`, {
    method: 'POST',
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo restaurar la pregunta (${res.status})`))
  }
}

export async function fetchDeletedDecks(): Promise<TrashedDeck[]> {
  const res = await authedFetch('/api/studio/decks/trash', {
    method: 'GET',
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cargar la papelera de mazos (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as
    | TrashedDecksResponse
    | TrashedDeck[]
    | null

  if (Array.isArray(payload)) return sortByDeletedAtDesc(payload)

  const list = Array.isArray(payload?.decks)
    ? payload.decks
    : Array.isArray(payload?.trash)
      ? payload.trash
      : []
  return sortByDeletedAtDesc(list)
}

export async function softDeleteDeck(deckId: string): Promise<void> {
  if (!deckId) throw new Error('deckId no valido.')

  const res = await authedFetch(`/api/studio/decks/${deckId}/delete`, {
    method: 'POST',
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo enviar el mazo a la papelera (${res.status})`))
  }
}

export async function restoreDeck(deckId: string): Promise<void> {
  if (!deckId) throw new Error('deckId no valido.')

  const res = await authedFetch(`/api/studio/decks/${deckId}/restore`, {
    method: 'POST',
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo restaurar el mazo (${res.status})`))
  }
}

// Compat alias to avoid large refactors in older pages.
export const fetchDeckTrash = fetchDeckItemsTrash
