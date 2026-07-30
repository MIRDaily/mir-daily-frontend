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
}

export type VersusPlayer = {
  id: string
  nickname: string
  avatarId: number
  score: number
  isGuest: boolean
}

export type VersusRoomState = {
  room: VersusRoom
  players: VersusPlayer[]
  playerId: string | null
  isHost: boolean
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

export class VersusError extends Error {
  code?: VersusErrorCode

  constructor(message: string, code?: VersusErrorCode) {
    super(message)
    this.name = 'VersusError'
    this.code = code
  }
}
