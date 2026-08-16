'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const bounce = { type: 'spring', stiffness: 340, damping: 20, mass: 0.9 } as const

// Geometría del dial, en unidades del viewBox (720 x 720).
// El centro coincide a propósito con el centro del viewBox: framer-motion fija
// `transform-origin: 50% 50%` en los elementos SVG e ignora el que le pases, así
// que con `transform-box: view-box` los giros y escalados pivotan justo aquí.
const CX = 360
const CY = 360
const DIAL_R = 250
const RING_R = 205
const RING_C = 2 * Math.PI * RING_R

type Phase = 'focus' | 'break'

/**
 * Un pomodoro comprimido: el bloque de estudio dura el doble que la pausa,
 * igual que el 25/5 real pero en segundos para que quepa en un hover.
 */
const phaseConfig: Record<Phase, { label: string; color: string; ink: string; ms: number }> = {
  focus: { label: 'ESTUDIO', color: '#E8A598', ink: '#d18d80', ms: 3600 },
  break: { label: 'PAUSA', color: '#8BA888', ink: '#6a8a67', ms: 1800 },
}

const ticks = Array.from({ length: 12 }, (_, i) => i)
const cycleDots = [0, 1, 2]
const breaths = [0, 2.1]

const svgOrigin = { transformBox: 'view-box', transformOrigin: '50% 50%' } as const

export function ZenTimerArt({ hovered }: { hovered: boolean }) {
  // El dial solo existe en el DOM mientras se ve: entra con el ratón y se
  // desmonta en cuanto termina de salir volando, así no queda nada corriendo
  // de fondo (ni temporizadores ni animaciones en bucle) con la tarjeta en reposo.
  const [mounted, setMounted] = useState(false)

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute right-6 top-[40%] z-0 hidden w-44 -translate-y-1/2 sm:block"
      initial="rest"
      animate={hovered ? 'hover' : 'rest'}
      variants={{
        rest: { opacity: 0, x: '130%', rotate: 10 },
        hover: { opacity: 1, x: '0%', rotate: -3 },
      }}
      transition={bounce}
      onAnimationStart={() => {
        if (hovered) setMounted(true)
      }}
      onAnimationComplete={() => {
        if (!hovered) setMounted(false)
      }}
    >
      {hovered || mounted ? <ZenDial active={hovered} /> : null}
    </motion.div>
  )
}

/**
 * Al desmontarse con el arte, el estado del temporizador se descarta solo: cada
 * visita arranca limpia en el primer bloque de estudio sin tener que resetear nada.
 */
