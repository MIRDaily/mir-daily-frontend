export type VersusMode =
  | 'classic'
  | 'mir_rank'
  | 'survival'
  | 'image'
  | 'progressive'

// 'picks' es la fase en la que ya se ve qué ha elegido cada jugador pero
// todavía no cuál era la correcta.
export type VersusStatus =
  | 'lobby'
  | 'question'
  | 'picks'
  | 'reveal'
  | 'scoreboard'
  | 'ended'

export type VersusRoom = {
  id: string
  pin: string
  mode: VersusMode
  status: VersusStatus
  config: VersusConfig
  currentIndex: number
  hostUserId: string
}

export type VersusConfig = {
  secondsPerQuestion: number
  maxPlayers: number
  /** Guardia: vidas con las que se arranca. */
  lives?: number
  /** Qué se jugó, para que la revancha nazca ya configurada igual. */
  selection?: {
    subjectIds?: number[]
    topicIds?: number[]
    count?: number
  }
}

export type VersusPlayer = {
  id: string
  nickname: string
  avatarId: number
  score: number
  isGuest: boolean
  /** Se fue con la partida empezada: sigue en el marcador, pero en gris. */
  left: boolean
  /** Late todavía. Se deshace solo si vuelve, a diferencia de `left`. */
  connected: boolean
  /** Guardia: vidas restantes. null en los modos que no eliminan. */
  lives: number | null
  /** Guardia: en qué pregunta cayó. null = sigue en pie. */
  eliminatedAtIdx: number | null
}

// Eventos que emite el servidor por el canal. Durante 'question' no viaja nada
// que revele la respuesta; 'picks' enseña qué eligió cada uno pero todavía no
// cuál era la buena; la corrección llega solo en 'reveal'.
export type VersusQuestionEvent = {
  event: 'question'
  idx: number
  total: number
  statement: string
  subject: string | null
  topic: string | null
  hasImage: boolean
  imageUrl: string | null
  options: string[]
  /** Instante (ms epoch del servidor) en que termina la cuenta atrás. */
  startsAt: number
  endsAt: number
  serverNow: number
}

export type VersusPicksEvent = {
  event: 'picks'
  idx: number
  serverNow: number
  endsAt: number
  picks: { playerId: string; selected: number | null }[]
}

export type VersusRevealEvent = {
  event: 'reveal'
  idx: number
  serverNow: number
  endsAt: number
  /** Guardia: quién ha caído en esta ronda. */
  eliminated: string[]
  /** Guardia: quién ha perdido una vida sin llegar a caer. */
  wounded: string[]
  /** A partir de cuándo cuentan los votos de continuar (ms epoch servidor). */
  skipFrom: number
  /** Quién ha pulsado ya "continuar". */
  continueVotes: string[]
  /** Sobre cuántos hace falta la mayoría (los que siguen jugando). */
  continueTotal: number
  correctIndex: number
  explanation: string | null
  results: {
    playerId: string
    selected: number | null
    isCorrect: boolean | null
    msTaken: number
    points: number
  }[]
  scores: VersusScore[]
}

// Puntuación ACUMULADA de cada jugador ronda a ronda. Una ronda fallada suma 0
// y la línea se queda plana; no son los puntos de cada pregunta.
export type VersusSeries = {
  playerId: string
  points: number[]
}

export type VersusEndedEvent = {
  event: 'ended'
  serverNow: number
  scores: VersusScore[]
  series: VersusSeries[]
  /** Quiénes han votado repetir. */
  votes: string[]
  /** Fin del plazo de votación (ms epoch del servidor). */
  rematchUntil: number | null
  /** Código de la sala de revancha, cuando ya se ha creado. */
  rematchPin: string | null
}

export type VersusScore = {
  playerId: string
  score: number
  correct: number
  answered: number
}

export type VersusPhase =
  | VersusQuestionEvent
  | VersusPicksEvent
  | VersusRevealEvent
  | VersusEndedEvent

// Lo que este jugador ya respondió en la ronda en curso. Que exista significa
// que respondió, aunque `selected` sea null (dejó la pregunta en blanco).
export type VersusRestoredAnswer = {
  idx: number
  selected: number | null
}

export type VersusRoomState = {
  room: VersusRoom
  players: VersusPlayer[]
  playerId: string | null
  isHost: boolean
  phase?: VersusPhase | null
  answered?: boolean
  mySelection?: number | null
}

export type VersusJoinResult = VersusRoomState & {
  player: VersusPlayer
}

// El backend responde con un `code` cuando el motivo importa para la UI: sin
// username hay que mandar al onboarding, no enseñar un error genérico.
export type VersusErrorCode =
  | 'USERNAME_REQUIRED'
  | 'ALREADY_STARTED'
  | 'ROOM_FULL'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_QUESTIONS'

export class VersusError extends Error {
  code?: VersusErrorCode

  constructor(message: string, code?: VersusErrorCode) {
    super(message)
    this.name = 'VersusError'
    this.code = code
  }
}
