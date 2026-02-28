import { NextResponse } from 'next/server'

type Deck = {
  id: string | number
  name?: string | null
  title?: string | null
  deleted_at?: string | null
}

type QuestionOption = {
  id?: string | number | null
  option_index?: number | null
  option_text?: string | null
  is_correct?: boolean | null
}

type ItemQuestion = {
  statement?: string | null
  question_options?: QuestionOption[] | null
}

type ItemProgress = {
  total_reviews?: number | null
  correct_reviews?: number | null
  current_streak?: number | null
  last_is_correct?: boolean | null
  last_studied_at?: string | null
  status?: string | null
}

type Item = {
  id: string | number
  deckItemId?: string | number | null
  deck_item_id?: string | number | null
  statement?: string | null
  questions?: ItemQuestion | null
  progress?: ItemProgress | null
}

type DeckSummary = {
  new: number
  failed: number
  learning: number
  mastered: number
}

type DeckSummaryResponse = {
  summary?: Partial<Record<keyof DeckSummary, number | null>> | null
}

type DeckBootstrapResponse = {
  deck: Deck | null
  items: Item[]
  summary: DeckSummary | null
  summaryError?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

function normalizeSummaryCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0
}

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

async function fetchJson<T>(url: string, token: string, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(await readError(res, fallback))
  }

  return (await res.json()) as T
}

export async function GET(
  request: Request,
  context: { params: Promise<{ deckId: string }> },
) {
  try {
    if (!API_URL) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_API_URL no definida.' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No hay sesion activa.' }, { status: 401 })
    }

    const { deckId } = await context.params
    if (!deckId) {
      return NextResponse.json({ error: 'deckId no valido.' }, { status: 400 })
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      return NextResponse.json({ error: 'No hay sesion activa.' }, { status: 401 })
    }

    const summaryPromise: Promise<{ summary: DeckSummary | null; summaryError?: string | null }> =
      fetchJson<DeckSummaryResponse>(
        `${API_URL}/api/studio/decks/${deckId}/summary`,
        token,
        'No se pudo cargar el summary.',
      )
        .then((payload) => {
          const summary = payload?.summary
          return {
            summary: {
              new: normalizeSummaryCount(summary?.new),
              failed: normalizeSummaryCount(summary?.failed),
              learning: normalizeSummaryCount(summary?.learning),
              mastered: normalizeSummaryCount(summary?.mastered),
            },
          }
        })
        .catch((err: unknown) => ({
          summary: null,
          summaryError: err instanceof Error ? err.message : 'No se pudo cargar el summary.',
        }))

    const [decksPayload, itemsPayload, summaryResult] = await Promise.all([
      fetchJson<Deck[] | { decks?: Deck[] }>(
        `${API_URL}/api/studio/decks`,
        token,
        'No se pudieron cargar los mazos.',
      ),
      fetchJson<Item[] | { items?: Item[] }>(
        `${API_URL}/api/studio/decks/${deckId}/items`,
        token,
        'No se pudieron cargar los items.',
      ),
      summaryPromise,
    ])

    const allDecks = Array.isArray(decksPayload)
      ? decksPayload
      : Array.isArray(decksPayload?.decks)
        ? decksPayload.decks
        : []

    const items = Array.isArray(itemsPayload)
      ? itemsPayload
      : Array.isArray(itemsPayload?.items)
        ? itemsPayload.items
        : []

    // Return only the fields needed by the page to reduce payload size.
    const deck = allDecks
      .map((current) => ({
        id: current.id,
        name: current.name ?? null,
        title: current.title ?? null,
        deleted_at: current.deleted_at ?? null,
      }))
      .find((current) => String(current.id) === deckId && current.deleted_at == null) ?? null

    const minimalItems: Item[] = items.map((item) => ({
      id: item.id,
      deckItemId: item.deckItemId ?? null,
      deck_item_id: item.deck_item_id ?? null,
      statement: item.statement ?? null,
      questions: {
        statement: item.questions?.statement ?? null,
        question_options: Array.isArray(item.questions?.question_options)
          ? item.questions?.question_options.map((option) => ({
              id: option.id ?? null,
              option_index: option.option_index ?? null,
              option_text: option.option_text ?? null,
              is_correct: option.is_correct ?? null,
            }))
          : [],
      },
      progress: item.progress
        ? {
            total_reviews: item.progress.total_reviews ?? null,
            correct_reviews: item.progress.correct_reviews ?? null,
            current_streak: item.progress.current_streak ?? null,
            last_is_correct: item.progress.last_is_correct ?? null,
            last_studied_at: item.progress.last_studied_at ?? null,
            status: item.progress.status ?? null,
          }
        : null,
    }))

    const response: DeckBootstrapResponse = {
      deck,
      items: minimalItems,
      summary: summaryResult.summary,
      summaryError: summaryResult.summaryError ?? null,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar el mazo.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
