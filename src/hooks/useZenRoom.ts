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

export type ZenPose = {
  xPct: number
  yPct: number
  state: AvatarState
  /** Va por los aires: el receptor debe seguir la posición al instante, sin la
   *  transición larga que hace que un lanzamiento parezca un paseo. */
  flying?: boolean
}

/** El gato lo simula el anfitrión y el resto solo lo reproduce. */
export type ZenCatPose = { x: number; y: number; flip: boolean; sleeping: boolean }

export type ZenPinned = { text: string; byName: string; at: number } | null

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
/** Espera antes de emitir un cambio de perfil, para agrupar ráfagas de clics. */
const PROFILE_DEBOUNCE_MS = 450
const MAX_RESUBSCRIBES = 4
const RESUBSCRIBE_BASE_MS = 1500
/** Lo que tarda el muñeco en estallar al marcharse su dueño. */
export const POP_DURATION_MS = 650
export const PIN_MAX_LENGTH = 90

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

/** Ids realmente presentes en el canal ahora mismo. */
function presentIds(channel: RealtimeChannel): Set<string> {
  const out = new Set<string>()
  const state = channel.presenceState<PresenceRow>()
  for (const key of Object.keys(state)) {
    for (const row of state[key] ?? []) {
      if (row?.id) out.add(row.id)
    }
  }
  return out
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
  initialPose,
}: {
  mode: ZenMode
  code: string
  preset: ZenPreset
  name: string
  color: string
  mood: UserMood
  /** Dónde colocar a alguien de quien aún no ha llegado ninguna posición. Sin
   *  esto los recién llegados verían a los presentes aparecer en el centro y
   *  saltar después a su sitio. */
  initialPose: (peerId: string) => ZenPose
}) {
  const topic = useMemo(() => zenChannelTopic(mode, code, preset), [mode, code, preset])

  const myId = getTabId()
  // Se sella al suscribirse: es "cuándo entré a ESTA sala", no cuándo cargó la
  // pestaña, para que al cambiar de sala no arrastres la antigüedad de la previa.
  const joinedAtRef = useRef(0)

  const [connected, setConnected] = useState(false)
  /** Al subir, se tira el canal y se monta uno nuevo. */
  const [reconnectNonce, setReconnectNonce] = useState(0)
  const [isHost, setIsHost] = useState(true)
  const [peers, setPeers] = useState<ZenPeer[]>([])
  const [messages, setMessages] = useState<ZenChatMessage[]>([])
  const [claims, setClaims] = useState<Record<string, ZenClaim>>({})
  const [remoteTimer, setRemoteTimer] = useState<ZenTimerSnapshot | null>(null)
  const [mutedIds, setMutedIds] = useState<string[]>([])
  /** Dónde me lleva quien me tenga agarrado. Null si mando yo sobre mi muñeco. */
  const [foreignPoseOnMe, setForeignPoseOnMe] = useState<ZenPose | null>(null)
  /** Quien acaba de irse, aún en pantalla el tiempo justo para estallar. */
  const [leaving, setLeaving] = useState<ZenPeer[]>([])
  const [pinned, setPinned] = useState<ZenPinned>(null)
  /** El gato va por ref: se mueve muchas veces por segundo y no debe provocar
   *  un render por cada paso. */
  const catPoseRef = useRef<ZenCatPose | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const claimsRef = useRef<Record<string, ZenClaim>>({})
  const posesRef = useRef<Record<string, ZenPose>>({})
  const lastChatAtRef = useRef(0)
  const lastPoseSentRef = useRef(0)
  const myPoseRef = useRef<ZenPose>({ xPct: 50, yPct: 50, state: 'idle' })

  // El perfil viaja en presencia; guardarlo en una ref evita re-suscribir el
  // canal cada vez que el usuario cambia de color o de humor.
  const profileRef = useRef({ name, color, mood })
  const initialPoseRef = useRef(initialPose)
  const popTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const pinnedRef = useRef<ZenPinned>(null)
  const retriesRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    initialPoseRef.current = initialPose
  }, [initialPose])

  useEffect(() => {
    pinnedRef.current = pinned
  }, [pinned])

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
        // Quien ya estaba en la sala aparece directamente en su sitio, no en el
        // centro para luego desplazarse: eso era el "refresh" al unirse.
        const pose = posesRef.current[row.id] ?? initialPoseRef.current(row.id)
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
      // Y si hay un mensaje fijado, que lo vea también. Que respondan varios no
      // importa: fijar lo mismo dos veces deja el mismo resultado.
      const pin = pinnedRef.current
      if (pin) send('pin', pin)
    })

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      // OJO: actualizar la presencia (p. ej. al cambiar de color) llega al resto
      // como una salida seguida de una entrada. Sin comprobar quién sigue
      // realmente en la sala, cambiar de color hacía estallar tu muñeco en la
      // pantalla de los demás como si te hubieras marchado.
      const stillHere = presentIds(channel)
      const gone = (leftPresences ?? []) as unknown as PresenceRow[]
      const popping = gone
        .filter((row) => row?.id && row.id !== myId && !stillHere.has(row.id))
        .map((row) => ({
          id: row.id,
          name: String(row.name ?? 'Alguien').slice(0, 24),
          color: row.color,
          mood: row.mood,
          joinedAt: Number(row.joinedAt) || 0,
          ...(posesRef.current[row.id] ?? initialPoseRef.current(row.id)),
        }))

      if (popping.length) {
        setLeaving((prev) => [...prev, ...popping])
        const ids = popping.map((p) => p.id)
        const timer = setTimeout(() => {
          setLeaving((prev) => prev.filter((p) => !ids.includes(p.id)))
          for (const id of ids) delete posesRef.current[id]
        }, POP_DURATION_MS)
        popTimersRef.current.push(timer)
      }

      readPresence()
      // Al irse alguien de verdad, se sueltan los muñecos que tuviera agarrados.
      // Se compara contra los ids presentes, no contra las claves del estado,
      // que es lo que antes soltaba agarres legítimos por una salida falsa.
      setClaims((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [target, claim] of Object.entries(next)) {
          if (claim.byId !== myId && !stillHere.has(claim.byId)) {
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
      // `flying` tiene que sobrevivir al viaje: si se pierde aquí, el receptor
      // mantiene la transición larga de posición y un lanzamiento se ve como si
      // el muñeco se fuera caminando hasta donde cae.
      const pose: ZenPose = {
        xPct: p.xPct,
        yPct: p.yPct,
        state: (p.state ?? 'idle') as AvatarState,
        flying: Boolean(p.flying),
      }

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

    channel.on('broadcast', { event: 'cat' }, ({ payload }) => {
      const c = payload as Partial<ZenCatPose>
      if (typeof c?.x !== 'number' || typeof c?.y !== 'number') return
      catPoseRef.current = {
        x: c.x,
        y: c.y,
        flip: Boolean(c.flip),
        sleeping: Boolean(c.sleeping),
      }
    })

    channel.on('broadcast', { event: 'pin' }, ({ payload }) => {
      const p = payload as { text?: string; byName?: string; at?: number }
      const text = sanitizeChat(String(p?.text ?? '')).slice(0, PIN_MAX_LENGTH)
      setPinned(
        text
          ? { text, byName: String(p?.byName ?? 'Alguien').slice(0, 24), at: Number(p?.at) || Date.now() }
          : null,
      )
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
        retriesRef.current = 0
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
        // Y se vuelve a intentar con espera creciente. Se rehace el canal
        // entero (subiendo el testigo) en vez de resuscribir este: un canal ya
        // cerrado está desenganchado del socket y `subscribe` sobre él no
        // devuelve ni un estado.
        if (retriesRef.current < MAX_RESUBSCRIBES) {
          const wait = RESUBSCRIBE_BASE_MS * 2 ** retriesRef.current
          retriesRef.current += 1
          retryTimerRef.current = setTimeout(() => setReconnectNonce((n) => n + 1), wait)
        }
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
      setLeaving([])
      setPinned(null)
      setMessages([])
      setClaims({})
      setRemoteTimer(null)
      catPoseRef.current = null
      for (const t of popTimersRef.current) clearTimeout(t)
      popTimersRef.current = []
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
      retriesRef.current = 0
      void supabase.removeChannel(channel)
    }
  }, [topic, myId, send, reconnectNonce])

  // El navegador estrangula los temporizadores de las pestañas en segundo
  // plano, así que Realtime pierde el latido y el servidor acaba cerrando el
  // canal. Al volver a la pestaña se reconstruye en el acto en vez de esperar
  // a que se agoten los reintentos.
  useEffect(() => {
    if (!topic) return
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (channelRef.current?.state === 'joined') return
      retriesRef.current = 0
      setReconnectNonce((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [topic])

  // Republicar el perfil cuando cambia el color o el humor, con antirrebote.
  //
  // Sin él, pasar rápido por los colores del editor emitía una presencia por
  // clic; la ráfaga superaba el límite de tasa de Realtime y el canal se caía,
  // dejando la sala en "Sin conexión". Nadie necesita ver el color intermedio
  // mientras eliges, así que basta con emitir el que quede al parar.
  useEffect(() => {
    const ch = channelRef.current
    if (!ch || !connected) return
    const timer = setTimeout(() => {
      void ch.track({
        id: myId,
        name,
        color,
        mood,
        joinedAt: joinedAtRef.current,
      } satisfies PresenceRow)
    }, PROFILE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
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

  /** El anfitrión emite dónde anda el gato; el resto solo lo reproduce. */
  const getCatPose = useCallback(() => catPoseRef.current, [])

  const publishCat = useCallback(
    (pose: ZenCatPose) => {
      send('cat', pose)
    },
    [send],
  )

  const pin = useCallback(
    (raw: string) => {
      const text = sanitizeChat(raw).slice(0, PIN_MAX_LENGTH)
      const next: ZenPinned = text
        ? { text, byName: profileRef.current.name, at: Date.now() }
        : null
      setPinned(next)
      send('pin', next ?? { text: '' })
    },
    [send],
  )

  const unpin = useCallback(() => {
    setPinned(null)
    send('pin', { text: '' })
  }, [send])

  const toggleMute = useCallback((peerId: string) => {
    setMutedIds((prev) =>
      prev.includes(peerId) ? prev.filter((x) => x !== peerId) : [...prev, peerId],
    )
  }, [])

  const visibleMessages = useMemo(
    () => messages.filter((m) => !mutedIds.includes(m.authorId)),
    [messages, mutedIds],
  )

  // OJO al consumir esto: este objeto cambia de identidad en cada render. NO lo
  // metas entero en las dependencias de un efecto — depende de campos concretos
  // (`room.isHost`, `room.connected`) o de los callbacks, que sí son estables.
  // Ponerlo entero hacía que el anfitrión reemitiera en cada render hasta
  // inundar el canal y tumbar la presencia de la sala.
  return {
    myId,
    connected,
    peers,
    leaving,
    pinned,
    getCatPose,
    messages: visibleMessages,
    claims,
    isHost,
    remoteTimer,
    mutedIds,
    foreignPoseOnMe,
    publishPose,
    publishPoseFor,
    publishCat,
    pin,
    unpin,
    sendChat,
    claim,
    releaseClaim,
    publishTimer,
    toggleMute,
  }
}
