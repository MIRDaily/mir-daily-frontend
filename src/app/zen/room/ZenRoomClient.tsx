'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { ZenTimerProvider, useZenTimer, type ZenPreset } from '@/state/zenTimerStore'
import ZenTimer from '@/components/zen/ZenTimer'
import ZenControls from '@/components/zen/ZenControls'
import ZenRoom, { DESK_SLOTS, SOFA_SLOTS } from '@/components/zen/ZenRoom'
import ZenAvatar, { type ZenAvatarData, type AvatarState, type UserMood } from '@/components/zen/ZenAvatar'
import { useAuthContext } from '@/providers/AuthProvider'
import { playBell } from '@/lib/zenAudio'

// ─── localStorage keys ────────────────────────────────────────────────────────

const ZEN_DATE_KEY     = 'zen_sessions_date'
const ZEN_COUNT_KEY    = 'zen_sessions_count'
const ZEN_STREAK_LAST  = 'zen_streak_last_date'
const ZEN_STREAK_CNT   = 'zen_streak_count'
const ZEN_USERNAME_KEY = 'zen_username'
const ZEN_VISITED_KEY  = 'zen_visited'

// ─── localStorage utilities ───────────────────────────────────────────────────

function getTodayStr()     { return new Date().toISOString().slice(0, 10) }
function getYesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}

function loadSessionData(): { count: number; streak: number } {
  if (typeof window === 'undefined') return { count: 0, streak: 0 }
  const today       = getTodayStr()
  const storedDate  = localStorage.getItem(ZEN_DATE_KEY)   ?? ''
  const storedCount = parseInt(localStorage.getItem(ZEN_COUNT_KEY) ?? '0', 10)
  const count       = storedDate === today ? storedCount : 0

  const lastDay  = localStorage.getItem(ZEN_STREAK_LAST) ?? ''
  const streakN  = parseInt(localStorage.getItem(ZEN_STREAK_CNT) ?? '0', 10)
  const streak   = (lastDay === today || lastDay === getYesterdayStr()) ? streakN : 0
  return { count, streak }
}

/** Returns yesterday's session count when the stored date is exactly yesterday. */
function getYesterdaySessions(): number | null {
  if (typeof window === 'undefined') return null
  const storedDate  = localStorage.getItem(ZEN_DATE_KEY)   ?? ''
  const storedCount = parseInt(localStorage.getItem(ZEN_COUNT_KEY) ?? '0', 10)
  return storedDate === getYesterdayStr() && storedCount > 0 ? storedCount : null
}

function incrementSession(): { count: number; streak: number } {
  if (typeof window === 'undefined') return { count: 0, streak: 0 }
  const today       = getTodayStr()
  const storedDate  = localStorage.getItem(ZEN_DATE_KEY)   ?? ''
  const storedCount = parseInt(localStorage.getItem(ZEN_COUNT_KEY) ?? '0', 10)
  const newCount    = storedDate === today ? storedCount + 1 : 1
  localStorage.setItem(ZEN_DATE_KEY,  today)
  localStorage.setItem(ZEN_COUNT_KEY, String(newCount))

  const lastDay  = localStorage.getItem(ZEN_STREAK_LAST) ?? ''
  const streakN  = parseInt(localStorage.getItem(ZEN_STREAK_CNT) ?? '0', 10)
  let newStreak: number
  if      (lastDay === today)              { newStreak = streakN }
  else if (lastDay === getYesterdayStr())  { newStreak = streakN + 1 }
  else                                     { newStreak = 1 }
  localStorage.setItem(ZEN_STREAK_LAST, today)
  localStorage.setItem(ZEN_STREAK_CNT,  String(newStreak))
  return { count: newCount, streak: newStreak }
}

// ─── Session progression ──────────────────────────────────────────────────────

const DOT_CAP              = 8
const COMPLETION_THRESHOLD = 8

const MILESTONES: Record<number, string> = {
  3: '🌿 Buen ritmo hoy',
  5: '⭐ Día muy sólido',
  8: '🏆 Nivel élite',
}

// ─── Room identity ────────────────────────────────────────────────────────────

const ROOM_NAMES = [
  'Biblioteca Central',
  'Sala Norte',
  'Sala Silenciosa',
  'Sala de Estudio',
  'Sala Este',
  'Sala Quieta',
]

// ─── Character editor constants ───────────────────────────────────────────────

const ZEN_USER_COLOR_KEY = 'zen_user_color'
const ZEN_USER_MOOD_KEY  = 'zen_user_mood'

/** Ordered left→right on the mood slider: sad … neutral … happy */
const MOOD_STEPS: UserMood[] = ['sad', 'neutral', 'happy']

/** Palette offered in the colour slider (12 swatches) */
const USER_COLORS = [
  '#E8A598', // salmon  (default)
  '#F4B382', // peach
  '#F2D06B', // yellow
  '#8BD4A8', // mint
  '#7AADCA', // sky-blue
  '#A888C4', // lavender
  '#E87878', // coral-red
  '#E898C8', // pink
  '#6ABFAD', // teal
  '#7D9A96', // slate
  '#C49A5A', // gold
  '#A8C4E8', // powder-blue
]

// ─── Avatar constants ─────────────────────────────────────────────────────────

const VALID_PRESETS: ZenPreset[] = ['classic', 'deep', 'custom']

// 12 colours — index 0 = user, 1–11 = bots
const AVATAR_COLORS = [
  '#E8A598', '#7AADCA', '#8BA888', '#C4A05A',
  '#A888C4', '#C4655A', '#7D8A96', '#6ABFAD',
  '#C49A5A', '#7AC4B0', '#A8A888', '#C47A8B',
]

// 11 named bots — supports up to 12 total (1 user + 11)
const BOT_NAMES = [
  'marta_mir',  'sergio_med', 'laura_r5',  'carlos_mfyc',
  'ana_cir',    'pablo_psi',  'elena_ped', 'david_urg',
  'sofia_rad',  'luis_gin',   'nadia_neu',
]

// Bot suffixes are generated client-side only (inside useEffect) to avoid
// SSR/client hydration mismatches from Math.random() at module scope.
function makeBotSuffixes(): string[] {
  return BOT_NAMES.map(() => `_${String(Math.floor(Math.random() * 90) + 10)}`)
}

// Stable floor positions for bots beyond the 8 desk slots
const FLOOR_SPOTS = [
  { xPct: 22, yPct: 60 },
  { xPct: 50, yPct: 66 },
  { xPct: 73, yPct: 61 },
  { xPct: 35, yPct: 71 },
]

const AVATAR_Y_OFFSET          = 6
const WALK_DURATION_MS         = 4000   // matches 3.8s CSS transition + 200ms settle buffer
const BREAK_WANDER_INTERVAL_MS = 32000  // 32 s of chatting before regrouping

