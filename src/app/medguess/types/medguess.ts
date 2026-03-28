export const MEDGUESS_ATTEMPT_LENGTH = 5
export const MEDGUESS_MAX_ATTEMPTS = 6

export type TileFeedback = 'correct' | 'present' | 'absent'

export type MedGuessAttemptRow = {
  guess: string
  result: TileFeedback[]
}

export type MedGuessTerm = {
  display: string
  mask: string
}

export type MedGuessTodayResponse = {
  category?: string
  clue?: string
  cluesUnlocked?: string[]
  discoveredLetters?: string[]
  terms?: MedGuessTerm[]
  length?: number
  targetWord?: string
  explanation?: string
  attemptsUsed: number
  attempts: unknown[]
  solved: boolean
}

export type MedGuessAttemptResponse = {
  error?: string
  attempt?: {
    guess?: string
    result?: Array<TileFeedback | 'found' | 'known' | 'absent'>
    attemptNumber?: number
  } | null
  result?: Array<TileFeedback | 'found' | 'known' | 'absent'>
  category?: string
  attemptNumber?: number
  remainingAttempts?: number
  terms?: MedGuessTerm[]
  discoveredLetters?: string[]
  cluesUnlocked?: string[]
  explanation?: string
  finished?: {
    answer?: string
    category?: string
    terms?: MedGuessTerm[]
    discoveredLetters?: string[]
    cluesUnlocked?: string[]
    explanation?: string
    success?: boolean
  } | null
}

export type MedGuessResultResponse = {
  answer?: string
  category?: string
  terms?: MedGuessTerm[]
  discoveredLetters?: string[]
  cluesUnlocked?: string[]
  explanation?: string
  solved?: boolean
  attemptsUsed?: number
}

export type MedGuessFinalStatus = 'playing' | 'won' | 'lost'
