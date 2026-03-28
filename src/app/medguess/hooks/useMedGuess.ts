'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import {
  extractCluesUnlocked,
  extractDiscoveredLetters,
  extractExplanation,
  extractTerms,
  extractTargetWord,
  fetchMedGuessResult,
  fetchMedGuessToday,
  submitMedGuessAttempt,
} from '../services/medguessService'
import type {
  MedGuessAttemptResponse,
  MedGuessAttemptRow,
  MedGuessTerm,
  TileFeedback,
} from '../types/medguess'
import { MEDGUESS_ATTEMPT_LENGTH, MEDGUESS_MAX_ATTEMPTS } from '../types/medguess'

function sanitizeFeedback(value: unknown): TileFeedback {
  if (value === 'correct' || value === 'present' || value === 'absent') {
    return value
  }
  if (value === 'found') return 'correct'
  if (value === 'known') return 'absent'
  return 'absent'
}

function sanitizeGuess(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().slice(0, MEDGUESS_ATTEMPT_LENGTH) : ''
}

function normalizeAttemptEntry(entry: unknown): MedGuessAttemptRow | null {
  if (!entry || typeof entry !== 'object') return null

  const source = entry as Record<string, unknown>
  const guess = sanitizeGuess(source.guess ?? source.word ?? source.attempt)
  const rawResult = Array.isArray(source.result)
    ? source.result
    : Array.isArray(source.feedback)
      ? source.feedback
      : []

  if (!guess || rawResult.length !== MEDGUESS_ATTEMPT_LENGTH) {
    return null
  }

  return {
    guess,
    result: rawResult.map(sanitizeFeedback),
  }
}

function normalizeAttempts(rawAttempts: unknown): MedGuessAttemptRow[] {
  if (!Array.isArray(rawAttempts)) return []
  return rawAttempts
    .map(normalizeAttemptEntry)
    .filter((attempt): attempt is MedGuessAttemptRow => attempt !== null)
    .slice(0, MEDGUESS_MAX_ATTEMPTS)
}

function normalizeAttemptResult(
  payload: MedGuessAttemptResponse,
  guess: string,
  discoveredBefore: Set<string>,
): TileFeedback[] {
  const attemptResult = (payload as { attempt?: { result?: unknown } }).attempt?.result
  const sourceResult = Array.isArray(attemptResult) ? attemptResult : payload.result
  if (!Array.isArray(sourceResult)) return []
  return sourceResult
    .slice(0, MEDGUESS_ATTEMPT_LENGTH)
    .map((entry, index) => {
      const letter = guess[index]?.toLowerCase() ?? ''
      if (entry === 'known') return 'absent'
      if (entry === 'found' && letter && discoveredBefore.has(letter)) {
        return 'absent'
      }
      return sanitizeFeedback(entry)
    })
}

function normalizeTerms(rawTerms: unknown): MedGuessTerm[] {
  if (!Array.isArray(rawTerms)) return []
  return rawTerms
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const source = entry as { display?: unknown; mask?: unknown }
      const display = typeof source.display === 'string' ? source.display.trim().toUpperCase() : ''
      const mask = typeof source.mask === 'string' ? source.mask.trim().toUpperCase() : ''
      if (!display && !mask) return null
      return { display, mask }
    })
    .filter((term): term is MedGuessTerm => term !== null)
}

function normalizeDiscoveredLetters(rawDiscovered: unknown): string[] {
  if (!Array.isArray(rawDiscovered)) return []
  return rawDiscovered
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => entry.length > 0)
}

function normalizeClues(rawClues: unknown): string[] {
  if (!Array.isArray(rawClues)) return []
  return rawClues
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
}

function toAnswerFromTerms(terms: MedGuessTerm[]): string | null {
  if (terms.length === 0) return null
  const answer = terms
    .map((term) => term.display)
    .join(' ')
    .trim()
  return answer.length > 0 ? answer.toUpperCase() : null
}

