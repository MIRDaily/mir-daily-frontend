'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import { fetchRoomState } from '@/lib/versus/queries'
import type { VersusPlayer, VersusRoom } from '@/lib/versus/types'

type UseVersusRoomResult = {
  room: VersusRoom | null
  players: VersusPlayer[]
  playerId: string | null
  isHost: boolean
  connected: boolean
  closed: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// El canal es público (cualquiera con el PIN puede escuchar), así que el
// servidor no emite por aquí nada que no pueda verse: la plantilla de la sala y
// los cambios de fase. La respuesta correcta de una pregunta viajará solo en el
// evento de revelado, cuando el backend ya haya cerrado el plazo.
export function useVersusRoom(pin: string): UseVersusRoomResult {
  const [room, setRoom] = useState<VersusRoom | null>(null)
  const [players, setPlayers] = useState<VersusPlayer[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [connected, setConnected] = useState(false)
  const [closed, setClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Evita que una resincronización lenta pise el estado de una sala ya cerrada.
  const closedRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const state = await fetchRoomState(pin)
      if (closedRef.current) return
      setRoom(state.room)
      setPlayers(state.players)
      setPlayerId(state.playerId)
      setIsHost(state.isHost)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la sala')
    } finally {
      setLoading(false)
    }
  }, [pin])

  useEffect(() => {
    closedRef.current = false
    setClosed(false)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!pin) return

    const channel = supabase.channel(`versus:${pin}`)

    channel.on('broadcast', { event: 'players' }, ({ payload }) => {
      if (closedRef.current) return
      const next = payload as { players?: VersusPlayer[] }
      if (Array.isArray(next.players)) setPlayers(next.players)
    })

    channel.on('broadcast', { event: 'room_closed' }, () => {
      closedRef.current = true
      setClosed(true)
      setConnected(false)
    })

    channel.subscribe((status) => {
      const isSubscribed = status === 'SUBSCRIBED'
      setConnected(isSubscribed)

      // Al (re)suscribirse se vuelve a pedir el estado: mientras el websocket
      // estuvo caído pudieron entrar o salir jugadores y esos broadcasts se
      // perdieron. Este es el único camino de recuperación.
      if (isSubscribed && !closedRef.current) void refresh()
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [pin, refresh])

  return { room, players, playerId, isHost, connected, closed, loading, error, refresh }
}
