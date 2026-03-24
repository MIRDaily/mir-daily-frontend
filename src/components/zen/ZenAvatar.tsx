'use client'

import { useEffect, useRef, useState } from 'react'

export type AvatarState = 'idle' | 'walking' | 'sitting' | 'studying' | 'break_walking' | 'chatting' | 'coffee' | 'paper'

// Face emojis shown instead of the head while an avatar is talking
const CHAT_EMOJIS = [
  '😂','😀','😊','😍','😘','😎','😚','🫡','😌','😭',
  '😨','😱','🥵','🥶','🤢','🤮','🤧','🤡','🤫','😈',
  '🙃','🤑','🧐','👹',
] as const

export type ZenAvatarData = {
  id: string
  username: string
  /** Hex colour — head fill */
  color: string
  /** Current position as % of room width */
  xPct: number
  /** Current position as % of room height */
  yPct: number
  /** Index of assigned desk slot */
  deskIndex: number
  state: AvatarState
  isUser: boolean
}

/** User-controlled mood that overrides the internal random sad/happy cycle */
export type UserMood = 'sad' | 'neutral' | 'happy'

type ZenAvatarProps = Pick<ZenAvatarData, 'username' | 'color' | 'xPct' | 'yPct' | 'isUser' | 'state'> & {
  /** Stagger delay in ms — keeps avatars from animating in perfect sync */
  animDelay?: number
  /** Pointer-down handler — enables pointer events + grab cursor on the avatar */
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  /** When set, overrides the internal random mood for this avatar's face */
  forceMood?: UserMood
}

/** Map avatar state → CSS animation class on the inner wrapper */
function stateClass(state: AvatarState): string {
  switch (state) {
    case 'idle':          return 'zen-avatar-idle'
    case 'walking':       return 'zen-avatar-walking'
    case 'studying':      return 'zen-avatar-studying'
    case 'paper':         return 'zen-avatar-studying'
    case 'break_walking': return 'zen-avatar-break'
    case 'chatting':      return 'zen-avatar-idle'
    case 'sitting':       return ''
    case 'coffee':        return 'zen-avatar-idle'
    default:              return ''
  }
}

