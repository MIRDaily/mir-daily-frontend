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
