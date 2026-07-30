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

export async function startGame(
  pin: string,
  config: { subjectIds: number[]; topicIds: number[]; count: number },
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

// La llama cualquier cliente al agotarse su cuenta atrás. El servidor decide si
// de verdad toca avanzar, así que llamarla de más es inofensivo.
export async function advanceRoom(pin: string): Promise<{ advanced: boolean }> {
  return apiFetch<{ advanced: boolean }>(`/rooms/${pin.toUpperCase()}/advance`, {
    method: 'POST',
  })
}
