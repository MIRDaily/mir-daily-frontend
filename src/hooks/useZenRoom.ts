'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseBrowser'
import type { AvatarState, UserMood } from '@/components/zen/ZenAvatar'
import type { ZenPreset, TimerPhase } from '@/state/zenTimerStore'

// La sala compartida vive entera en Supabase Realtime: no hay tabla ni endpoint
// detrás. Mientras haya alguien dentro la sala existe; cuando se va el último,
// desaparece con todo lo que se dijo. Si el canal no llega a conectar, el hook
// se queda en `connected: false` y la sala funciona como la de siempre.

export type ZenMode = 'solo' | 'public' | 'private'

export type ZenPose = { xPct: number; yPct: number; state: AvatarState }

export type ZenPeer = ZenPose & {
  id: string
  name: string
  color: string
  mood: UserMood
  joinedAt: number
}

export type ZenChatMessage = {
  id: string
  authorId: string
  name: string
  text: string
  at: number
}

/** Quién tiene agarrado a qué muñeco. El primero que agarra manda. */
export type ZenClaim = { targetId: string; byId: string; byName: string; at: number }

export type ZenTimerSnapshot = {
  phase: TimerPhase
  timeRemaining: number
  cycle: number
  running: boolean
  preset: ZenPreset
  studyDuration: number
  breakDuration: number
  at: number
}

export const CHAT_MAX_LENGTH = 180
const CHAT_MIN_INTERVAL_MS = 900
const CHAT_HISTORY_LIMIT = 60
/** Un agarre sin noticias se libera solo: si alguien cierra la pestaña
 *  a media faena, su muñeco no se queda secuestrado para siempre. */
const CLAIM_TTL_MS = 8000
const POSE_THROTTLE_MS = 100

type PresenceRow = {
  id: string
  name: string
  color: string
  mood: UserMood
  joinedAt: number
}

/**
 * Identidad de la pestaña, no del componente: se genera una sola vez por carga
 * y sobrevive a que el hook se monte y desmonte. Al ser un singleton memoizado,
 * leerlo en render es idempotente.
 */
let tabId: string | null = null
function getTabId(): string {
  if (!tabId) {
    tabId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `zen-${Math.random().toString(36).slice(2)}${Date.now()}`
  }
  return tabId
}

export function zenChannelTopic(mode: ZenMode, code: string, preset: ZenPreset): string | null {
  if (mode === 'solo') return null
  if (mode === 'private') return code ? `zen:code:${code}` : null
  return `zen:public:${preset}`
}

function sanitizeChat(raw: string): string {
  // Sin saltos de línea ni espacios en ristra: el chat es una tira lateral
  // estrecha y un mensaje "decorado" la rompe entera.
  return raw.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH)
}

/**
 * Resolución determinista de agarres: gana el `at` más bajo y, si empatan, el id
 * menor. Todos los clientes aplican la misma regla sobre los mismos datos, así
 * que convergen sin necesidad de un árbitro central.
 *
 * Usa el reloj de quien envía, de modo que un cliente con la hora muy atrasada
 * ganaría siempre. No hay nada en juego, así que se acepta.
 */
function claimWins(incoming: ZenClaim, current: ZenClaim | undefined, now: number): boolean {
  if (!current) return true
  if (now - current.at > CLAIM_TTL_MS) return true
  if (incoming.at !== current.at) return incoming.at < current.at
  return incoming.byId < current.byId
}

