import { parseApiError } from '@/lib/profile'
import type {
  MedGuessAttemptResponse,
  MedGuessResultResponse,
  MedGuessTerm,
  MedGuessTodayResponse,
} from '../types/medguess'

type AuthenticatedFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function readJsonOrNull<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null
}

function mapAttemptError(errorValue: unknown): string | null {
  if (typeof errorValue !== 'string') return null
  const rawError = errorValue.trim()
  if (!rawError) return null
  if (rawError === 'INVALID_WORD') return 'Palabra no válida'
  if (rawError.toLowerCase().includes('exactly 5 letters')) return 'Debe tener 5 letras'
  return rawError
}

export function extractTargetWord(payload: unknown): string | null {
  const terms = extractTerms(payload)
  if (terms.length > 0) {
    const answer = terms.map((term) => term.display).join(' ').trim()
    if (answer.length > 0) return answer.toUpperCase()
  }

  if (!payload || typeof payload !== 'object') return null
  const source = payload as {
    answer?: unknown
    result?: {
      answer?: unknown
    } | null
  }

  if (typeof source.answer === 'string' && source.answer.trim().length > 0) {
    return source.answer.trim().toUpperCase()
  }
  if (typeof source.result?.answer === 'string' && source.result.answer.trim().length > 0) {
    return source.result.answer.trim().toUpperCase()
  }
  return null
}

function normalizeTerm(entry: unknown): MedGuessTerm | null {
  if (!entry || typeof entry !== 'object') return null
  const source = entry as { display?: unknown; mask?: unknown }
  const display = typeof source.display === 'string' ? source.display.trim() : ''
  const mask = typeof source.mask === 'string' ? source.mask.trim() : ''

  if (!display && !mask) return null
  return {
    display: display.toUpperCase(),
    mask: mask.toUpperCase(),
  }
}

export function extractTerms(payload: unknown): MedGuessTerm[] {
  if (!payload || typeof payload !== 'object') return []
  const source = payload as {
    terms?: unknown
    result?: { terms?: unknown } | null
    finished?: { terms?: unknown } | null
  }

  const candidates = [source.terms, source.result?.terms, source.finished?.terms]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const terms = candidate.map(normalizeTerm).filter((term): term is MedGuessTerm => term !== null)
    if (terms.length > 0) return terms
  }
  return []
}

export function extractDiscoveredLetters(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const source = payload as {
    discoveredLetters?: unknown
    result?: { discoveredLetters?: unknown } | null
    finished?: { discoveredLetters?: unknown } | null
  }

  const candidates = [
    source.discoveredLetters,
    source.result?.discoveredLetters,
    source.finished?.discoveredLetters,
  ]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const letters = candidate
      .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
      .filter((entry) => entry.length > 0)
    if (letters.length > 0) return letters
  }
  return []
}

export function extractCluesUnlocked(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const source = payload as {
    clue?: unknown
    cluesUnlocked?: unknown
    result?: { cluesUnlocked?: unknown } | null
    finished?: { cluesUnlocked?: unknown } | null
  }

  const candidates = [source.cluesUnlocked, source.result?.cluesUnlocked, source.finished?.cluesUnlocked]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const clues = candidate
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0)
    if (clues.length > 0) return clues
  }

  if (typeof source.clue === 'string' && source.clue.trim().length > 0) {
    return [source.clue.trim()]
  }
  return []
}

export function extractExplanation(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as {
    explanation?: unknown
    result?: {
      explanation?: unknown
    } | null
    finished?: {
      explanation?: unknown
    } | null
  }

  if (typeof source.explanation === 'string' && source.explanation.trim().length > 0) {
    return source.explanation.trim()
  }
  if (
    typeof source.result?.explanation === 'string' &&
    source.result.explanation.trim().length > 0
  ) {
    return source.result.explanation.trim()
  }
  if (
    typeof source.finished?.explanation === 'string' &&
    source.finished.explanation.trim().length > 0
  ) {
    return source.finished.explanation.trim()
  }
  return null
}

export async function fetchMedGuessToday(
  authenticatedFetch: AuthenticatedFetcher,
  apiUrl: string,
) {
  const response = await authenticatedFetch(`${apiUrl}/api/medguess/today`)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = await readJsonOrNull<MedGuessTodayResponse>(response)
  if (!payload) {
    throw new Error('No se pudo leer el estado de MedGuess.')
  }
  return payload
}

export async function submitMedGuessAttempt(
  authenticatedFetch: AuthenticatedFetcher,
  apiUrl: string,
  guess: string,
) {
  const response = await authenticatedFetch(`${apiUrl}/api/medguess/attempt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ guess }),
  })

  const payload = await readJsonOrNull<MedGuessAttemptResponse>(response.clone())
  const mappedAttemptError = mapAttemptError(payload?.error)

  if (mappedAttemptError) {
    throw new Error(mappedAttemptError)
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  if (!payload) {
    throw new Error('No se pudo procesar el intento.')
  }
  return payload
}

export async function fetchMedGuessResult(
  authenticatedFetch: AuthenticatedFetcher,
  apiUrl: string,
) {
  const response = await authenticatedFetch(`${apiUrl}/api/medguess/result`)
  const rawPayload = await readJsonOrNull<MedGuessResultResponse>(response)
  const targetWord = extractTargetWord(rawPayload)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  if (!rawPayload) return {}
  return {
    ...rawPayload,
    answer: targetWord ?? rawPayload.answer,
    terms: extractTerms(rawPayload),
    discoveredLetters: extractDiscoveredLetters(rawPayload),
    cluesUnlocked: extractCluesUnlocked(rawPayload),
  }
}
