'use client'

import { useState } from 'react'
import { useZenTimer, formatTime, getTotalDuration } from '@/state/zenTimerStore'
import { primeAudio } from '@/lib/zenAudio'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ≈ 326.73

const PHASE_COLORS = {
  idle:  { ring: '#EAE4E2', track: '#F5F0EC', label: '#7D8A96' },
  study: { ring: '#E8A598', track: '#FAF0EC', label: '#d18d80' },
  break: { ring: '#8BA888', track: '#F0F5F0', label: '#6a8a67' },
} as const

const PHASE_LABELS: Record<string, string> = {
  idle:  'Listo',
  study: 'Estudio',
  break: 'Descanso',
}

const PULSE_THRESHOLD = 10  // seconds

export default function ZenTimer() {
  const { state, start, pause } = useZenTimer()
  const { phase, timeRemaining, cycle, running } = state

  const [hovered, setHovered] = useState(false)

  const total    = getTotalDuration(state)
  const progress = total > 0 ? timeRemaining / total : 1
  const offset   = CIRCUMFERENCE * (1 - progress)
  const colors   = PHASE_COLORS[phase]

  const isPulsing    = running && phase !== 'idle' && timeRemaining <= PULSE_THRESHOLD
  // Sólo interactivo cuando ya se ha iniciado (phase !== 'idle')
  const isInteractive = phase !== 'idle'
  const showOverlay  = isInteractive && hovered

  function handleClick() {
    if (!isInteractive) return
    if (running) {
      pause()
    } else {
      void primeAudio()
      start()
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* SVG ring — pulse wrapper kicks in at last 10 s */}
      <div
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={isInteractive ? (running ? 'Pausar temporizador' : 'Continuar temporizador') : undefined}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
        onMouseEnter={() => isInteractive && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative flex items-center justify-center${isPulsing ? ' zen-ring-pulse' : ''}${isInteractive ? ' cursor-pointer' : ''}`}
        style={{ width: 148, height: 148 }}
      >
        <svg
          viewBox="0 0 120 120"
          width={148}
          height={148}
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={60}
            cy={60}
            r={RADIUS}
            fill="none"
            stroke={colors.track}
            strokeWidth={8}
          />
          {/* Progress ring */}
          <circle
            cx={60}
            cy={60}
            r={RADIUS}
            fill="none"
            stroke={showOverlay ? (running ? colors.ring : colors.ring) : colors.ring}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease',
              opacity: showOverlay ? 0.45 : 1,
            }}
          />
        </svg>

        {/* Centre content — time + label (fades out on hover) */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
          style={{ transition: 'opacity 0.35s ease' }}
          style={{ opacity: showOverlay ? 0 : 1 }}
        >
          <span
            className="text-4xl font-black tracking-tight leading-none"
            style={{
              color:      isPulsing ? '#C4655A' : phase === 'idle' ? '#7D8A96' : colors.label,
              transition: 'color 0.4s ease',
            }}
          >
            {formatTime(timeRemaining)}
          </span>
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: colors.label, opacity: 0.75 }}
          >
            {PHASE_LABELS[phase]}
          </span>
        </div>

        {/* Hover overlay — play / pause icon */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            opacity: showOverlay ? 1 : 0,
            transition: 'opacity 0.35s ease',
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{
              fontSize: 64,
              color: colors.label,
              fontVariationSettings: "'FILL' 1",
              lineHeight: 1,
              fontFamily: "'Material Symbols Rounded'",
            }}
          >
            {running ? 'pause' : 'play_arrow'}
          </span>
        </div>
      </div>

      {/* Cycle indicator */}
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[15px] text-[#7D8A96]/60">refresh</span>
        <span className="text-xs font-medium text-[#7D8A96]/70">
          Ciclo {cycle}
        </span>
      </div>

      {/* Study progress bar — fills left→right as study time elapses */}
      <div
        className="h-0.5 w-32 overflow-hidden rounded-full"
        style={{ background: colors.track }}
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: phase === 'study' ? `${progress * 100}%` : '0%',
            background: colors.ring,
            transition:
              phase === 'study'
                ? 'width 1s linear, background 0.4s ease'
                : 'width 0.4s ease, background 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