const BREAK_X = { min: 8,  max: 70 }   // wanderers stay in the desk area
const BREAK_Y = { min: 34, max: 86 }

const USER_ENTRY_Y        = 125
const USER_ENTRY_DELAY_MS = 800

// ─── Extended local avatar type ───────────────────────────────────────────────

/** Augments ZenAvatarData with a stable floor position for desk-less bots. */
type ExtAvatarData = ZenAvatarData & {
  floorPos?: { xPct: number; yPct: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolvePreset(raw: string | null): ZenPreset {
  if (raw && (VALID_PRESETS as string[]).includes(raw)) return raw as ZenPreset
  return 'classic'
}

function buildInitialAvatars(userUsername: string, botCount: number, botSuffixes: string[] = [], userSlotIdx = 0, userInitialColor = USER_COLORS[0]): ExtAvatarData[] {
  const result: ExtAvatarData[] = []

  // User — random desk slot each session, starts off-screen at the bottom
  result.push({
    id:        'user',
    username:  userUsername,
    color:     userInitialColor,
    xPct:      DESK_SLOTS[userSlotIdx].xPct,
    yPct:      USER_ENTRY_Y,
    deskIndex: userSlotIdx,
    state:     'idle',
    isUser:    true,
  })

  // Bots — fill all desk slots except the one taken by the user
  const botDeskSlots = DESK_SLOTS.map((_, i) => i).filter(i => i !== userSlotIdx)
  for (let i = 0; i < botCount; i++) {
    const hasDeskSlot = i < botDeskSlots.length
    const slotIdx     = hasDeskSlot ? botDeskSlots[i] : -1
    const floorSpot   = hasDeskSlot
      ? undefined
      : { ...FLOOR_SPOTS[(i - botDeskSlots.length) % FLOOR_SPOTS.length] }
    const deskSlot    = hasDeskSlot ? DESK_SLOTS[slotIdx] : undefined

    result.push({
      id:        `bot-${i + 1}`,
      username:  BOT_NAMES[i % BOT_NAMES.length] + (botSuffixes[i] ?? ''),
      color:     AVATAR_COLORS[(i + 1) % AVATAR_COLORS.length],
      xPct:      deskSlot ? deskSlot.xPct : floorSpot!.xPct,
      yPct:      deskSlot ? USER_ENTRY_Y   : floorSpot!.yPct,
      deskIndex: slotIdx,
      state:     'idle',
      isUser:    false,
      floorPos:  floorSpot,
    })
  }

  return result
}

// Fixed member offsets (dx%, dy%) within each chat group.
// Each step is larger than an avatar width (5.5%) so no intra-group overlap.
// Size 1: alone; size 2: side-by-side; size 3: triangle.
const GROUP_OFFSETS = [
  [{ dx: 0,   dy: 0  }],
  [{ dx: -6,  dy: 0  }, { dx: 6,  dy: 0  }],
  [{ dx: -6,  dy: -9 }, { dx: 6,  dy: -9 }, { dx: 0, dy: 8 }],
] as const

// Desk exclusion: desks sit at DESK_SLOTS positions; keep avatars clear by
// rx % in X and ry % in Y so they walk in the corridors, not through furniture.
const DESK_EX_RX = 9   // half-width  exclusion around each desk centre
const DESK_EX_RY = 8   // half-height exclusion around each desk centre

function onDesk(px: number, py: number): boolean {
  return DESK_SLOTS.some(
    (d) => Math.abs(px - d.xPct) < DESK_EX_RX && Math.abs(py - d.yPct) < DESK_EX_RY,
  )
}

// Corridor Y values — the clear horizontal lanes between desk rows.
const CORRIDOR_Y = [50, 70] as const

/**
 * Returns an intermediate waypoint if the direct path from `from` to `to`
 * passes through desk furniture, otherwise returns null (path is clear).
 */
function corridorWaypoint(
  from: { xPct: number; yPct: number },
  to:   { xPct: number; yPct: number },
): { xPct: number; yPct: number } | null {
  const blocked = [0.33, 0.5, 0.67].some(t => {
    const x = from.xPct + (to.xPct - from.xPct) * t
    const y = from.yPct + (to.yPct - from.yPct) * t
    return onDesk(x, y)
  })
  if (!blocked) return null

  const midY = (from.yPct + to.yPct) / 2
  const cy   = [...CORRIDOR_Y].reduce((best, c) =>
    Math.abs(c - midY) < Math.abs(best - midY) ? c : best,
  )
  const cx = (from.xPct + to.xPct) / 2
  return { xPct: cx, yPct: cy }
}

/**
 * Assign break positions.
 * - At least 2 (and up to ~45 %) sit on sofas.
 * - Remaining avatars form chat groups of 2–3 in desk-area corridors.
 * - Each avatar position is checked against (a) desk furniture and
 *   (b) every previously placed avatar — no overlaps.
 * - Original array order preserved → CSS position transitions animate (no teleport).
 */
function assignBreakPositions(prev: ExtAvatarData[]): {
  waypoints: ExtAvatarData[]
  final:     ExtAvatarData[]
} {
  const n        = prev.length
  const shuffled = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5)

  // At least 2 on sofas; at most ~45 % (so chat groups always exist too)
  const sofaCount = Math.max(2, Math.min(Math.floor(n * 0.45), SOFA_SLOTS.length))
  const sofaIdx   = shuffled.slice(0, sofaCount)
  const chatIdx   = shuffled.slice(sofaCount)

  const result = prev.map((a) => ({ ...a, state: 'break_walking' as AvatarState }))
  const placed: Array<{ xPct: number; yPct: number }> = []

  // ── Sofa sitters ─────────────────────────────────────────────────────────────
  sofaIdx.forEach((origIdx, j) => {
    const slot = SOFA_SLOTS[j]
    result[origIdx] = { ...prev[origIdx], xPct: slot.xPct, yPct: slot.yPct, state: 'break_walking' as AvatarState }
    placed.push(slot)
  })

  // ── Chat clusters in desk-area corridors ─────────────────────────────────────
  function overlapsPlaced(x: number, y: number): boolean {
    return placed.some((p) => Math.abs(p.xPct - x) < 9 && Math.abs(p.yPct - y) < 11)
  }

  function invalid(x: number, y: number): boolean {
    return onDesk(x, y) || overlapsPlaced(x, y)
  }

  let ci = 0
  while (ci < chatIdx.length) {
    const remaining = chatIdx.length - ci
    const size      = remaining === 1 ? 1 : (remaining >= 3 && Math.random() < 0.5) ? 3 : 2
    const group     = chatIdx.slice(ci, ci + size)
    ci += size

    const offsets = GROUP_OFFSETS[size - 1]

    let cx = 0, cy = 0, found = false
    for (let attempt = 0; attempt < 60; attempt++) {
      cx = BREAK_X.min + Math.random() * (BREAK_X.max - BREAK_X.min)
      cy = BREAK_Y.min + Math.random() * (BREAK_Y.max - BREAK_Y.min)
      if (offsets.every((o) => !invalid(cx + o.dx, cy + o.dy))) { found = true; break }
    }
    if (!found) {
      for (let attempt = 0; attempt < 30; attempt++) {
        cx = BREAK_X.min + Math.random() * (BREAK_X.max - BREAK_X.min)
        cy = BREAK_Y.min + Math.random() * (BREAK_Y.max - BREAK_Y.min)
        if (offsets.every((o) => !overlapsPlaced(cx + o.dx, cy + o.dy))) break
      }
    }

    group.forEach((origIdx, j) => {
      const { dx, dy } = offsets[j]
      const x = Math.max(BREAK_X.min, Math.min(BREAK_X.max, cx + dx))
      const y = Math.max(BREAK_Y.min, Math.min(BREAK_Y.max, cy + dy))
      result[origIdx] = { ...prev[origIdx], xPct: x, yPct: y, state: 'break_walking' as AvatarState }
      placed.push({ xPct: x, yPct: y })
    })
  }

  // ── Compute intermediate waypoints ───────────────────────────────────────────
  const waypoints: ExtAvatarData[] = result.map((a, i) => {
    const wp = corridorWaypoint(
      { xPct: prev[i].xPct, yPct: prev[i].yPct },
      { xPct: a.xPct,       yPct: a.yPct },
    )
    if (!wp) return { ...prev[i], state: 'break_walking' as AvatarState }
    return { ...prev[i], xPct: wp.xPct, yPct: wp.yPct, state: 'break_walking' as AvatarState }
  })

  return { waypoints, final: result }
}

/** Position where an avatar rests (desk slot or stable floor spot). */
function restPos(a: ExtAvatarData): { xPct: number; yPct: number } {
  if (a.deskIndex < 0 && a.floorPos) return a.floorPos
  const slot = DESK_SLOTS[a.deskIndex]
  return { xPct: slot.xPct, yPct: slot.yPct + AVATAR_Y_OFFSET }
}

// ─── Background colours per phase ────────────────────────────────────────────

const PAGE_BG: Record<string, string> = {
  idle:  '#FAF7F4',
  study: '#FDF5EF',
  break: '#F2F7FA',
}

// ─── Root export ─────────────────────────────────────────────────────────────

export default function ZenRoomClient() {
  const searchParams = useSearchParams()
  const preset = resolvePreset(searchParams.get('preset'))
  return (
    <ZenTimerProvider initialPreset={preset}>
      <ZenRoomView />
    </ZenTimerProvider>
  )
}

// ─── Inner view ───────────────────────────────────────────────────────────────

function ZenRoomView() {
  const router                = useRouter()
  const { user }              = useAuthContext()
  const { state: timerState } = useZenTimer()
  const authUsername          = user?.username ?? user?.display_name ?? 'tú'

  // ── Stable per-session values — SSR-safe defaults, randomised after mount ──
  const [botCount, setBotCount] = useState(7)
  const [roomName, setRoomName] = useState(ROOM_NAMES[0])

  // ── User identity ─────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState('')

  const effectiveUsername = displayName || authUsername

  // ── Character editor state ─────────────────────────────────────────────────
  const [userMood,  setUserMood]  = useState<UserMood>('neutral')
  const [userColor, setUserColor] = useState(USER_COLORS[0])

  // ── Core UI state ─────────────────────────────────────────────────────────
  const [avatars, setAvatars] = useState<ExtAvatarData[]>(() =>
    buildInitialAvatars(authUsername, 7),
  )
  const [pageBg,          setPageBg]          = useState(PAGE_BG.idle)
  const [sessionCount,    setSessionCount]    = useState(0)
  const [streakCount,     setStreakCount]      = useState(0)
  const [completionToast, setCompletionToast] = useState<string | null>(null)
  const [welcomeToast,    setWelcomeToast]    = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const studyTimeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const relaxTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const chatSettleRef    = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const toastTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const welcomeToastRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const fidgetTimeoutRef = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const fidgetRestoreRef = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const fidgetTargetRef  = useRef<string | null>(null)
  const isMountedRef     = useRef(false)
  const prevPhaseRef     = useRef<string>('idle')
  const isFirstPhaseRef  = useRef(true)
  const pageRef          = useRef<HTMLDivElement>(null)
  const coffeeTimerRef   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const coffeeRestoreRef = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const chatWaypointRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const breakFinalRef    = useRef<ExtAvatarData[] | null>(null)

  // ── Physics / throw refs ───────────────────────────────────────────────────
  // Phase: 'idle' | 'drag' | 'fly' | 'fallen' | 'returning'
  const throwPhaseRef = useRef<'idle' | 'drag' | 'fly' | 'fallen' | 'returning'>('idle')
  // Physics body (absolute px from room top-left, velocity in px/frame)
  const phys          = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  // Anchor: React-managed desk position (xPct, yPct) captured at grab start
  const throwAnchor   = useRef({ xPct: 0, yPct: 0, deskIndex: 0 })
  const throwRafRef   = useRef<number | null>(null)
  const throwGrabOff  = useRef({ x: 0, y: 0 })
  const throwMhist    = useRef<Array<{ x: number; y: number; t: number }>>([])

  // ── Fullscreen state ──────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ── Client-only init: random values + localStorage (runs once after mount) ─
  useEffect(() => {
    const count      = Math.floor(Math.random() * 7) + 5
    const name       = ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)]
    const saved      = localStorage.getItem(ZEN_USERNAME_KEY) ?? ''
    const effName    = saved || authUsername
    const suffixes   = makeBotSuffixes()
    const userSlot   = Math.floor(Math.random() * DESK_SLOTS.length)
    // Character editor persistence
    const savedColor = localStorage.getItem(ZEN_USER_COLOR_KEY) ?? USER_COLORS[0]
    const savedMood  = (localStorage.getItem(ZEN_USER_MOOD_KEY) as UserMood | null) ?? 'neutral'
    setBotCount(count)
    setRoomName(name)
    setDisplayName(saved)
    setUserColor(savedColor)
    setUserMood(MOOD_STEPS.includes(savedMood) ? savedMood : 'neutral')
    setAvatars(buildInitialAvatars(effName, count, suffixes, userSlot, savedColor))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load session counts from localStorage ─────────────────────────────────
  useEffect(() => {
    const data = loadSessionData()
    setSessionCount(data.count)
    setStreakCount(data.streak)
  }, [])

  // ── Sync user colour → avatars array + localStorage ───────────────────────
  useEffect(() => {
    localStorage.setItem(ZEN_USER_COLOR_KEY, userColor)
    setAvatars(prev => prev.map(a => a.isUser ? { ...a, color: userColor } : a))
  }, [userColor])

  // ── Persist user mood → localStorage ─────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(ZEN_USER_MOOD_KEY, userMood)
  }, [userMood])

  // ── Return feeling + session memory toast (once per page load) ────────────
  useEffect(() => {
    const yesterdayN = getYesterdaySessions()
    const isReturn   = localStorage.getItem(ZEN_VISITED_KEY) === 'true'
    localStorage.setItem(ZEN_VISITED_KEY, 'true')

    let msg: string | null = null
    if (yesterdayN !== null) {
      msg = `Ayer hiciste ${yesterdayN} ${yesterdayN === 1 ? 'sesión' : 'sesiones'} 📚`
    } else if (isReturn) {
      msg = 'Bienvenido de nuevo 👋'
    }
    if (!msg) return

    let innerTimer: ReturnType<typeof setTimeout> | null = null
    welcomeToastRef.current = setTimeout(() => {
      setWelcomeToast(msg)
      innerTimer = setTimeout(() => setWelcomeToast(null), 3000)
    }, 1600)

    return () => {
      if (welcomeToastRef.current) clearTimeout(welcomeToastRef.current)
      if (innerTimer)              clearTimeout(innerTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entry animation: all desk avatars walk in staggered on mount ──────────
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    // Each slot gets a fully independent random delay: 300–2800 ms
    // Minimum 300 ms so client-init has already fired before first avatar moves
    DESK_SLOTS.forEach((_, slotIdx) => {
      const entryDelay = 300 + Math.random() * 2500
      timers.push(
        setTimeout(() => {
          setAvatars((prev) =>
            prev.map((a) =>
              a.deskIndex === slotIdx
                ? { ...a, ...restPos(a), state: 'walking' as AvatarState }
                : a,
            ),
          )
          timers.push(
            setTimeout(() => {
              setAvatars((prev) =>
                prev.map((a) =>
                  a.deskIndex === slotIdx
                    ? { ...a, state: 'idle' as AvatarState }
                    : a,
                ),
              )
            }, WALK_DURATION_MS + 200),
          )
        }, entryDelay),
      )
    })

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bell + background + session increment on phase transitions ────────────
  useEffect(() => {
    if (!isMountedRef.current) { isMountedRef.current = true; return }

    const phase = timerState.phase
    setPageBg(PAGE_BG[phase] ?? PAGE_BG.idle)
    if (phase === 'study' || phase === 'break') void playBell(phase)

    if (phase === 'break' && prevPhaseRef.current === 'study') {
      const { count, streak } = incrementSession()
      setSessionCount(count)
      setStreakCount(streak)
      const msg = MILESTONES[count] ?? '✨ +1 sesión completada'
      setCompletionToast(msg)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setCompletionToast(null), 2500)
    }

    prevPhaseRef.current = phase
  }, [timerState.phase])

  // ── Sync username when auth resolves or user edits their display name ──────
  useEffect(() => {
    setAvatars((prev) =>
      prev.map((a) => (a.isUser ? { ...a, username: effectiveUsername } : a)),
    )
  }, [effectiveUsername])

  // ── Drive avatar positions + states from timer phase ──────────────────────
  useEffect(() => {
    if (studyTimeoutRef.current)  clearTimeout(studyTimeoutRef.current)
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current)
    if (relaxTimerRef.current)    clearTimeout(relaxTimerRef.current)

    const phase = timerState.phase

    if (phase === 'idle') {
      if (isFirstPhaseRef.current) { isFirstPhaseRef.current = false; return }
      setAvatars((prev) =>
        prev.map((a) => ({ ...a, ...restPos(a), state: 'idle' as AvatarState })),
      )

    } else if (phase === 'study') {
      isFirstPhaseRef.current = false
      setAvatars((prev) =>
        prev.map((a) => ({ ...a, ...restPos(a), state: 'walking' as AvatarState })),
      )
      studyTimeoutRef.current = setTimeout(() => {
        setAvatars((prev) =>
          prev.map((a) => ({
            ...a,
            state: (a.deskIndex >= 0 ? 'studying' : 'idle') as AvatarState,
          })),
        )
      }, WALK_DURATION_MS + 200)

    } else if (phase === 'break') {
      isFirstPhaseRef.current = false

      const gatherAndChat = () => {
        if (chatSettleRef.current)   clearTimeout(chatSettleRef.current)
        if (chatWaypointRef.current) clearTimeout(chatWaypointRef.current)

        // Phase 1 — walk to corridor waypoints (avoids cutting through desks)
        setAvatars((prev) => {
          const { waypoints, final } = assignBreakPositions(prev)
          breakFinalRef.current = final
          return waypoints
        })

        // Phase 2 — after the first leg completes, walk to final positions
        chatWaypointRef.current = setTimeout(() => {
          setAvatars(_prev => breakFinalRef.current ?? _prev)

          // Phase 3 — after arriving, settle into conversation states
          chatSettleRef.current = setTimeout(() => {
            setAvatars((prev) =>
              prev.map((a) => {
                const onSofa = SOFA_SLOTS.some(
                  s => Math.abs(a.xPct - s.xPct) < 8 && Math.abs(a.yPct - s.yPct) < 10,
                )
                return { ...a, state: (onSofa ? 'sitting' : 'chatting') as AvatarState }
              }),
            )
          }, WALK_DURATION_MS + 500)
        }, WALK_DURATION_MS)
      }

      setAvatars((prev) => prev.map((a) => ({ ...a, state: 'idle' as AvatarState })))
      relaxTimerRef.current = setTimeout(() => {
        gatherAndChat()
        breakIntervalRef.current = setInterval(gatherAndChat, BREAK_WANDER_INTERVAL_MS)
      }, 500)
    }

    return () => {
      if (studyTimeoutRef.current)   clearTimeout(studyTimeoutRef.current)
      if (breakIntervalRef.current)  clearInterval(breakIntervalRef.current)
      if (relaxTimerRef.current)     clearTimeout(relaxTimerRef.current)
      if (chatSettleRef.current)     clearTimeout(chatSettleRef.current)
      if (chatWaypointRef.current)   clearTimeout(chatWaypointRef.current)
    }
  }, [timerState.phase])

  // ── Avatar micro-behaviours: random fidget during study ───────────────────
  useEffect(() => {
    if (timerState.phase !== 'study') {
      if (fidgetTimeoutRef.current) clearTimeout(fidgetTimeoutRef.current)
      if (fidgetRestoreRef.current) clearTimeout(fidgetRestoreRef.current)
      return
    }

    function doFidget() {
      setAvatars((prev) => {
        const bots = prev.filter((a) => !a.isUser && a.state === 'studying')
        if (bots.length === 0) return prev
        const target = bots[Math.floor(Math.random() * bots.length)]
        fidgetTargetRef.current = target.id
        return prev.map((a) =>
          a.id === target.id ? { ...a, state: 'idle' as AvatarState } : a,
        )
      })
      fidgetRestoreRef.current = setTimeout(() => {
        const tid = fidgetTargetRef.current
        if (tid) {
          setAvatars((prev) =>
            prev.map((a) =>
              a.id === tid ? { ...a, state: 'studying' as AvatarState } : a,
            ),
          )
          fidgetTargetRef.current = null
        }
      }, 2000)
    }

    function scheduleFidget() {
      const delay = 20_000 + Math.random() * 20_000
      fidgetTimeoutRef.current = setTimeout(() => {
        doFidget()
        scheduleFidget()
      }, delay)
    }

    scheduleFidget()

    return () => {
      if (fidgetTimeoutRef.current) clearTimeout(fidgetTimeoutRef.current)
      if (fidgetRestoreRef.current) clearTimeout(fidgetRestoreRef.current)
    }
  }, [timerState.phase])

  // ── Exit friction: browser warn when closing mid-session ──────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (timerState.running && timerState.phase === 'study') {
        e.preventDefault(); e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [timerState.running, timerState.phase])

  // ── Sporadic coffee-drinking during breaks ────────────────────────────────
  useEffect(() => {
    if (coffeeTimerRef.current)   clearTimeout(coffeeTimerRef.current)
    if (coffeeRestoreRef.current) clearTimeout(coffeeRestoreRef.current)

    if (timerState.phase !== 'break') return

    function scheduleCoffee() {
      const gap = 10_000 + Math.random() * 15_000
      coffeeTimerRef.current = setTimeout(() => {
        let pickedId: string | null = null

        setAvatars((prev) => {
          const eligible = prev.filter(
            (a) => a.state === 'chatting' || a.state === 'sitting',
          )
          if (eligible.length === 0) return prev
          const target = eligible[Math.floor(Math.random() * eligible.length)]
          pickedId = target.id
          return prev.map((a) =>
            a.id === target.id ? { ...a, state: 'coffee' as AvatarState } : a,
          )
        })

        coffeeRestoreRef.current = setTimeout(() => {
          setAvatars((prev) =>
            prev.map((a) => {
              if (a.state !== 'coffee' || (pickedId && a.id !== pickedId)) return a
              const onSofa = SOFA_SLOTS.some(
                (s) => Math.abs(a.xPct - s.xPct) < 8 && Math.abs(a.yPct - s.yPct) < 10,
              )
              return { ...a, state: (onSofa ? 'sitting' : 'chatting') as AvatarState }
            }),
          )
          scheduleCoffee()
        }, 3000 + Math.random() * 2000)
      }, gap)
    }

    coffeeTimerRef.current = setTimeout(scheduleCoffee, 5000)

    return () => {
      if (coffeeTimerRef.current)   clearTimeout(coffeeTimerRef.current)
      if (coffeeRestoreRef.current) clearTimeout(coffeeRestoreRef.current)
    }
  }, [timerState.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fullscreen API ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      const entering = !!document.fullscreenElement
      setIsFullscreen(entering)

      // El #cozy-cursor vive en <body> y queda fuera del contexto fullscreen.
      // Solución: moverlo dentro del elemento fullscreen al entrar,
      // y devolverlo al <body> al salir. position:fixed sigue funcionando
      // relativo al viewport fullscreen, y los listeners de document siguen activos.
      const cozyCursor = document.getElementById('cozy-cursor')
      if (!cozyCursor) return

      if (entering && pageRef.current) {
        pageRef.current.appendChild(cozyCursor)
      } else {
        document.body.appendChild(cozyCursor)
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      // Asegurar que el cursor vuelve al body al desmontar
      const cozyCursor = document.getElementById('cozy-cursor')
      if (cozyCursor && cozyCursor.parentElement !== document.body) {
        document.body.appendChild(cozyCursor)
      }
    }
  }, [])

  // ── Global unmount cleanup ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (toastTimerRef.current)    clearTimeout(toastTimerRef.current)
      if (welcomeToastRef.current)  clearTimeout(welcomeToastRef.current)
      if (relaxTimerRef.current)    clearTimeout(relaxTimerRef.current)
      if (chatSettleRef.current)    clearTimeout(chatSettleRef.current)
      if (fidgetTimeoutRef.current) clearTimeout(fidgetTimeoutRef.current)
      if (fidgetRestoreRef.current) clearTimeout(fidgetRestoreRef.current)
      if (studyTimeoutRef.current)  clearTimeout(studyTimeoutRef.current)
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current)
      if (coffeeTimerRef.current)   clearTimeout(coffeeTimerRef.current)
      if (coffeeRestoreRef.current) clearTimeout(coffeeRestoreRef.current)
      setCompletionToast(null)
    }
  }, [])

  // ── Cancel physics RAF on unmount ─────────────────────────────────────────
  useEffect(() => () => {
    if (throwRafRef.current) cancelAnimationFrame(throwRafRef.current)
  }, [])

  // ── Event handlers ────────────────────────────────────────────────────────
  function handleBackClick() {
    if (timerState.running && timerState.phase === 'study') {
      setShowExitConfirm(true)
    } else {
      router.push('/zen')
    }
  }

  function toggleFullscreen() {
    if (!isFullscreen) pageRef.current?.requestFullscreen().catch(() => {})
    else               document.exitFullscreen().catch(() => {})
  }

  function handleNameSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = nameInput.trim().slice(0, 20)
    setDisplayName(trimmed)
    if (trimmed) {
      localStorage.setItem(ZEN_USERNAME_KEY, trimmed)
    } else {
      localStorage.removeItem(ZEN_USERNAME_KEY)
    }
    setEditingName(false)
  }

  // ── Physics helpers ───────────────────────────────────────────────────────
  //
  // Coordinate system: all physics x/y are in ZenRoom-local pixels.
  // The ZenRoom container is el.offsetParent (position:relative div that
  // contains the avatars). Using pageRef would give the wrong dimensions.

  const throwZenRoomRef = useRef<HTMLElement | null>(null)

  function setPhysVars(el: HTMLElement, ox: number, oy: number) {
    el.style.setProperty('--phys-ox', `${ox}px`)
    el.style.setProperty('--phys-oy', `${oy}px`)
  }

  function clearPhysVars(el: HTMLElement) {
    el.style.removeProperty('--phys-ox')
    el.style.removeProperty('--phys-oy')
    el.style.transition = ''
    // Do NOT clear el.style.transform here — the remaining transform still has
    // translate(calc(-50% + var(--phys-ox,0px)), ...) which defaults to
    // translate(-50%,-50%) once the CSS vars are removed, keeping the avatar
    // centered while React re-renders. Clearing it causes a 1-frame snap where
    // left/top position the top-left corner instead of the avatar center.
    el.style.zIndex     = ''
  }

  function startThrowRaf(el: HTMLElement, zenRoom: HTMLElement) {
    if (throwRafRef.current) cancelAnimationFrame(throwRafRef.current)

    const GRAVITY   = 0.48
    const BOUNCE    = 0.54
    const AIR_DRAG  = 0.994
    const FLOOR_PCT = 0.88

    function tick() {
      const p     = phys.current
      const rW    = zenRoom.offsetWidth
      const rH    = zenRoom.offsetHeight
      const floor = rH * FLOOR_PCT
      const halfW = el.offsetWidth  * 0.5
      const halfH = el.offsetHeight * 0.5

      p.vy += GRAVITY
      p.vx *= AIR_DRAG
      p.x  += p.vx
      p.y  += p.vy

      // Wall collisions
      if (p.x - halfW < 0)    { p.x = halfW;        p.vx =  Math.abs(p.vx) * BOUNCE }
      if (p.x + halfW > rW)   { p.x = rW - halfW;   p.vx = -Math.abs(p.vx) * BOUNCE }

      // Floor collision
      if (p.y + halfH >= floor) {
        p.y   = floor - halfH
        p.vy *= -BOUNCE
        p.vx *= 0.88

        if (Math.abs(p.vy) < 1.5 && Math.abs(p.vx) < 0.8) {
          // ── Settled ─────────────────────────────────────────────────────
          throwPhaseRef.current = 'fallen'
          const anchorXpx = (throwAnchor.current.xPct / 100) * rW
          const anchorYpx = (throwAnchor.current.yPct / 100) * rH
          setPhysVars(el, p.x - anchorXpx, p.y - anchorYpx)

          // Fall over
          el.style.transition = 'transform 0.35s ease'
          el.style.transform  = `translate(calc(-50% + var(--phys-ox,0px)), calc(-50% + var(--phys-oy,0px))) rotate(88deg) scale(1.1)`

          // Get up
          setTimeout(() => {
            el.style.transition = 'transform 0.45s ease'
            el.style.transform  = `translate(calc(-50% + var(--phys-ox,0px)), calc(-50% + var(--phys-oy,0px))) rotate(0deg) scale(1.1)`

            setTimeout(() => {
              // Limpiar la transition del get-up para que no ralentice el animateReturn.
              // NO borramos el.style.transform: aún contiene var(--phys-ox/oy)
              // y animateReturn lo sigue usando correctamente para centrar el avatar.
              el.style.transition = ''
              throwPhaseRef.current = 'returning'

              const duration = WALK_DURATION_MS

              // throwAnchor.xPct/yPct may be the break position if the avatar was
              // thrown during a break. Always return to the actual desk slot.
              const deskSlot = DESK_SLOTS[throwAnchor.current.deskIndex]
              const deskXPct = deskSlot.xPct
              const deskYPct = deskSlot.yPct + AVATAR_Y_OFFSET

              const deskXpx = (deskXPct / 100) * zenRoom.offsetWidth
              const deskYpx = (deskYPct / 100) * zenRoom.offsetHeight

              // Offset from desk to where avatar currently rests (fallen pixel pos)
              const startOx = phys.current.x - deskXpx
              const startOy = phys.current.y - deskYpx

              // Snap React's left/top to the desk immediately (no CSS transition).
              // flushSync renders synchronously — after it returns the DOM has
              // left=deskXPct%, top=deskYPct%. Then we suppress the inline
              // transition React just wrote and lock the CSS vars so the element
              // stays visually at the fallen position. Animating vars → 0 then
              // slides the avatar to the desk without any left/top animation.
              flushSync(() => {
                setAvatars(prev => prev.map(a =>
                  a.isUser
                    ? { ...a, xPct: deskXPct, yPct: deskYPct, state: 'walking' as AvatarState }
                    : a,
                ))
              })
              // Override the left/top transition React just painted in
              el.style.transition = 'none'
              el.style.setProperty('--phys-ox', `${startOx}px`)
              el.style.setProperty('--phys-oy', `${startOy}px`)
              void el.offsetWidth // force reflow: "desk left/top + no transition" committed

              // Restore full transition so other CSS properties animate normally,
              // but left/top won't move (React just set them to their final value).
              el.style.transition = ''

              const t0 = performance.now()

              function animateReturn(now: number) {
                const t    = Math.min((now - t0) / duration, 1)
                const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
                el.style.setProperty('--phys-ox', `${startOx * (1 - ease)}px`)
                el.style.setProperty('--phys-oy', `${startOy * (1 - ease)}px`)

                if (t < 1) {
                  throwRafRef.current = requestAnimationFrame(animateReturn)
                } else {
                  clearPhysVars(el)
                  throwPhaseRef.current = 'idle'
                  setAvatars(prev => prev.map(a =>
                    a.isUser ? { ...a, state: 'idle' as AvatarState } : a,
                  ))
                }
              }

              throwRafRef.current = requestAnimationFrame(animateReturn)
            }, 450)
          }, 1100)

          return // stop RAF
        }
      }

      // Update CSS vars: offset = physics pos − React anchor pos
      const anchorXpx = (throwAnchor.current.xPct / 100) * rW
      const anchorYpx = (throwAnchor.current.yPct / 100) * rH
      setPhysVars(el, p.x - anchorXpx, p.y - anchorYpx)
      throwRafRef.current = requestAnimationFrame(tick)
    }

    throwRafRef.current = requestAnimationFrame(tick)
  }

  function handleAvatarPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (throwPhaseRef.current !== 'idle') return

    e.preventDefault()
    e.stopPropagation()

    const el = e.currentTarget as HTMLElement
    // The avatar's offsetParent is the ZenRoom container (position:relative)
    const zenRoom = el.offsetParent as HTMLElement | null
    if (!zenRoom) return
    const zenRoomEl = zenRoom
    throwZenRoomRef.current = zenRoomEl

    const zenRect = zenRoomEl.getBoundingClientRect()
    const elRect  = el.getBoundingClientRect()

    // Avatar center in ZenRoom-local coordinates
    const centerX = elRect.left + elRect.width  / 2 - zenRect.left
    const centerY = elRect.top  + elRect.height / 2 - zenRect.top

    const userAvatar = avatars.find(a => a.isUser)
    if (!userAvatar) return

    throwAnchor.current   = { xPct: userAvatar.xPct, yPct: userAvatar.yPct, deskIndex: userAvatar.deskIndex }
    throwPhaseRef.current = 'drag'
    phys.current          = { x: centerX, y: centerY, vx: 0, vy: 0 }
    throwGrabOff.current  = {
      x: e.clientX - zenRect.left - centerX,
      y: e.clientY - zenRect.top  - centerY,
    }
    throwMhist.current = [{ x: e.clientX, y: e.clientY, t: Date.now() }]
    el.style.zIndex = '50'

    // Notifica al cozy cursor que hay un click sostenido (activa su wiggle/grab state)
    document.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, clientX: e.clientX, clientY: e.clientY,
    }))

    function onMove(ev: PointerEvent) {
      if (throwPhaseRef.current !== 'drag') return

      const zr = zenRoomEl.getBoundingClientRect()
      const nx = ev.clientX - zr.left - throwGrabOff.current.x
      const ny = ev.clientY - zr.top  - throwGrabOff.current.y
      phys.current.x = nx
      phys.current.y = ny

      const anchorXpx = (throwAnchor.current.xPct / 100) * zenRoomEl.offsetWidth
      const anchorYpx = (throwAnchor.current.yPct / 100) * zenRoomEl.offsetHeight
      setPhysVars(el, nx - anchorXpx, ny - anchorYpx)

      // Actualizar el cozy cursor directamente en el mismo tick sincrónico que
      // los CSS vars del avatar. Usar dispatchEvent(new MouseEvent) envía un
      // evento sintético que el browser trata como JS normal (no como input de
      // hardware), lo que añade latencia de compositing visible en fullscreen.
      // La actualización directa del transform garantiza que cursor y avatar
      // se compositen en el mismo frame, sin desfase.
      const cozyCursorEl = document.getElementById('cozy-cursor')
      if (cozyCursorEl) {
        cozyCursorEl.style.transform =
          `translate3d(${(ev.clientX - 3).toFixed(1)}px, ${(ev.clientY - 1).toFixed(1)}px, 0)`
      }

      throwMhist.current.push({ x: ev.clientX, y: ev.clientY, t: Date.now() })
      if (throwMhist.current.length > 6) throwMhist.current.shift()
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      // Libera el estado wiggle/grab del cozy cursor
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      if (throwPhaseRef.current !== 'drag') return
      throwPhaseRef.current = 'fly'

      // Velocity from mouse history
      const hist = throwMhist.current
      if (hist.length >= 2) {
        const last = hist[hist.length - 1]
        const prev = hist[hist.length - 2]
        const dt   = Math.max(last.t - prev.t, 8)
        phys.current.vx = ((last.x - prev.x) / dt) * 16
        phys.current.vy = ((last.y - prev.y) / dt) * 16
      }
      const MAX_V = 30
      phys.current.vx = Math.max(-MAX_V, Math.min(MAX_V, phys.current.vx))
      phys.current.vy = Math.max(-MAX_V, Math.min(MAX_V, phys.current.vy))

      startThrowRaf(el, zenRoomEl)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={pageRef}
      className="relative min-h-screen overflow-x-hidden"
      style={{ backgroundColor: pageBg, transition: 'background-color 2s ease' }}
    >

      {/* Page ambient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 [background-image:radial-gradient(circle_at_30%_30%,rgba(139,168,136,0.06)_0,transparent_40%),radial-gradient(circle_at_70%_65%,rgba(232,165,152,0.06)_0,transparent_40%)]" />

      {/* ── Exit-confirmation modal ───────────────────────────────────────── */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-base font-semibold text-[#2c3e50]">¿Seguro que quieres salir?</p>
            <p className="mb-5 text-sm text-[#7D8A96]">Estás en mitad de una sesión</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-4 py-2.5 text-sm font-semibold text-[#7D8A96] transition-colors hover:border-[#7D8A96]/30 hover:text-[#2c3e50]"
              >
                Quedarme
              </button>
              <button
                type="button"
                onClick={() => router.push('/zen')}
                className="flex-1 rounded-xl bg-[#E8A598] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#d18d80]"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Session-completion / milestone toast ─────────────────────────── */}
      {completionToast && (
        <div className="zen-toast pointer-events-none fixed bottom-28 left-1/2 z-50 rounded-full border border-[#8BA888]/25 bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#6a8a67] shadow-md backdrop-blur-sm">
          {completionToast}
        </div>
      )}

      {/* ── Welcome-back / yesterday toast ───────────────────────────────── */}
      {welcomeToast && (
        <div className="zen-toast pointer-events-none fixed bottom-44 left-1/2 z-50 rounded-full border border-[#7AADCA]/25 bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#5a7a96] shadow-md backdrop-blur-sm">
          {welcomeToast}
        </div>
      )}

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">

        {/* ── Top bar — hidden in fullscreen ── */}
        {!isFullscreen && <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackClick}
            className="flex items-center gap-2 rounded-xl border border-[#EAE4E2] bg-white/80 px-4 py-2.5 text-sm font-medium text-[#7D8A96] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#7D8A96]/30 hover:text-[#2c3e50]"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Volver
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-[#EAE4E2] bg-white/80 px-4 py-2.5 shadow-sm">
            <span className="material-symbols-outlined text-[16px] text-[#8BA888]">spa</span>
            <span className="text-sm font-semibold text-[#7D8A96]">
              {roomName}
              {timerState.phase === 'study' ? (
                <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-normal text-[#6a8a67]">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#8BA888]" />
                  {avatars.length} estudiando ahora
                </span>
              ) : (
                <span className="ml-2 text-xs font-normal text-[#7D8A96]/60">
                  {avatars.length} en sala
                </span>
              )}
            </span>
          </div>
        </div>}

        {/* ── Room scene ── */}
        <div className={isFullscreen ? 'flex h-screen w-full items-center' : 'mb-4'}>
          <ZenRoom
            occupiedDesks={
              avatars.filter((a) => a.deskIndex >= 0).map((a) => a.deskIndex)
            }
          >
            {/* Room name watermark */}
            <div
              aria-hidden="true"
              style={{
                position:      'absolute',
                top:           '5%',
                left:          '2.5%',
                fontSize:      'clamp(6px, 0.85vw, 10px)',
                fontWeight:    600,
                color:         'rgba(44,62,80,0.22)',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                pointerEvents: 'none',
                zIndex:        5,
                userSelect:    'none',
              }}
            >
              {roomName}
            </div>

            {/* Avatar evolution glow */}
            {timerState.phase === 'study' && sessionCount > 0 && (
              <div
                key="user-session-glow"
                aria-hidden="true"
                style={{
                  position:      'absolute',
                  left:          `${DESK_SLOTS[0].xPct}%`,
                  top:           `${DESK_SLOTS[0].yPct + AVATAR_Y_OFFSET}%`,
                  transform:     'translate(-50%, -50%)',
                  width:         52,
                  height:        52,
                  borderRadius:  '50%',
                  background:    `radial-gradient(circle, rgba(232,165,152,${
                                   Math.min(sessionCount, 5) * 0.07 + 0.06
                                 }) 0%, transparent 70%)`,
                  pointerEvents: 'none',
                  zIndex:        15,
                  transition:    'opacity 1.5s ease',
                }}
              />
            )}

            {avatars.map((avatar, i) => (
              <ZenAvatar
                key={avatar.id}
                username={avatar.username}
                color={avatar.color}
                xPct={avatar.xPct}
                yPct={avatar.yPct}
                isUser={avatar.isUser}
                state={avatar.state}
                animDelay={i * 120}
                onPointerDown={avatar.isUser ? handleAvatarPointerDown : undefined}
                forceMood={avatar.isUser ? userMood : undefined}
              />
            ))}

            {/* ── Fullscreen toggle button ── */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              style={{
                position:       'absolute',
                bottom:         '3%',
                right:          '0.8%',
                zIndex:         50,
                background:     'rgba(255,255,255,0.72)',
                border:         '1px solid rgba(0,0,0,0.09)',
                borderRadius:   '7px',
                padding:        '3px 4px',
                cursor:         'pointer',
                backdropFilter: 'blur(6px)',
                lineHeight:     1,
                display:        'flex',
                alignItems:     'center',
                transition:     'background 0.2s',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 'clamp(12px, 1.4vw, 18px)', color: '#7D8A96' }}
              >
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>
          </ZenRoom>
        </div>

        {/* ── Session history + streak + identity row — hidden in fullscreen ── */}
        {!isFullscreen && <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">

            {/* Session dot history */}
            <div className="flex items-center gap-2 rounded-full border border-[#EAE4E2] bg-white/80 px-3.5 py-1.5 shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-[#E8A598]">local_cafe</span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: DOT_CAP }, (_, i) => (
                  <span
                    key={i}
                    className={`inline-block h-2 w-2 rounded-full transition-all duration-500 ${
                      i < Math.min(sessionCount, DOT_CAP) ? 'bg-[#E8A598]' : 'bg-[#EAE4E2]'
                    }`}
                  />
                ))}
                {sessionCount > DOT_CAP && (
                  <span className="ml-0.5 text-xs font-bold text-[#2c3e50]">
                    +{sessionCount - DOT_CAP}
                  </span>
                )}
              </div>
            </div>

            {/* Streak pill */}
            {streakCount >= 1 && (
              <div className="flex items-center gap-1.5 rounded-full border border-[#EAE4E2] bg-white/80 px-3.5 py-1.5 text-xs font-medium text-[#7D8A96] shadow-sm">
                <span>🔥</span>
                <span className="font-bold text-[#2c3e50]">{streakCount}</span>
                <span>{streakCount === 1 ? 'día' : 'días'}</span>
              </div>
            )}
          </div>

          {/* Day-completion message */}
          {sessionCount >= COMPLETION_THRESHOLD && (
            <p className="text-xs font-medium text-[#6a8a67]">
              Día completado — buen trabajo 🌟
            </p>
          )}

          {/* User identity — display name with inline edit */}
          {editingName ? (
            <form onSubmit={handleNameSave} className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={20}
                placeholder={authUsername}
                className="w-32 rounded-lg border border-[#E8A598]/50 bg-white px-2.5 py-1 text-xs font-medium text-[#2c3e50] outline-none focus:border-[#E8A598] focus:ring-1 focus:ring-[#E8A598]/20"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#E8A598] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#d18d80]"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="rounded-lg border border-[#EAE4E2] bg-white px-2.5 py-1 text-xs text-[#7D8A96] hover:border-[#7D8A96]/30"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => { setNameInput(displayName || authUsername); setEditingName(true) }}
              className="flex items-center gap-1.5 rounded-full border border-[#EAE4E2] bg-white/80 px-3.5 py-1.5 text-xs font-medium text-[#7D8A96] shadow-sm transition-colors hover:border-[#7D8A96]/30 hover:text-[#2c3e50]"
            >
              <span>@{effectiveUsername}</span>
              <span className="material-symbols-outlined text-[12px] opacity-50">edit</span>
            </button>
          )}
        </div>}

        {/* ── Timer + Controls + Character editor row — hidden in fullscreen ── */}
        {!isFullscreen && (
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center sm:gap-12">
            <ZenTimer />
            <ZenControls />
            <CharacterEditorPanel
              mood={userMood}
              color={userColor}
              onMoodChange={setUserMood}
              onColorChange={setUserColor}
            />
          </div>
        )}

      </main>

      {/* ── Fullscreen timer — always visible at top ── */}
      {isFullscreen && (
        <div
          style={{
            position:       'fixed',
            top:            0,
            left:           0,
            right:          0,
            zIndex:         100,
            display:        'flex',
            justifyContent: 'center',
            paddingTop:     '18px',
            pointerEvents:  'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <ZenTimer />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Character editor panel ───────────────────────────────────────────────────

const MOOD_LABELS: Record<UserMood, string> = {
  sad:     '😞',
  neutral: '😐',
  happy:   '😊',
}

function CharacterEditorPanel({
  mood,
  color,
  onMoodChange,
  onColorChange,
}: {
  mood:          UserMood
  color:         string
  onMoodChange:  (m: UserMood) => void
  onColorChange: (c: string)   => void
}) {
  const moodIdx  = MOOD_STEPS.indexOf(mood)
  const colorIdx = Math.max(0, USER_COLORS.indexOf(color))

  function prevMood()  { onMoodChange(MOOD_STEPS[(moodIdx  + MOOD_STEPS.length  - 1) % MOOD_STEPS.length])  }
  function nextMood()  { onMoodChange(MOOD_STEPS[(moodIdx  + 1) % MOOD_STEPS.length])  }
  function prevColor() { onColorChange(USER_COLORS[(colorIdx + USER_COLORS.length - 1) % USER_COLORS.length]) }
  function nextColor() { onColorChange(USER_COLORS[(colorIdx + 1) % USER_COLORS.length]) }

  const arrowBtn = (onClick: () => void, dir: 'left' | 'right') => (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#EAE4E2] bg-white text-[#7D8A96] transition-colors hover:border-[#7D8A96]/40 hover:text-[#2c3e50] active:scale-90"
      style={{ fontSize: 12, lineHeight: 1 }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-[#7D8A96]">Tu personaje</p>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-[#EAE4E2] bg-white/80 px-4 py-3 shadow-sm">

        {/* ── Mood row ── */}
        <div className="flex items-center gap-2">
          <span className="w-10 text-[9px] font-bold uppercase tracking-widest text-[#7D8A96]">Ánimo</span>
          {arrowBtn(prevMood, 'left')}
          <span
            className="w-7 text-center text-base leading-none select-none"
            style={{ transition: 'transform 0.15s ease', display: 'inline-block' }}
          >
            {MOOD_LABELS[mood]}
          </span>
          {arrowBtn(nextMood, 'right')}
        </div>

        {/* ── Colour row ── */}
        <div className="flex items-center gap-2">
          <span className="w-10 text-[9px] font-bold uppercase tracking-widest text-[#7D8A96]">Color</span>
          {arrowBtn(prevColor, 'left')}
          <div
            className="h-5 w-7 rounded-md border border-white shadow-sm"
            style={{ backgroundColor: color, transition: 'background-color 0.25s ease' }}
          />
          {arrowBtn(nextColor, 'right')}
        </div>

      </div>
    </div>
  )
}
