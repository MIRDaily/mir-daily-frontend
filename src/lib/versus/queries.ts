'use client'

// Acceso a las salas de Versus a través del BACKEND. El navegador nunca lee las
// tablas game_* directamente: tienen RLS activada y sin políticas, así que la
// anon key no ve nada. El estado de la partida llega por broadcast (ver
// useVersusRoom) y el backend es quien lo emite.

import { supabase } from '@/lib/supabaseBrowser'
import {
  VersusError,
  type VersusErrorCode,
  type VersusJoinResult,
  type VersusMode,
  type VersusRoomState,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL no definida: revisa variables de entorno')
}

async function getToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (error || !token) throw new VersusError('No hay sesión activa.')
  return token
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const response = await fetch(`${API_URL}/api/game${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; code?: VersusErrorCode }
      | null
    throw new VersusError(
      payload?.error || `Error de red (${response.status})`,
      payload?.code,
    )
  }

  return (await response.json()) as T
}

export async function createRoom(
  mode: VersusMode = 'classic',
  config?: Partial<{ secondsPerQuestion: number; maxPlayers: number }>,
): Promise<VersusJoinResult> {
  return apiFetch<VersusJoinResult>('/rooms', {
    method: 'POST',
    body: JSON.stringify({ mode, config }),
  })
}

export async function joinRoom(pin: string): Promise<VersusJoinResult> {
  return apiFetch<VersusJoinResult>(`/rooms/${pin.toUpperCase()}/join`, {
    method: 'POST',
  })
}

export async function fetchRoomState(pin: string): Promise<VersusRoomState> {
  return apiFetch<VersusRoomState>(`/rooms/${pin.toUpperCase()}`)
}

// Si se va el anfitrión, el backend cierra la sala entera.
export async function leaveRoom(pin: string): Promise<{ closed: boolean }> {
  return apiFetch<{ closed: boolean }>(`/rooms/${pin.toUpperCase()}/leave`, {
    method: 'POST',
  })
}

// Latido: le dice al servidor que este jugador sigue delante de la pantalla.
// Sin esto, el servidor no distingue entre "está pensando la respuesta" y
// "cerró la pestaña hace un minuto", y la ronda espera igual a los dos.
export async function pingRoom(pin: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/rooms/${pin.toUpperCase()}/ping`, {
    method: 'POST',
  })
}

// Despedida al cerrar la pestaña, para que el resto no cargue con los 25 s de
// gracia del latido. `keepalive` deja que la petición sobreviva a la descarga
// de la página; sendBeacon no sirve porque no admite cabecera de autorización.
// Es best-effort a propósito: si no llega (crash, sin red), el latido caduca
// solo y el efecto es el mismo, solo que más tarde.
export function sayGoodbye(pin: string, token: string): void {
  void fetch(`${API_URL}/api/game/rooms/${pin.toUpperCase()}/ping`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bye: true }),
  }).catch(() => {})
}

// El token hay que tenerlo YA cuando se dispara `pagehide`: pedirlo entonces es
// asíncrono y la página puede morir antes de que resuelva.
export async function getAccessToken(): Promise<string> {
  return getToken()
}

export async function startGame(
  pin: string,
  config: {
    subjectIds: number[]
    topicIds: number[]
    count: number
    mode: VersusMode
    lives: number
  },
): Promise<{ total: number }> {
  return apiFetch<{ total: number }>(`/rooms/${pin.toUpperCase()}/start`, {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

// No devuelve si se acertó: la corrección llega por el canal en 'reveal',
// cuando el servidor ha cerrado el plazo para todos.
export async function submitAnswer(
  pin: string,
  idx: number,
  selectedOption: number | null,
): Promise<{ accepted: boolean }> {
  return apiFetch<{ accepted: boolean }>(`/rooms/${pin.toUpperCase()}/answer`, {
    method: 'POST',
    body: JSON.stringify({ idx, selectedOption }),
  })
}

// Voto para repetir partida. Devuelve `pin` en cuanto la sala nueva existe;
// hasta entonces solo la lista de quién ha votado.
export async function voteRematch(
  pin: string,
): Promise<{ votes: string[]; pin: string | null }> {
  return apiFetch<{ votes: string[]; pin: string | null }>(
    `/rooms/${pin.toUpperCase()}/rematch`,
    { method: 'POST' },
  )
}

// La llama cualquier cliente al agotarse su cuenta atrás. El servidor decide si
// de verdad toca avanzar, así que llamarla de más es inofensivo.
export async function advanceRoom(pin: string): Promise<{ advanced: boolean }> {
  return apiFetch<{ advanced: boolean }>(`/rooms/${pin.toUpperCase()}/advance`, {
    method: 'POST',
  })
}