export function useZenRoom({
  mode,
  code,
  preset,
  name,
  color,
  mood,
}: {
  mode: ZenMode
  code: string
  preset: ZenPreset
  name: string
  color: string
  mood: UserMood
}) {
  const topic = useMemo(() => zenChannelTopic(mode, code, preset), [mode, code, preset])

  const myId = getTabId()
  // Se sella al suscribirse: es "cuándo entré a ESTA sala", no cuándo cargó la
  // pestaña, para que al cambiar de sala no arrastres la antigüedad de la previa.
  const joinedAtRef = useRef(0)

  const [connected, setConnected] = useState(false)
  const [isHost, setIsHost] = useState(true)
  const [peers, setPeers] = useState<ZenPeer[]>([])
  const [messages, setMessages] = useState<ZenChatMessage[]>([])
  const [claims, setClaims] = useState<Record<string, ZenClaim>>({})
  const [remoteTimer, setRemoteTimer] = useState<ZenTimerSnapshot | null>(null)
  const [mutedIds, setMutedIds] = useState<string[]>([])
  /** Dónde me lleva quien me tenga agarrado. Null si mando yo sobre mi muñeco. */
  const [foreignPoseOnMe, setForeignPoseOnMe] = useState<ZenPose | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const claimsRef = useRef<Record<string, ZenClaim>>({})
  const posesRef = useRef<Record<string, ZenPose>>({})
  const lastChatAtRef = useRef(0)
  const lastPoseSentRef = useRef(0)
  const myPoseRef = useRef<ZenPose>({ xPct: 50, yPct: 50, state: 'idle' })

  // El perfil viaja en presencia; guardarlo en una ref evita re-suscribir el
  // canal cada vez que el usuario cambia de color o de humor.
  const profileRef = useRef({ name, color, mood })

  // Estos dos espejos se refrescan tras cada commit (no en render) porque los
  // manejadores de puntero necesitan leer el valor vigente de forma síncrona.
  useEffect(() => {
    profileRef.current = { name, color, mood }
  }, [name, color, mood])

  useEffect(() => {
    claimsRef.current = claims
  }, [claims])

  const send = useCallback((event: string, payload: unknown) => {
    const ch = channelRef.current
    if (!ch) return
    void ch.send({ type: 'broadcast', event, payload })
  }, [])

  // ── Suscripción ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Sin topic (modo individual) no hay nada que montar: el estado ya está en
    // sus valores iniciales y la limpieza de abajo lo devuelve ahí al salir.
    if (!topic) return

    const channel = supabase.channel(topic, {
      config: { presence: { key: myId }, broadcast: { self: false } },
    })
    channelRef.current = channel

    const readPresence = () => {
      const raw = channel.presenceState<PresenceRow>()
      const next: ZenPeer[] = []
      for (const key of Object.keys(raw)) {
        const row = raw[key]?.[0]
        if (!row?.id || row.id === myId) continue
        const pose = posesRef.current[row.id] ?? { xPct: 50, yPct: 50, state: 'idle' as AvatarState }
        next.push({
          id: row.id,
          name: String(row.name ?? 'Alguien').slice(0, 24),
          color: row.color,
          mood: row.mood,
          joinedAt: Number(row.joinedAt) || 0,
          ...pose,
        })
      }
      next.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
      setPeers(next)
      // Anfitrión = el más antiguo de la sala. Si se va, el siguiente hereda el
      // papel solo, sin que nadie tenga que elegirlo.
      const mine = joinedAtRef.current
      setIsHost(
        !next.some((p) => p.joinedAt < mine || (p.joinedAt === mine && p.id < myId)),
      )
    }

    channel.on('presence', { event: 'sync' }, readPresence)

    channel.on('presence', { event: 'join' }, () => {
      readPresence()
      // Quien acaba de entrar no sabe dónde está nadie: todos reanuncian su
      // posición para que la sala le aparezca poblada de inmediato.
      send('pose', { id: myId, ...myPoseRef.current })
    })

    channel.on('presence', { event: 'leave' }, () => {
      readPresence()
      // Al irse alguien, se sueltan los muñecos que tuviera agarrados.
      const left = Object.keys(channel.presenceState<PresenceRow>())
      setClaims((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [target, claim] of Object.entries(next)) {
          if (claim.byId !== myId && !left.includes(claim.byId)) {
            delete next[target]
            changed = true
          }
        }
        return changed ? next : prev
      })
    })

    channel.on('broadcast', { event: 'pose' }, ({ payload }) => {
      const p = payload as { id?: string } & Partial<ZenPose>
      if (!p?.id) return
      if (typeof p.xPct !== 'number' || typeof p.yPct !== 'number') return
      const pose: ZenPose = { xPct: p.xPct, yPct: p.yPct, state: (p.state ?? 'idle') as AvatarState }

      // El canal va con `self: false`, así que una pose con mi propio id solo
      // puede venir de alguien que me tiene agarrado y me está zarandeando.
      if (p.id === myId) {
        setForeignPoseOnMe(pose)
        return
      }

      posesRef.current[p.id] = pose
      setPeers((prev) => prev.map((peer) => (peer.id === p.id ? { ...peer, ...pose } : peer)))
    })

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const m = payload as Partial<ZenChatMessage>
      if (!m?.authorId || m.authorId === myId) return
      const text = sanitizeChat(String(m.text ?? ''))
      if (!text) return
      setMessages((prev) => {
        // Anti-spam del lado que recibe: aunque el emisor se salte su propio
        // límite, aquí se le descarta igual.
        const last = [...prev].reverse().find((x) => x.authorId === m.authorId)
        if (last && Date.now() - last.at < CHAT_MIN_INTERVAL_MS) return prev
        const msg: ZenChatMessage = {
          id: String(m.id ?? `${m.authorId}-${Date.now()}`),
          authorId: String(m.authorId),
          name: String(m.name ?? 'Alguien').slice(0, 24),
          text,
          at: Date.now(),
        }
        return [...prev, msg].slice(-CHAT_HISTORY_LIMIT)
      })
    })

    channel.on('broadcast', { event: 'grab' }, ({ payload }) => {
      const c = payload as Partial<ZenClaim>
      if (!c?.targetId || !c.byId || c.byId === myId) return
      const incoming: ZenClaim = {
        targetId: String(c.targetId),
        byId: String(c.byId),
        byName: String(c.byName ?? 'Alguien').slice(0, 24),
        at: Number(c.at) || Date.now(),
      }
      setClaims((prev) =>
        claimWins(incoming, prev[incoming.targetId], Date.now())
          ? { ...prev, [incoming.targetId]: incoming }
          : prev,
      )
    })

    channel.on('broadcast', { event: 'drop' }, ({ payload }) => {
      const c = payload as { targetId?: string; byId?: string }
      if (!c?.targetId || !c.byId) return
      if (c.targetId === myId) setForeignPoseOnMe(null)
      setClaims((prev) => {
        const cur = prev[c.targetId!]
        if (!cur || cur.byId !== c.byId) return prev
        const next = { ...prev }
        delete next[c.targetId!]
        return next
      })
    })

    channel.on('broadcast', { event: 'timer' }, ({ payload }) => {
      const t = payload as Partial<ZenTimerSnapshot>
      if (typeof t?.timeRemaining !== 'number' || !t.phase) return
      setRemoteTimer({
        phase: t.phase,
        timeRemaining: t.timeRemaining,
        cycle: Number(t.cycle) || 1,
        running: Boolean(t.running),
        preset: (t.preset ?? 'classic') as ZenPreset,
        studyDuration: Number(t.studyDuration) || 25 * 60,
        breakDuration: Number(t.breakDuration) || 5 * 60,
        at: Number(t.at) || Date.now(),
      })
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        joinedAtRef.current = Date.now()
        setConnected(true)
        const p = profileRef.current
        void channel.track({
          id: myId,
          name: p.name,
          color: p.color,
          mood: p.mood,
          joinedAt: joinedAtRef.current,
        } satisfies PresenceRow)
        send('pose', { id: myId, ...myPoseRef.current })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Sin canal la sala sigue siendo jugable: se queda como la de siempre.
        setConnected(false)
      }
    })

    // Al salir de la sala (o al cambiar de canal) no queda rastro: ni mensajes,
    // ni agarres, ni compañeros.
    return () => {
      channelRef.current = null
      posesRef.current = {}
      setConnected(false)
      setIsHost(true)
      setPeers([])
      setMessages([])
      setClaims({})
      setRemoteTimer(null)
      void supabase.removeChannel(channel)
    }
  }, [topic, myId, send])

  // Republicar el perfil cuando cambia el color o el humor.
  useEffect(() => {
    const ch = channelRef.current
    if (!ch || !connected) return
    void ch.track({
      id: myId,
      name,
      color,
      mood,
      joinedAt: joinedAtRef.current,
    } satisfies PresenceRow)
  }, [connected, myId, name, color, mood])

  // ── Acciones ──────────────────────────────────────────────────────────────

  const publishPose = useCallback(
    (pose: ZenPose, force = false) => {
      myPoseRef.current = pose
      const now = Date.now()
      if (!force && now - lastPoseSentRef.current < POSE_THROTTLE_MS) return
      lastPoseSentRef.current = now
      send('pose', { id: myId, ...pose })
    },
    [myId, send],
  )

  /**
   * Publica la posición de un muñeco ajeno mientras lo tienes agarrado. Va sin
   * estrangular porque durante un lanzamiento la fluidez es todo el efecto.
   */
  const publishPoseFor = useCallback(
    (targetId: string, pose: ZenPose) => {
      send('pose', { id: targetId, ...pose })
    },
    [send],
  )

  const sendChat = useCallback(
    (raw: string): boolean => {
      const text = sanitizeChat(raw)
      if (!text) return false
      const now = Date.now()
      if (now - lastChatAtRef.current < CHAT_MIN_INTERVAL_MS) return false
      lastChatAtRef.current = now

      const msg: ZenChatMessage = {
        id: `${myId}-${now}`,
        authorId: myId,
        name: profileRef.current.name,
        text,
        at: now,
      }
      // El propio mensaje se pinta en local: el canal va con `self: false`.
      setMessages((prev) => [...prev, msg].slice(-CHAT_HISTORY_LIMIT))
      send('chat', msg)
      return true
    },
    [myId, send],
  )

  /** Intenta agarrar un muñeco. Devuelve false si ya lo tiene otro. */
  const claim = useCallback(
    (targetId: string): boolean => {
      const now = Date.now()
      const current = claimsRef.current[targetId]
      if (current && current.byId !== myId && now - current.at <= CLAIM_TTL_MS) return false

      const mine: ZenClaim = {
        targetId,
        byId: myId,
        byName: profileRef.current.name,
        at: now,
      }
      setClaims((prev) => ({ ...prev, [targetId]: mine }))
      send('grab', mine)
      return true
    },
    [myId, send],
  )

  const releaseClaim = useCallback(
    (targetId: string) => {
      setClaims((prev) => {
        const cur = prev[targetId]
        if (!cur || cur.byId !== myId) return prev
        const next = { ...prev }
        delete next[targetId]
        return next
      })
      send('drop', { targetId, byId: myId })
    },
    [myId, send],
  )

  const publishTimer = useCallback(
    (snapshot: Omit<ZenTimerSnapshot, 'at'>) => {
      send('timer', { ...snapshot, at: Date.now() })
    },
    [send],
  )

  const toggleMute = useCallback((peerId: string) => {
    setMutedIds((prev) =>
      prev.includes(peerId) ? prev.filter((x) => x !== peerId) : [...prev, peerId],
    )
  }, [])

  const visibleMessages = useMemo(
    () => messages.filter((m) => !mutedIds.includes(m.authorId)),
    [messages, mutedIds],
  )

  // Memoizado a propósito: si este objeto cambiara de identidad en cada render,
  // cualquier efecto del consumidor que lo tenga en sus dependencias se
  // reejecutaría sin parar y acabaría inundando el canal de broadcasts.
  return useMemo(
    () => ({
      myId,
      connected,
      peers,
      messages: visibleMessages,
      claims,
      isHost,
      remoteTimer,
      mutedIds,
      foreignPoseOnMe,
      publishPose,
      publishPoseFor,
      sendChat,
      claim,
      releaseClaim,
      publishTimer,
      toggleMute,
    }),
    [
      myId,
      connected,
      peers,
      visibleMessages,
      claims,
      isHost,
      remoteTimer,
      mutedIds,
      foreignPoseOnMe,
      publishPose,
      publishPoseFor,
      sendChat,
      claim,
      releaseClaim,
      publishTimer,
      toggleMute,
    ],
  )
}