function ZenDial({ active }: { active: boolean }) {
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<Phase>('focus')
  // Pomodoros completados en la tanda (0-3), se reinicia al cerrar el ciclo.
  const [completed, setCompleted] = useState(0)
  // Cambia en cada campanada para reiniciar la cuenta atrás y el pulso.
  const [chime, setChime] = useState(0)

  useEffect(() => {
    if (!active) return
    const startTimeout = setTimeout(() => setRunning(true), 260)
    return () => {
      clearTimeout(startTimeout)
      setRunning(false)
    }
  }, [active])

  useEffect(() => {
    if (!running) return
    const timeout = setTimeout(() => {
      if (phase === 'focus') setCompleted((d) => (d + 1) % 4)
      setPhase((p) => (p === 'focus' ? 'break' : 'focus'))
      setChime((n) => n + 1)
    }, phaseConfig[phase].ms)
    return () => clearTimeout(timeout)
  }, [running, phase])

  const { label, color, ink, ms } = phaseConfig[phase]
  const seconds = ms / 1000
  const runKey = `${phase}-${chime}`

  return (
    <svg viewBox="0 0 720 720" className="h-auto w-full">
      <defs>
        <filter id="zenDialShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#2c3e50" floodOpacity=".15" />
        </filter>
      </defs>

      {/* Respiración: anillos que se expanden despacio mientras corre el temporizador */}
      {running
        ? breaths.map((delay) => (
            <motion.circle
              key={delay}
              cx={CX}
              cy={CY}
              r={DIAL_R}
              fill="none"
              stroke="#8BA888"
              strokeWidth={6}
              style={svgOrigin}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 1.16], opacity: [0.4, 0] }}
              transition={{ duration: 4.2, delay, repeat: Infinity, ease: 'easeOut' }}
            />
          ))
        : null}

      {/* Campanada: pulso corto al arrancar cada bloque */}
      <motion.circle
        key={`chime-${runKey}`}
        cx={CX}
        cy={CY}
        r={DIAL_R}
        fill="none"
        stroke={color}
        strokeWidth={10}
        style={svgOrigin}
        initial={{ scale: 1, opacity: 0 }}
        animate={running ? { scale: [1, 1.28], opacity: [0.5, 0] } : { opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />

      {/* Tallo y hojas del tomate, detrás del dial */}
      <motion.g
        style={svgOrigin}
        animate={running ? { rotate: [-2.5, 2.5, -2.5] } : { rotate: 0 }}
        // El `repeat` solo mientras corre: si no, el vaivén se reprogramaría
        // para siempre aunque el dial estuviese parado.
        transition={
          running
            ? { duration: 5.4, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.4, ease: 'easeOut' }
        }
      >
        <path d="M360 126V84" fill="none" stroke="#2c3e50" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M356 108C320 74 288 80 278 94c16 28 56 34 78 22z"
          fill="#8BA888"
          stroke="#2c3e50"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M364 108c36-34 68-28 78-14-16 28-56 34-78 22z"
          fill="#A8C0A5"
          stroke="#2c3e50"
          strokeWidth="8"
          strokeLinejoin="round"
        />
      </motion.g>

      {/* Cuerpo del dial */}
      <g filter="url(#zenDialShadow)">
        <circle cx={CX} cy={CY} r={DIAL_R} fill="#fff" stroke="#2c3e50" strokeWidth="10" />
      </g>

      {/* Pista y cuenta atrás */}
      <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="#EFE9E6" strokeWidth="34" />
      <motion.circle
        key={`arc-${runKey}`}
        cx={CX}
        cy={CY}
        r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth="34"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        transform={`rotate(-90 ${CX} ${CY})`}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: running ? RING_C : 0 }}
        transition={{ duration: running ? seconds : 0, ease: 'linear' }}
      />

      {/* Marcas de minutos */}
      {ticks.map((i) => (
        <line
          key={i}
          x1={CX}
          y1={CY - 174}
          x2={CX}
          y2={CY - 156}
          stroke="#D9D2CE"
          strokeWidth={i % 3 === 0 ? 11 : 6}
          strokeLinecap="round"
          transform={`rotate(${i * 30} ${CX} ${CY})`}
        />
      ))}

      {/* Botón que recorre la cuenta atrás, como el de un temporizador de cocina */}
      <motion.g
        key={`knob-${runKey}`}
        style={svgOrigin}
        initial={{ rotate: 360 }}
        animate={{ rotate: running ? 0 : 360 }}
        transition={{ duration: running ? seconds : 0, ease: 'linear' }}
      >
        <circle cx={CX} cy={CY - RING_R} r={24} fill="#fff" stroke="#2c3e50" strokeWidth="9" />
      </motion.g>

      {/* Fase actual */}
      <motion.text
        key={`label-${phase}`}
        x={CX}
        y={CY - 18}
        textAnchor="middle"
        fontSize="56"
        fontWeight="700"
        letterSpacing="6"
        fill={ink}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
      >
        {label}
      </motion.text>

      {/* Pomodoros completados en la tanda */}
      {cycleDots.map((i) => (
        <motion.circle
          key={i}
          cx={CX - 48 + i * 48}
          cy={CY + 56}
          r={14}
          stroke="#2c3e50"
          strokeWidth="5"
          initial={{ fill: '#F2EFED' }}
          animate={{ fill: i < completed ? '#E8A598' : '#F2EFED' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      ))}
    </svg>
  )
}
