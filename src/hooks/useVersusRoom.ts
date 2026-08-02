'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import {
  fetchRoomState,
  getAccessToken,
  pingRoom,
  sayGoodbye,
} from '@/lib/versus/queries'
import type {
  VersusPhase,
  VersusPlayer,
  VersusRestoredAnswer,
  VersusRoom,
  VersusStatus,
} from '@/lib/versus/types'

type UseVersusRoomResult = {
  room: VersusRoom | null
  status: VersusStatus | null
  players: VersusPlayer[]
  playerId: string | null
  isHost: boolean
  phase: VersusPhase | null
  /** Cuántos han respondido ya la pregunta en curso (sin decir qué). */
  progress: { answered: number; total: number } | null
  /** Lo que este jugador ya respondió en la ronda en curso, al reconectar. */
  restored: VersusRestoredAnswer | null
  /** Diferencia entre el reloj del servidor y el del navegador, en ms. */
  clockOffset: number
  connected: boolean
  closed: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// El canal es público (cualquiera con el PIN puede escuchar), así que el
// servidor solo emite por ahí lo que puede verse en cada fase. Este hook no
// decide nada del juego: refleja lo que dice el servidor y corrige el reloj.
export function useVersusRoom(pin: string): UseVersusRoomResult {
  const [room, setRoom] = useState<VersusRoom | null>(null)
  const [players, setPlayers] = useState<VersusPlayer[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [phase, setPhase] = useState<VersusPhase | null>(null)
  const [progress, setProgress] = useState<{ answered: number; total: number } | null>(null)
  const [restored, setRestored] = useState<VersusRestoredAnswer | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const [connected, setConnected] = useState(false)
  const [closed, setClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Evita que una resincronización lenta pise el estado de una sala ya cerrada.
  const closedRef = useRef(false)

  // El manejador del canal necesita el playerId actual sin depender de que el
  // efecto se vuelva a crear, así que se guarda también en una referencia.
  const playerIdRef = useRef<string | null>(null)

  // Y la fase anterior, para detectar el arranque de la partida sin leer estado
  // dentro de un actualizador.
  const statusRef = useRef<VersusStatus | null>(null)

  // El navegador puede ir adelantado o atrasado respecto al servidor. Todos los
  // plazos se calculan contra el reloj del servidor, así que cada evento trae
  // su `serverNow` y aquí se guarda la diferencia.
  const syncClock = useCallback((serverNow: number | undefined) => {
    if (typeof serverNow === 'number') setClockOffset(serverNow - Date.now())
  }, [])

  const refresh = useCallback(async () => {
    try {
      const state = await fetchRoomState(pin)
      if (closedRef.current) return
      setRoom(state.room)
      statusRef.current = state.room.status
      setPlayers(state.players)
      setPlayerId(state.playerId)
      playerIdRef.current = state.playerId
      setIsHost(state.isHost)
      setPhase(state.phase ?? null)
      syncClock(state.phase?.serverNow)
      setRestored(
        state.answered && state.room.currentIndex >= 0
          ? { idx: state.room.currentIndex, selected: state.mySelection ?? null }
          : null,
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la sala')
    } finally {
      setLoading(false)
    }
  }, [pin, syncClock])

  useEffect(() => {
    closedRef.current = false
    setClosed(false)
    void refresh()
  }, [refresh])

  // Latido. Es la única forma que tiene el servidor de distinguir "está
  // pensando la respuesta" de "cerró la pestaña hace un minuto": pulsar Salir
  // no lo hace nadie en mitad de una partida.
  useEffect(() => {
    if (!pin || closed) return

    let alive = true
    const beat = () => {
      if (!alive || closedRef.current) return
      void pingRoom(pin).catch(() => {})
    }

    beat()
    const id = window.setInterval(beat, 8000)

    // Hay tres formas distintas de dejar de estar delante de la sala y cada una
    // avisa por su lado:
    //   - cerrar la pestaña o el navegador  -> pagehide
    //   - irse a otra pestaña o bloquear el móvil -> visibilitychange
    //   - pulsar otra sección de MIRDaily   -> ni una ni otra, porque es
    //     navegación de cliente y la página no se descarga: solo se desmonta
    //     este componente, así que el aviso tiene que salir de la limpieza.
    let token: string | null = null
    void getAccessToken()
      .then((value) => {
        token = value
      })
      .catch(() => {})

    const goodbye = () => {
      if (token && !closedRef.current) sayGoodbye(pin, token)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') goodbye()
      else beat()
    }

    window.addEventListener('pagehide', goodbye)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      alive = false
      window.clearInterval(id)
      window.removeEventListener('pagehide', goodbye)
      document.removeEventListener('visibilitychange', onVisibility)
      goodbye()
    }
  }, [pin, closed])

  useEffect(() => {
    if (!pin) return

    const channel = supabase.channel(`versus:${pin}`)

    channel.on('broadcast', { event: 'players' }, ({ payload }) => {
      if (closedRef.current) return
      const next = payload as { players?: VersusPlayer[] }
      if (Array.isArray(next.players)) setPlayers(next.players)
    })

    // Durante la pregunta solo llega el contador, nunca qué ha elegido nadie.
    channel.on('broadcast', { event: 'progress' }, ({ payload }) => {
      if (closedRef.current) return
      const next = payload as { answered: number; total: number }
      setProgress({ answered: next.answered, total: next.total })
    })

    for (const event of ['question', 'picks', 'reveal', 'ended'] as const) {
      channel.on('broadcast', { event }, ({ payload }) => {
        if (closedRef.current) return
        const next = payload as VersusPhase & { status?: VersusStatus }
        syncClock(next.serverNow)
        // El nombre del evento al que estamos suscritos determina la variante
        // de la unión; TypeScript no puede deducirlo dentro del bucle.
        setPhase({ ...next, event } as VersusPhase)
        if (event === 'question') setProgress(null)
        if (next.status) {
          // El modo y las vidas se fijan en /start y NO viajan en los eventos de
          // fase, así que al arrancar hay que volver a leer la sala: si no,
          // `mode` se queda en el 'classic' con el que nació y toda la partida
          // de Guardia se juega como si fuera clásica (sin HUD de vidas y, lo
          // peor, sin bloquear a los eliminados).
          //
          // El estado anterior se lee de una referencia y no del actualizador de
          // setRoom, que tiene que ser puro.
          const antes = statusRef.current
          statusRef.current = next.status
          if (antes === 'lobby' && next.status !== 'lobby') void refresh()

          setRoom((prev) => (prev ? { ...prev, status: next.status! } : prev))
        }
      })
    }

    // Si el anfitrión desaparece del lobby, el servidor traspasa el rol. Llega
    // el id de JUGADOR del nuevo anfitrión, no su user_id: es lo único con lo
    // que cada cliente puede reconocerse a sí mismo.
    // Votos de revancha: se fusionan sobre la fase final que ya está en
    // pantalla, sin volver a pedir nada.
    channel.on('broadcast', { event: 'rematch' }, ({ payload }) => {
      if (closedRef.current) return
      const next = payload as { votes: string[]; rematchUntil: number }
      syncClock((payload as { serverNow?: number }).serverNow)
      setPhase((prev) =>
        prev && prev.event === 'ended'
          ? { ...prev, votes: next.votes, rematchUntil: next.rematchUntil }
          : prev,
      )
    })

    // Votos de "continuar": se fusionan sobre el revelado que ya está en
    // pantalla, para que el contador suba en vivo sin pedir nada.
    channel.on('broadcast', { event: 'continue' }, ({ payload }) => {
      if (closedRef.current) return
      const next = payload as { idx: number; votes: string[]; total: number }
      setPhase((prev) =>
        prev && prev.event === 'reveal' && prev.idx === next.idx
          ? { ...prev, continueVotes: next.votes, continueTotal: next.total }
          : prev,
      )
    })

    channel.on('broadcast', { event: 'rematch_ready' }, ({ payload }) => {
      if (closedRef.current) return
      const next = payload as { pin: string }
      setPhase((prev) =>
        prev && prev.event === 'ended' ? { ...prev, rematchPin: next.pin } : prev,
      )
    })

    channel.on('broadcast', { event: 'host_changed' }, ({ payload }) => {
      if (closedRef.current) return
      const next = payload as { hostPlayerId: string | null }
      const mine = playerIdRef.current
      setIsHost(mine !== null && mine === next.hostPlayerId)
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
      // estuvo caído pudieron pasar rondas enteras y esos broadcasts se
      // perdieron. Este es el único camino de recuperación.
      if (isSubscribed && !closedRef.current) void refresh()
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [pin, refresh, syncClock])

  return {
    room,
    status: room?.status ?? null,
    players,
    playerId,
    isHost,
    phase,
    progress,
    restored,
    clockOffset,
    connected,
    closed,
    loading,
    error,
    refresh,
  }
}