function toProgressMask(term: MedGuessTerm, discoveredSet: Set<string>): Array<string | null> {
  const fallback = term.display.split('')
  const sourceMask = term.mask.length > 0 ? term.mask.split('') : fallback

  return sourceMask.map((maskChar, index) => {
    const displayChar = fallback[index] ?? maskChar
    const normalizedMaskChar = maskChar.toUpperCase()
    const normalizedDisplayChar = displayChar.toUpperCase()

    const isLetter = /[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1]/.test(normalizedMaskChar)
    if (isLetter) return normalizedMaskChar

    const isDisplayLetter = /[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1]/.test(normalizedDisplayChar)
    if (!isDisplayLetter) {
      return maskChar === ' ' || displayChar === ' ' ? ' ' : null
    }
    if (discoveredSet.has(normalizedDisplayChar.toLowerCase())) return normalizedDisplayChar
    return null
  })
}

function cleanInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1]/g, '').slice(0, MEDGUESS_ATTEMPT_LENGTH)
}

type GameStatus = 'playing' | 'won' | 'lost'

type GameResult = {
  answer: string | null
  explanation: string | null
  success: boolean
}

export function useMedGuess() {
  const authenticatedFetch = useAuthenticatedFetch()
  const [category, setCategory] = useState('')
  const [clue, setClue] = useState('')
  const [cluesUnlocked, setCluesUnlocked] = useState<string[]>([])
  const [wordLength, setWordLength] = useState(0)
  const [terms, setTerms] = useState<MedGuessTerm[]>([])
  const [discoveredLetters, setDiscoveredLetters] = useState<string[]>([])
  const [targetWord, setTargetWord] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<MedGuessAttemptRow[]>([])
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing')
  const [result, setResult] = useState<GameResult | null>(null)
  const [openedCompletedGame, setOpenedCompletedGame] = useState(false)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resultAnimating, setResultAnimating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentGuess, setCurrentGuess] = useState('')
  const [processingGuess, setProcessingGuess] = useState('')
  const [processingRowIndex, setProcessingRowIndex] = useState<number | null>(null)
  const [processingCycle, setProcessingCycle] = useState(0)
  const [processingIncorrectGlow, setProcessingIncorrectGlow] = useState(false)
  const [revealingRowIndex, setRevealingRowIndex] = useState<number | null>(null)
  const [revealCycle, setRevealCycle] = useState(0)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

  const resolveResult = useCallback(async () => {
    if (!apiUrl) return null
    try {
      return await fetchMedGuessResult(authenticatedFetch, apiUrl)
    } catch {
      return null
    }
  }, [apiUrl, authenticatedFetch])

  const load = useCallback(async () => {
    if (!apiUrl) {
      setError('NEXT_PUBLIC_API_URL no definida.')
      setLoading(false)
      return
    }

    try {
      setError(null)
      setLoading(true)

      const today = await fetchMedGuessToday(authenticatedFetch, apiUrl)
      const normalizedAttempts = normalizeAttempts(today.attempts)
      const resultPayload = await resolveResult()
      const todayTerms = normalizeTerms(today.terms)
      const resultTerms = extractTerms(resultPayload)
      const nextTerms = todayTerms.length > 0 ? todayTerms : resultTerms

      const nextTargetWord =
        toAnswerFromTerms(nextTerms) ??
        (typeof today.targetWord === 'string' && today.targetWord.trim().length > 0
          ? today.targetWord.trim().toUpperCase()
          : null)
      const resultTargetWord = extractTargetWord(resultPayload)
      const nextResolvedTargetWord = nextTargetWord ?? resultTargetWord
      const todayDiscovered = normalizeDiscoveredLetters(today.discoveredLetters)
      const resultDiscovered = extractDiscoveredLetters(resultPayload)
      const nextDiscoveredLetters = todayDiscovered.length > 0 ? todayDiscovered : resultDiscovered

      const todayClues = normalizeClues(today.cluesUnlocked)
      const resultClues = extractCluesUnlocked(resultPayload)
      const fallbackClue =
        typeof today.clue === 'string' && today.clue.trim().length > 0 ? today.clue.trim() : ''
      const nextCluesUnlocked =
        (todayClues.length > 0 ? todayClues : resultClues).length > 0
          ? todayClues.length > 0
            ? todayClues
            : resultClues
          : fallbackClue
            ? [fallbackClue]
            : []

      setClue(nextCluesUnlocked[0] ?? fallbackClue)
      setCategory(typeof today.category === 'string' ? today.category.trim() : '')
      setCluesUnlocked(nextCluesUnlocked)
      setWordLength(
        typeof today.length === 'number'
          ? today.length
          : nextTerms[0]?.mask.length ?? nextTerms[0]?.display.length ?? 0,
      )
      setTerms(nextTerms)
      setDiscoveredLetters(nextDiscoveredLetters)
      setTargetWord(nextResolvedTargetWord)
      setAttempts(normalizedAttempts)
      setAttemptsUsed(today.attemptsUsed)

      const explanationFromToday = extractExplanation(today)
      const explanationFromResult = extractExplanation(resultPayload)

      if (today.solved) {
        setGameStatus('won')
        setOpenedCompletedGame(true)
        setResult({
          answer: nextResolvedTargetWord,
          explanation: explanationFromToday ?? explanationFromResult,
          success: true,
        })
        return
      }

      if (today.attemptsUsed >= MEDGUESS_MAX_ATTEMPTS) {
        setGameStatus('lost')
        setOpenedCompletedGame(true)
        setResult({
          answer: nextResolvedTargetWord,
          explanation: explanationFromToday ?? explanationFromResult,
          success: false,
        })
        return
      }

      setGameStatus('playing')
      setOpenedCompletedGame(false)
      setResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar MedGuess.')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authenticatedFetch, resolveResult])

  useEffect(() => {
    void load()
  }, [load])

  const setGuess = useCallback((value: string) => {
    if (gameStatus !== 'playing') return
    setCurrentGuess(cleanInput(value))
  }, [gameStatus])

  const appendGuessCharacter = useCallback((character: string) => {
    if (gameStatus !== 'playing') return
    setCurrentGuess((prev) => cleanInput(`${prev}${character}`))
  }, [gameStatus])

  const removeGuessCharacter = useCallback(() => {
    if (gameStatus !== 'playing') return
    setCurrentGuess((prev) => prev.slice(0, -1))
  }, [gameStatus])

  const submitGuess = useCallback(async () => {
    if (gameStatus !== 'playing' || submitting || loading || resultAnimating) {
      return
    }
    if (!apiUrl) {
      setError('NEXT_PUBLIC_API_URL no definida.')
      return
    }

    const guess = cleanInput(currentGuess)
    if (guess.length !== MEDGUESS_ATTEMPT_LENGTH) {
      setError('Debe tener 5 letras')
      return
    }

    setError(null)
    setProcessingGuess(guess)
    setProcessingRowIndex(attempts.length)
    setProcessingCycle((prev) => prev + 1)
    setProcessingIncorrectGlow(false)
    setSubmitting(true)

    try {
      const submitStartedAt = Date.now()
      const response = await submitMedGuessAttempt(authenticatedFetch, apiUrl, guess)
      const submitElapsedMs = Date.now() - submitStartedAt
      if (submitElapsedMs < 900) {
        await new Promise((resolve) => window.setTimeout(resolve, 900 - submitElapsedMs))
      }
      const discoveredBefore = new Set(discoveredLetters.map((entry) => entry.toLowerCase()))
      const normalizedResult = normalizeAttemptResult(response, guess, discoveredBefore)
      if (normalizedResult.length !== MEDGUESS_ATTEMPT_LENGTH) {
        throw new Error('Respuesta de intento invalida.')
      }

      const nextAttempt: MedGuessAttemptRow = { guess, result: normalizedResult }
      setAttempts((prev) => [...prev, nextAttempt].slice(0, MEDGUESS_MAX_ATTEMPTS))
      setAttemptsUsed((prev) => Math.min(prev + 1, MEDGUESS_MAX_ATTEMPTS))
      const responseTerms = normalizeTerms(response.terms ?? response.finished?.terms)
      if (responseTerms.length > 0) {
        setTerms(responseTerms)
        const answerFromTerms = toAnswerFromTerms(responseTerms)
        if (answerFromTerms) setTargetWord(answerFromTerms)
      }
      const responseDiscovered = normalizeDiscoveredLetters(
        response.discoveredLetters ?? response.finished?.discoveredLetters,
      )
      if (responseDiscovered.length > 0) {
        setDiscoveredLetters(responseDiscovered)
      }
      if (typeof response.category === 'string') {
        setCategory(response.category.trim())
      } else if (typeof response.finished?.category === 'string') {
        setCategory(response.finished.category.trim())
      }
      const rawAttemptClues = response.cluesUnlocked ?? response.finished?.cluesUnlocked
      const hasAttemptClues = Array.isArray(rawAttemptClues)
      const responseClues = normalizeClues(rawAttemptClues)
      if (hasAttemptClues) {
        setCluesUnlocked(responseClues)
        setClue(responseClues[0] ?? '')
      }

      const rowIndex = attempts.length
      setCurrentGuess('')
      setRevealingRowIndex(rowIndex)
      setRevealCycle((prev) => prev + 1)
      setResultAnimating(true)
      window.setTimeout(() => {
        setResultAnimating(false)
        setRevealingRowIndex(null)
        setProcessingGuess('')
        setProcessingRowIndex(null)
        setProcessingIncorrectGlow(false)
      }, 980)

      if (response.finished) {
        const finishedTerms = normalizeTerms(response.finished.terms)
        const answerFromPayload =
          toAnswerFromTerms(finishedTerms) ??
          response.finished.answer?.trim().toUpperCase() ??
          targetWord
        const explanationFromPayload =
          response.finished.explanation?.trim() ?? extractExplanation(response)
        const finishedStatus: GameStatus = response.finished.success ? 'won' : 'lost'
        setGameStatus(finishedStatus)
        setOpenedCompletedGame(true)
        setResult({
          answer: answerFromPayload ?? null,
          explanation: explanationFromPayload ?? null,
          success: finishedStatus === 'won',
        })
        return
      }

      const todayAfterAttempt = await fetchMedGuessToday(authenticatedFetch, apiUrl).catch(
        () => null,
      )

      if (todayAfterAttempt) {
        const latestAttemptsUsed =
          typeof todayAfterAttempt.attemptsUsed === 'number'
            ? todayAfterAttempt.attemptsUsed
            : attempts.length + 1
        setAttemptsUsed(Math.min(latestAttemptsUsed, MEDGUESS_MAX_ATTEMPTS))

        const latestTodayTerms = normalizeTerms(todayAfterAttempt.terms)
        if (latestTodayTerms.length > 0) {
          setTerms(latestTodayTerms)
        }

        const latestTargetWord =
          toAnswerFromTerms(latestTodayTerms) ??
          (typeof todayAfterAttempt.targetWord === 'string' &&
          todayAfterAttempt.targetWord.trim().length > 0
            ? todayAfterAttempt.targetWord.trim().toUpperCase()
            : targetWord)
        if (latestTargetWord) {
          setTargetWord(latestTargetWord)
        }

        const latestDiscoveredLetters = normalizeDiscoveredLetters(todayAfterAttempt.discoveredLetters)
        if (latestDiscoveredLetters.length > 0) {
          setDiscoveredLetters(latestDiscoveredLetters)
        }
        const latestClues = normalizeClues(todayAfterAttempt.cluesUnlocked)
        if (!hasAttemptClues && latestClues.length > 0) {
          setCluesUnlocked(latestClues)
          setClue(latestClues[0])
        }

        if (todayAfterAttempt.solved) {
          const resultPayload = await resolveResult()
          setGameStatus('won')
          setOpenedCompletedGame(true)
          setResult({
            answer: latestTargetWord ?? extractTargetWord(resultPayload),
            explanation: extractExplanation(todayAfterAttempt) ?? extractExplanation(resultPayload),
            success: true,
          })
          return
        }

        if (latestAttemptsUsed >= MEDGUESS_MAX_ATTEMPTS) {
          const resultPayload = await resolveResult()
          setGameStatus('lost')
          setOpenedCompletedGame(true)
          setResult({
            answer: latestTargetWord ?? extractTargetWord(resultPayload),
            explanation: extractExplanation(todayAfterAttempt) ?? extractExplanation(resultPayload),
            success: false,
          })
          return
        }
      }

      if (attempts.length + 1 >= MEDGUESS_MAX_ATTEMPTS) {
        const resultPayload = await resolveResult()
        setGameStatus('lost')
        setOpenedCompletedGame(true)
        setResult({
          answer: targetWord ?? extractTargetWord(resultPayload),
          explanation: extractExplanation(resultPayload),
          success: false,
        })
      }
    } catch (err) {
      const resolvedError = err instanceof Error ? err.message : 'No se pudo enviar el intento.'
      const shouldGlowOnError =
        resolvedError === 'Palabra no válida' || resolvedError === 'Debe tener 5 letras'

      if (shouldGlowOnError && guess.length === MEDGUESS_ATTEMPT_LENGTH) {
        setProcessingIncorrectGlow(true)
        await new Promise((resolve) => window.setTimeout(resolve, 460))
        setProcessingIncorrectGlow(false)
      }

      setProcessingGuess('')
      setProcessingRowIndex(null)
      setError(resolvedError)
    } finally {
      setSubmitting(false)
    }
  }, [
    apiUrl,
    attempts,
    authenticatedFetch,
    currentGuess,
    gameStatus,
    loading,
    resolveResult,
    resultAnimating,
    submitting,
    targetWord,
    discoveredLetters,
  ])

  useEffect(() => {
    const handleKeyboardInput = (event: KeyboardEvent) => {
      if (loading || submitting || resultAnimating || gameStatus !== 'playing') return

      if (event.key === 'Enter') {
        event.preventDefault()
        void submitGuess()
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        removeGuessCharacter()
        return
      }

      if (/^[a-z\u00E1\u00E9\u00ED\u00F3\u00FA\u00FC\u00F1]$/i.test(event.key)) {
        event.preventDefault()
        appendGuessCharacter(event.key)
      }
    }

    window.addEventListener('keydown', handleKeyboardInput)
    return () => {
      window.removeEventListener('keydown', handleKeyboardInput)
    }
  }, [
    appendGuessCharacter,
    gameStatus,
    loading,
    removeGuessCharacter,
    resultAnimating,
    submitGuess,
    submitting,
  ])

  const keyStatuses = useMemo(() => {
    const scoreMap: Record<TileFeedback, number> = {
      absent: 1,
      present: 2,
      correct: 3,
    }
    const byKey: Record<string, TileFeedback> = {}

    for (const row of attempts) {
      row.guess.split('').forEach((letter, index) => {
        const status = row.result[index]
        if (!status) return
        const prevStatus = byKey[letter]
        if (!prevStatus || scoreMap[status] > scoreMap[prevStatus]) {
          byKey[letter] = status
        }
      })
    }
    return byKey
  }, [attempts])

  const discoveredSet = useMemo(
    () => new Set(discoveredLetters.map((entry) => entry.toLowerCase())),
    [discoveredLetters],
  )

  const progressMasks = useMemo(() => {
    if (terms.length > 0) {
      return terms.map((term) => toProgressMask(term, discoveredSet))
    }
    if (!targetWord) return []
    return [
      targetWord.split('').map((letter) =>
        discoveredSet.has(letter.toLowerCase()) ? letter : null,
      ),
    ]
  }, [terms, discoveredSet, targetWord])

  const progressMask = useMemo(() => progressMasks[0] ?? [], [progressMasks])

  const isFullyDiscovered = useMemo(() => {
    if (!progressMasks.length) return false
    return progressMasks.every((mask) => mask.length > 0 && mask.every((char) => char !== null))
  }, [progressMasks])

  useEffect(() => {
    if (isFullyDiscovered && gameStatus === 'playing') {
      setGameStatus('won')
      setOpenedCompletedGame(true)
      setResult({
        answer: targetWord,
        explanation: result?.explanation ?? null,
        success: true,
      })
    }
  }, [gameStatus, isFullyDiscovered, result?.explanation, targetWord])

  const isInputBlocked = loading || submitting || resultAnimating || gameStatus !== 'playing'

  return {
    category,
    clue,
    cluesUnlocked,
    targetWord,
    wordLength,
    terms,
    attempts,
    attemptsUsed,
    gameStatus,
    answer: result?.answer ?? targetWord,
    explanation: result?.explanation ?? null,
    openedCompletedGame,
    currentGuess,
    processingGuess,
    processingRowIndex,
    processingCycle,
    processingIncorrectGlow,
    loading,
    submitting,
    resultAnimating,
    error,
    keyStatuses,
    progressMasks,
    progressMask,
    revealingRowIndex,
    revealCycle,
    isInputBlocked,
    setGuess,
    appendGuessCharacter,
    removeGuessCharacter,
    submitGuess,
    reload: load,
  }
}