export default function ZenAvatar({
  username,
  color,
  xPct,
  yPct,
  isUser       = false,
  state        = 'sitting',
  animDelay    = 0,
  onPointerDown,
  forceMood,
}: ZenAvatarProps) {
  // True when the avatar is in a conversation (sofa or standing chat)
  const isInConversation = state === 'chatting' || state === 'sitting'
  // True when legs should be drawn (studying at desk OR sitting on sofa)
  const isSeated         = state === 'sitting' || state === 'studying'
  const label            = `@${username}`

  // ── Random mood — happy or sad, changes slowly over time ────────────────────
  // ~20 % of the time avatars will look sad; the rest of the time they smile.
  const [isSad,    setIsSad]    = useState(false)
  const moodCycleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (moodCycleRef.current) clearTimeout(moodCycleRef.current)

    function cycleMood() {
      // 20 % chance of going sad, 80 % happy; duration 12–35 s per mood
      const nextSad = Math.random() < 0.2
      setIsSad(nextSad)
      const dur = 12000 + Math.random() * 23000
      moodCycleRef.current = setTimeout(cycleMood, dur)
    }

    // Stagger start so avatars don't all flip mood at the same time
    const initial = (animDelay * 17 + 800) % 8000
    moodCycleRef.current = setTimeout(cycleMood, initial)

    return () => { if (moodCycleRef.current) clearTimeout(moodCycleRef.current) }
  }, [animDelay])

  // ── Talk / silent cycle ─────────────────────────────────────────────────────
  // Each avatar independently alternates between talking (animated mouth + emojis)
  // and being silent (neutral face). This prevents everyone talking at the same time.
  const [isTalking,  setIsTalking]  = useState(false)
  const talkCycleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (talkCycleRef.current) clearTimeout(talkCycleRef.current)

    if (!isInConversation) {
      setIsTalking(false)
      return
    }

    function cycle(nowTalking: boolean) {
      setIsTalking(nowTalking)
      // Talking lasts 3–8 s, silence lasts 1.5–4 s
      const dur = nowTalking
        ? 3000 + Math.random() * 5000
        : 1500 + Math.random() * 2500
      talkCycleRef.current = setTimeout(() => cycle(!nowTalking), dur)
    }

    // Stagger each avatar's first cycle so they don't all start talking at once
    const initial = (animDelay * 11 + 300) % 6000
    talkCycleRef.current = setTimeout(() => cycle(true), initial)

    return () => { if (talkCycleRef.current) clearTimeout(talkCycleRef.current) }
  }, [state, animDelay]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Emoji — replaces head sporadically during the whole conversation ─────────
  // Runs whenever isInConversation, independent of the talk/silent cycle.
  // Long gaps make it a rare, noticeable event.
  const [activeEmoji,  setActiveEmoji]  = useState<string | null>(null)
  // displayEmoji lags behind — keeps the last emoji during the fade-out so
  // the transition shows the face disappearing rather than an empty text node.
  const [displayEmoji, setDisplayEmoji] = useState<string>('')
  const emojiShowRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emojiHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (activeEmoji) setDisplayEmoji(activeEmoji)
  }, [activeEmoji])

  useEffect(() => {
    if (emojiShowRef.current) clearTimeout(emojiShowRef.current)
    if (emojiHideRef.current) clearTimeout(emojiHideRef.current)
    setActiveEmoji(null)

    if (!isInConversation) return

    function scheduleNext() {
      // Gap between attempts: 12–28 s — emojis are rare
      const gap = 12000 + Math.random() * 16000
      emojiShowRef.current = setTimeout(() => {
        // 40 % chance of actually showing — skips silently the rest of the time
        if (Math.random() < 0.4) {
          const emoji = CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)]
          setActiveEmoji(emoji)
          // Visible 2.5–4.5 s — long enough to notice
          emojiHideRef.current = setTimeout(() => {
            setActiveEmoji(null)
            scheduleNext()
          }, 2500 + Math.random() * 2000)
        } else {
          scheduleNext()
        }
      }, gap)
    }

    // Stagger first attempt so not all avatars check at the same moment
    const initial = (animDelay * 13 + 1500) % 10000
    emojiShowRef.current = setTimeout(scheduleNext, initial)

    return () => {
      if (emojiShowRef.current) clearTimeout(emojiShowRef.current)
      if (emojiHideRef.current) clearTimeout(emojiHideRef.current)
      setActiveEmoji(null)
    }
  }, [state, animDelay]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    /*
     * Outer div — position only.
     * CSS transitions move the avatar smoothly between coordinates.
     * DO NOT put animation classes here; they conflict with the translate.
     */
    <div
      data-user-avatar={isUser ? 'true' : undefined}
      onPointerDown={onPointerDown}
      style={{
        position:      'absolute',
        left:          `${xPct}%`,
        top:           `${yPct}%`,
        // --phys-ox / --phys-oy are set directly via DOM during throw physics.
        // React never touches these custom props, so re-renders won't reset them.
        transform:     `translate(calc(-50% + var(--phys-ox, 0px)), calc(-50% + var(--phys-oy, 0px))) scale(${isUser ? 1.1 : 1})`,
        width:         '5.5%',
        zIndex:        isUser ? 25 : 20,
        pointerEvents: onPointerDown ? 'auto' : 'none',
        cursor:        onPointerDown ? 'grab' : undefined,
        transition:    'left 3.8s cubic-bezier(0.45, 0, 0.55, 1), top 3.8s cubic-bezier(0.45, 0, 0.55, 1)',
      }}
      aria-label={isUser ? `Tu avatar: ${label}` : label}
    >
      {/* Inner div — CSS keyframe animation only */}
      <div
        className={stateClass(state)}
        style={{
          position:      'relative',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          filter: isUser
            ? `drop-shadow(0 0 5px ${color}99) drop-shadow(0 2px 6px ${color}55)`
            : undefined,
          ['--zen-avatar-delay' as string]: `${animDelay}ms`,
        }}
      >
        {/* ── Username tag ── */}
        <div className="mb-0.5 flex justify-center">
          <span
            className="inline-block rounded-full text-center font-semibold leading-tight"
            style={{
              fontSize:      'clamp(5px, 0.75vw, 9px)',
              padding:       '1px 5px',
              whiteSpace:    'nowrap',
              background:    isUser ? color : 'rgba(255,255,255,0.92)',
              color:         isUser ? '#fff' : '#2c3e50',
              border:        isUser ? `1.5px solid ${color}` : '1px solid rgba(0,0,0,0.10)',
              boxShadow:     '0 1px 4px rgba(0,0,0,0.14)',
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </span>
        </div>

        {/* ── Avatar figure ── */}
        <svg
          viewBox="0 0 28 34"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
          overflow="visible"
        >
          {/* ── HEAD AREA — crossfade between face and emoji ── */}
          {/*
           * Both elements are always in the DOM.
           * CSS opacity transition (0.45 s) creates a smooth dissolve:
           *   activeEmoji set   → face fades out, emoji fades in
           *   activeEmoji null  → emoji fades out (still shows displayEmoji
           *                       so the fade-out isn't empty), face fades in
           */}

          {/* Face group — fades out while emoji is active */}
          <g style={{ opacity: activeEmoji ? 0 : 1, transition: 'opacity 0.45s ease-in-out' }}>
            {/* User halo ring */}
            {isUser && (
              <circle
                cx={14} cy={10} r={10.5}
                fill="none"
                stroke={color}
                strokeWidth={2}
                opacity={0.3}
              />
            )}

            {/* Head */}
            <circle
              cx={14} cy={10} r={8}
              fill={color}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth={1}
            />

            {/* Eyes */}
            <circle cx={11} cy={9}  r={1.2} fill="rgba(0,0,0,0.45)" />
            <circle cx={17} cy={9}  r={1.2} fill="rgba(0,0,0,0.45)" />

            {/* Mouth */}
            {state === 'coffee' ? (
              // Two-sip animation: normal expression at rest, "o" only when cup touches lips.
              // keyTimes sync with the cup translate: 0=rest, 0.13=peak sip1, 0.25=hold,
              // 0.38=lowered, 0.50=pause, 0.63=peak sip2, 0.75=hold, 0.88=lowered, 1=rest.
              <>
                {/* Happy / sad expression — fades out as cup reaches lips */}
                <g>
                  <animate
                    attributeName="opacity"
                    values="1;0;0;1;1;0;0;1;1"
                    keyTimes="0;0.13;0.25;0.38;0.50;0.63;0.75;0.88;1"
                    dur="6s" repeatCount="indefinite"
                  />
                  {(forceMood === 'sad' || (!forceMood && isSad)) ? (
                    <path d="M11,15 Q14,12.5 17,15"
                      stroke="rgba(0,0,0,0.38)" strokeWidth={1.1} fill="none" strokeLinecap="round" />
                  ) : (
                    <path d="M11,13 Q14,15.5 17,13"
                      stroke="rgba(0,0,0,0.38)" strokeWidth={1.1} fill="none" strokeLinecap="round" />
                  )}
                </g>
                {/* "O" mouth — opens only when cup is at lips */}
                <ellipse cx={14} cy={13} rx={2.4} ry={0} fill="rgba(0,0,0,0.45)">
                  <animate
                    attributeName="ry"
                    values="0;2;2;0;0;2;2;0;0"
                    keyTimes="0;0.13;0.25;0.38;0.50;0.63;0.75;0.88;1"
                    dur="6s" repeatCount="indefinite"
                  />
                </ellipse>
              </>
            ) : isTalking && isInConversation ? (
              // Animated talking mouth
              <ellipse cx={14} cy={13.5} rx={2.5} ry={0.1} fill="rgba(0,0,0,0.50)">
                <animate
                  attributeName="ry"
                  values="0.1;1.3;0.1;1.1;0.1;1.2;0.1;1.3;0.1"
                  keyTimes="0;0.08;0.20;0.33;0.44;0.58;0.68;0.80;1"
                  dur="1.8s"
                  repeatCount="indefinite"
                  begin={`${(animDelay * 7 + 50) % 1800}ms`}
                />
              </ellipse>
            ) : (forceMood === 'sad' || (!forceMood && isSad)) ? (
              // Sad frown
              <path
                d="M11,15 Q14,12.5 17,15"
                stroke="rgba(0,0,0,0.38)"
                strokeWidth={1.1}
                fill="none"
                strokeLinecap="round"
              />
            ) : (forceMood === 'happy' || (!forceMood && (isInConversation || state === 'studying'))) ? (
              // Smile
              <path
                d="M11,13 Q14,15.5 17,13"
                stroke="rgba(0,0,0,0.38)"
                strokeWidth={1.1}
                fill="none"
                strokeLinecap="round"
              />
            ) : (
              // Neutral — idle / walking / forceMood === 'neutral'
              <line
                x1={11} y1={13.5} x2={17} y2={13.5}
                stroke="rgba(0,0,0,0.28)"
                strokeWidth={1}
                strokeLinecap="round"
              />
            )}
          </g>

          {/* Emoji — fades in over the face when active.
              displayEmoji holds the last value so fade-out shows content. */}
          <text
            x={14}
            y={19}
            textAnchor="middle"
            fontSize={17}
            style={{
              opacity:         activeEmoji ? 1 : 0,
              transition:      'opacity 0.45s ease-in-out',
              userSelect:      'none',
              dominantBaseline:'auto',
            }}
          >
            {displayEmoji}
          </text>

          {/* ── BODY (always visible) ── */}
          <rect
            x={5} y={19} width={18} height={13}
            rx={5}
            fill={color}
            opacity={0.75}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={1}
          />
          <rect
            x={7} y={20} width={14} height={4}
            rx={3}
            fill="rgba(255,255,255,0.22)"
          />

          {/* ── COFFEE CUP — animated sip toward mouth ── */}
          {state === 'coffee' && (
            <>
              {/* Arm — endpoint follows the cup (two sips, 6 s cycle) */}
              <line
                x1={21} y1={25}
                stroke={color} strokeWidth={2.4} strokeLinecap="round" opacity={0.85}
              >
                <animate attributeName="x2"
                  values="26;17;17;26;26;17;17;26;26"
                  keyTimes="0;0.13;0.25;0.38;0.50;0.63;0.75;0.88;1"
                  dur="6s" repeatCount="indefinite" />
                <animate attributeName="y2"
                  values="21;14;14;21;21;14;14;21;21"
                  keyTimes="0;0.13;0.25;0.38;0.50;0.63;0.75;0.88;1"
                  dur="6s" repeatCount="indefinite" />
              </line>

              {/* Cup group — two slow sips.
                  Peak dx=-13 centres rim over face (x=14). Peak dy=-3 puts rim
                  top at y=13.2, right at the mouth centre. */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,0; -13,-3; -13,-3; 0,0; 0,0; -13,-3; -13,-3; 0,0; 0,0"
                  keyTimes="0;0.13;0.25;0.38;0.50;0.63;0.75;0.88;1"
                  dur="6s"
                  repeatCount="indefinite"
                />
                {/* Cup body */}
                <rect x={24} y={17} width={6} height={7} rx={1.2}
                  fill="#EED9A0" stroke="#B89550" strokeWidth={0.7} />
                {/* Coffee liquid */}
                <rect x={25} y={18.5} width={4} height={2} rx={0.4}
                  fill="rgba(80,40,10,0.45)" />
                {/* Cup rim */}
                <rect x={23.5} y={16.2} width={7} height={1.6} rx={0.7}
                  fill="#D4BC78" stroke="#B89550" strokeWidth={0.5} />
                {/* Handle */}
                <path d="M30,18.5 Q33,19 33,21 Q33,23 30,23.5"
                  stroke="#B89550" strokeWidth={0.9} fill="none" strokeLinecap="round" />
                {/* Steam — fades out as cup lifts */}
                <path d="M26,16 Q25.2,13.5 26.5,11"
                  stroke="#C0C8D0" strokeWidth={0.7} fill="none" strokeLinecap="round" opacity={0.5} />
                <path d="M28.5,16 Q27.8,13.5 29,11"
                  stroke="#C0C8D0" strokeWidth={0.7} fill="none" strokeLinecap="round" opacity={0.35} />
              </g>
            </>
          )}

          {/* ── LEGS — shown when seated (sofa or desk) ── */}
          {isSeated && (
            <>
              <rect x={7}  y={30} width={5} height={4} rx={2} fill={color} opacity={0.6} />
              <rect x={16} y={30} width={5} height={4} rx={2} fill={color} opacity={0.6} />
            </>
          )}

        </svg>
      </div>
    </div>
  )
}
