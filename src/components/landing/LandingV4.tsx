'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useInView,
} from 'framer-motion'
import LandingSwitcher from './LandingSwitcher'

/* ────────────────────────────────────────────────────────────────────────
   MIRDaily — Landing variante D: «Recta final»
   Centrada en el examen MIR y en MIRDaily como producto:
   cuenta atrás real al día del examen y un simulador de percentil
   interactivo (aciertos → nota neta, percentil y puesto sobre la campana).
   Estética cozy de la marca: crema, coral, Lexend, bordes oscuros suaves.
   ──────────────────────────────────────────────────────────────────────── */

const INK = 'rgba(17, 24, 39, 0.85)'
const CORAL = '#D4978C'
const CORAL_DEEP = '#B87A6F'

/* Fecha estimada del próximo examen MIR (último sábado de enero). */
const NEXT_MIR_DATE = new Date('2027-01-30T09:00:00')

/* ─── Cuenta atrás al día del MIR ──────────────────────────────────────── */

function useCountdown(target: Date) {
  const [parts, setParts] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(target.getTime() - Date.now(), 0)
      setParts({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  return parts
}

function MirCountdown() {
  const { days, hours, minutes, seconds } = useCountdown(NEXT_MIR_DATE)
  const blocks = [
    { value: days, label: 'días' },
    { value: hours, label: 'horas' },
    { value: minutes, label: 'min' },
    { value: seconds, label: 'seg' },
  ]

  return (
    <div className="flex items-end gap-2.5">
      {blocks.map((b, i) => (
        <div key={b.label} className="flex items-end gap-2.5">
          <div className="text-center">
            <div
              className="min-w-[58px] rounded-2xl border-2 bg-white px-2.5 py-2 text-center font-black tabular-nums text-[#B87A6F]"
              style={{ borderColor: INK, fontSize: i === 0 ? 30 : 24 }}
            >
              {String(b.value).padStart(2, '0')}
            </div>
            <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#8C857E]">
              {b.label}
            </span>
          </div>
          {i < blocks.length - 1 && (
            <span className="-mt-5 text-xl font-black text-[#D4978C]">:</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Simulador de percentil (pieza interactiva estrella) ──────────────── */

const TOTAL_QUESTIONS = 210

function buildBellPath(width: number, height: number, mean: number, sigma: number) {
  const points: string[] = []
  const steps = 80
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width
    const z = (x - mean) / sigma
    const y = height - Math.exp(-0.5 * z * z) * (height * 0.9)
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points
}

function PercentileSimulator() {
  const [correct, setCorrect] = useState(150)

  // Netas MIR: aciertos − (fallos / 3). Asumimos resto contestado.
  const net = useMemo(() => {
    const wrong = TOTAL_QUESTIONS - correct
    return Math.round((correct - wrong / 3) * 10) / 10
  }, [correct])

  // Percentil estimado con sigmoide centrada en una neta media realista.
  const percentile = useMemo(() => {
    const p = 100 / (1 + Math.exp(-(net - 105) / 24))
    return Math.min(99, Math.max(1, Math.round(p)))
  }, [net])

  // Puesto estimado sobre ~13.500 plazas/opositores activos.
  const position = useMemo(
    () => Math.max(1, Math.round(((100 - percentile) / 100) * 13500)),
    [percentile]
  )

  const W = 320
  const H = 120
  const bellPoints = useMemo(() => buildBellPath(W, H, W / 2, W / 6.5), [])
  const userX = (percentile / 100) * W

  let verdict = 'Vas tomando ritmo'
  if (percentile >= 90) verdict = '¡Plaza de sobra!'
  else if (percentile >= 75) verdict = 'Muy buen puesto'
  else if (percentile >= 55) verdict = 'En zona de plaza'

  return (
    <div
      className="grid items-center gap-10 rounded-[2.5rem] border-2 bg-white p-8 shadow-soft md:p-12 lg:grid-cols-2"
      style={{ borderColor: INK }}
    >
      {/* Controles + cifras */}
      <div>
        <span className="mb-3 inline-block rounded-full bg-[#F3D9CF] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
          Simulador en vivo
        </span>
        <h3 className="mb-2 text-2xl font-black tracking-tight">
          ¿Dónde quedarías hoy?
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-[#5C554F]">
          Mueve tus aciertos sobre las {TOTAL_QUESTIONS} preguntas y mira cómo
          cambian tu nota neta y tu puesto. Así de claro lo verás cada día en MirDaily.
        </p>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm font-bold">
            <span className="text-[#3A3632]">Respuestas correctas</span>
            <span className="tabular-nums text-[#B87A6F]">
              {correct}/{TOTAL_QUESTIONS}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={TOTAL_QUESTIONS}
            value={correct}
            onChange={(e) => setCorrect(Number(e.target.value))}
            className="mir-range w-full"
            aria-label="Respuestas correctas"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Nota neta', value: net.toString() },
            { label: 'Percentil', value: `${percentile}` },
            { label: 'Puesto aprox.', value: `#${position.toLocaleString('es-ES')}` },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={false}
              className="rounded-2xl border-2 bg-[#FAF7F4] p-3 text-center"
              style={{ borderColor: 'rgba(17,24,39,0.12)' }}
            >
              <motion.p
                key={stat.value}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="text-xl font-black tabular-nums text-[#B87A6F]"
              >
                {stat.value}
              </motion.p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8C857E]">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Campana de Gauss con marcador del usuario */}
      <div>
        <div
          className="relative overflow-hidden rounded-3xl border-2 p-5 distribution-dot-bg"
          style={{ borderColor: 'rgba(17,24,39,0.12)' }}
        >
          <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
            <defs>
              <clipPath id="mir-bell-clip">
                <rect x="0" y="0" width={userX} height={H} />
              </clipPath>
              <linearGradient id="mir-bell-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CORAL} stopOpacity="0.55" />
                <stop offset="100%" stopColor={CORAL} stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* Curva base */}
            <polyline
              points={bellPoints.join(' ')}
              fill="none"
              stroke="rgba(17,24,39,0.25)"
              strokeWidth="2"
            />
            {/* Área acumulada hasta el usuario */}
            <polygon
              points={`0,${H} ${bellPoints.join(' ')} ${W},${H}`}
              fill="url(#mir-bell-fill)"
              clipPath="url(#mir-bell-clip)"
            />

            {/* Línea marcador del usuario */}
            <motion.line
              animate={{ x1: userX, x2: userX }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              y1="6"
              y2={H}
              stroke={CORAL_DEEP}
              strokeWidth="2.5"
              strokeDasharray="4 4"
            />
            <motion.circle
              animate={{ cx: userX }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              cy="6"
              r="5"
              fill={CORAL_DEEP}
            />

            {/* Eje */}
            <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(17,24,39,0.2)" strokeWidth="1" />
            <text x="6" y={H + 18} fontSize="9" fill="#8C857E">peor</text>
            <text x={W - 28} y={H + 18} fontSize="9" fill="#8C857E">mejor</text>
          </svg>

          <motion.div
            key={verdict}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#F3D9CF] px-4 py-2 text-sm font-bold text-[#8C5F56]"
          >
            <span className="material-symbols-outlined text-[18px]">
              {percentile >= 75 ? 'celebration' : 'trending_up'}
            </span>
            {verdict} · estás por delante del {percentile}% de opositores
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ─── Contador animado ─────────────────────────────────────────────────── */

function StatCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 1400, 1)
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target])

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  )
}

/* ─── Tarjeta de módulo del producto ───────────────────────────────────── */

const MODULES = [
  {
    icon: 'today',
    title: 'Daily',
    text: 'Tu bloque de preguntas tipo MIR cada día, con ranking y racha.',
  },
  {
    icon: 'style',
    title: 'Studio',
    text: 'Flashcards con repetición espaciada que priorizan lo que fallas.',
  },
  {
    icon: 'leaderboard',
    title: 'Ranking',
    text: 'Tu percentil frente a miles de opositores, actualizado a diario.',
  },
  {
    icon: 'menu_book',
    title: 'Biblioteca',
    text: 'Teoría por asignatura para repasar justo lo que necesitas.',
  },
  {
    icon: 'self_improvement',
    title: 'Sala Zen',
    text: 'Pomodoros en compañía para sostener el estudio sin quemarte.',
  },
  {
    icon: 'monitoring',
    title: 'Panel',
    text: 'Heatmap de constancia y evolución por asignatura hasta el día D.',
  },
]

/* ─── Mini-tarjeta flotante del hero (mockup de producto) ──────────────── */

function FloatingChip({
  icon,
  label,
  value,
  top,
  left,
  delay,
  rotate,
}: {
  icon: string
  label: string
  value: string
  top: string
  left: string
  delay: number
  rotate: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, rotate }}
      animate={{ opacity: 1, scale: 1, y: [0, -14, 0], rotate }}
      transition={{
        opacity: { duration: 0.7, delay },
        scale: { duration: 0.7, delay, type: 'spring', stiffness: 160 },
        y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay },
      }}
      className="pointer-events-none absolute z-0 hidden items-center gap-2.5 rounded-2xl border-2 bg-white px-3.5 py-2.5 shadow-[0_16px_30px_-16px_rgba(184,122,111,0.5)] md:flex"
      style={{ top, left, borderColor: INK }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3D9CF] text-[#8C5F56]">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div>
        <p className="text-sm font-black leading-none text-[#171312]">{value}</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8C857E]">
          {label}
        </p>
      </div>
    </motion.div>
  )
}

/* ─── Página ───────────────────────────────────────────────────────────── */

export default function LandingV4() {
  const { scrollYProgress } = useScroll()
  const progressScale = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })
  const { scrollY } = useScroll()
  const heroParallax = useTransform(scrollY, [0, 600], [0, 90])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#171312]">
      {/* Estilos del slider del simulador */}
      <style>{`
        .mir-range {
          -webkit-appearance: none;
          appearance: none;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, #D4978C, #E2A99E);
          border: 2px solid ${INK};
          outline: none;
        }
        .mir-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid #B87A6F;
          box-shadow: 0 4px 12px -2px rgba(184,122,111,0.6);
          cursor: grab;
          transition: transform 0.15s ease;
        }
        .mir-range::-webkit-slider-thumb:active { transform: scale(1.15); cursor: grabbing; }
        .mir-range::-moz-range-thumb {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid #B87A6F;
          box-shadow: 0 4px 12px -2px rgba(184,122,111,0.6);
          cursor: grab;
        }
      `}</style>

      {/* Barra de progreso */}
      <motion.div
        className="fixed left-0 top-0 z-50 h-1 w-full origin-left bg-gradient-to-r from-[#E2A99E] via-[#D4978C] to-[#B87A6F]"
        style={{ scaleX: progressScale }}
      />

      <LandingSwitcher />

      {/* Nav */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-4 backdrop-blur-md md:px-12"
        style={{ background: 'rgba(250, 247, 244, 0.78)', borderBottom: '1px solid rgba(17,24,39,0.08)' }}
      >
        <Link href="/recta-final" className="relative block h-10 w-32" aria-label="MirDaily">
          <Image src="/img/logo_mirdaily.png" alt="MirDaily" fill sizes="128px" className="scale-[2.9] object-contain" priority />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]">
            Entrar
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
            <Link
              href="/auth"
              className="inline-block whitespace-nowrap rounded-full border-2 bg-[#D4978C] px-5 py-2 text-sm font-bold text-white shadow-[0_6px_20px_-6px_rgba(184,122,111,0.6)] transition-colors hover:bg-[#B87A6F]"
              style={{ borderColor: INK }}
            >
              Empezar gratis
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ─── Hero ─── */}
      <section className="relative flex min-h-screen items-center overflow-hidden px-6 pb-20 pt-32 md:px-12">
        <div className="hub-blob pointer-events-none absolute -left-32 top-10 h-[460px] w-[460px] rounded-full bg-[#F3D9CF]" />
        <div className="hub-blob-alt pointer-events-none absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-[#E8E2D5]" />

        {/* Mini-tarjetas de producto flotando */}
        <FloatingChip icon="local_fire_department" label="Racha" value="48 días" top="20%" left="5%" delay={0.6} rotate={-5} />
        <FloatingChip icon="leaderboard" label="Tu percentil" value="Top 8%" top="30%" left="82%" delay={0.9} rotate={5} />
        <FloatingChip icon="check_circle" label="Daily de hoy" value="9/10" top="70%" left="7%" delay={1.2} rotate={4} />
        <FloatingChip icon="bolt" label="Repasos hoy" value="24" top="74%" left="80%" delay={1.5} rotate={-6} />

        <motion.div style={{ y: heroParallax }} className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border-2 bg-white px-4 py-1.5 text-xs font-bold text-[#B87A6F]"
            style={{ borderColor: INK, borderStyle: 'dashed' }}
          >
            <span className="material-symbols-outlined text-[16px]">event</span>
            Cuenta atrás al próximo MIR
          </motion.div>

          <h1 className="mb-7 text-4xl font-black leading-[1.08] tracking-tight md:text-6xl">
            {['Cada día cuenta', 'para tu'].map((line, i) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.25 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                {line}
              </motion.span>
            ))}
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="block"
            >
              <span className="relative inline-block">
                <span className="relative z-10 text-[#B87A6F]">número de plaza.</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-1 left-0 right-0 z-0 h-4 origin-left rounded-md bg-[#F3D9CF]"
                />
              </span>
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
            className="mx-auto mb-9 max-w-xl text-base leading-relaxed text-[#5C554F] md:text-lg"
          >
            MirDaily convierte la preparación del MIR en una rutina diaria que sí
            sostienes: preguntas, flashcards inteligentes y un ranking real que te
            dice, cada día, cómo de cerca estás de tu plaza.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1 }}
            className="mb-10 flex flex-col items-center gap-3"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#8C857E]">
              Falta para el examen
            </span>
            <MirCountdown />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.15 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-full border-2 bg-[#D4978C] px-7 py-3.5 text-base font-bold text-white shadow-[0_14px_34px_-10px_rgba(184,122,111,0.7)] transition-colors hover:bg-[#B87A6F]"
                style={{ borderColor: INK }}
              >
                Empieza hoy tu rutina
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="material-symbols-outlined text-[20px]"
                >
                  arrow_forward
                </motion.span>
              </Link>
            </motion.div>
            <a
              href="#simulador"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-3.5 text-base font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]"
            >
              Probar el simulador
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Simulador de percentil ─── */}
      <section id="simulador" className="relative mx-auto max-w-6xl px-6 py-28 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            El MIR no es la nota. <br className="hidden sm:block" />
            Es tu <span className="text-[#B87A6F]">percentil</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#5C554F]">
            Por eso MirDaily te muestra siempre dónde estás respecto al resto.
            Pruébalo: ajusta tus aciertos y mira qué puesto te daría.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <PercentileSimulator />
        </motion.div>
      </section>

      {/* ─── Módulos del producto ─── */}
      <section className="relative overflow-hidden bg-[#F5F1EC] py-28">
        <div className="hub-blob pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[#F3D9CF]" />
        <div className="relative mx-auto max-w-6xl px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="mb-14 text-center"
          >
            <span className="mb-4 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
              Todo en una rutina
            </span>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              Lo que necesitas hasta el <span className="text-[#B87A6F]">día D</span>
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.12, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -8, rotate: i % 2 === 0 ? -0.6 : 0.6 }}
                className="rounded-3xl border-2 bg-white p-6 shadow-soft transition-shadow hover:shadow-[0_24px_50px_-20px_rgba(184,122,111,0.4)]"
                style={{ borderColor: INK }}
              >
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3D9CF] text-[#8C5F56]">
                  <span className="material-symbols-outlined text-[26px]">{m.icon}</span>
                </span>
                <h3 className="mb-2 text-lg font-bold">{m.title}</h3>
                <p className="text-sm leading-relaxed text-[#5C554F]">{m.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="mx-auto max-w-5xl px-6 py-24 md:px-12">
        <div className="grid gap-6 rounded-[2.5rem] border-2 bg-white p-10 text-center shadow-soft sm:grid-cols-3" style={{ borderColor: INK }}>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><StatCounter target={210} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Preguntas como en el examen real</p>
          </div>
          <div className="border-[#E5DED6] sm:border-x-2 sm:px-6">
            <p className="text-5xl font-black text-[#B87A6F]"><StatCounter target={365} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Días de Daily sin fallar uno</p>
          </div>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><StatCounter target={30} suffix="+" /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Especialidades cubiertas</p>
          </div>
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="relative overflow-hidden px-6 pb-28 pt-4 md:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-[3rem] border-2 bg-gradient-to-br from-[#E2A99E] to-[#B87A6F] px-8 py-16 text-center text-white md:px-16"
          style={{ borderColor: INK }}
        >
          <div className="hub-blob pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/20" />
          <div className="hub-blob-alt pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-white/15" />

          <motion.span
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
            className="material-symbols-outlined relative mb-5 inline-block text-[56px]"
          >
            event_available
          </motion.span>

          <h2 className="relative mb-4 text-3xl font-black leading-tight md:text-5xl">
            El día del MIR ya tiene fecha. <br className="hidden sm:block" />
            Tu rutina, también.
          </h2>
          <p className="relative mx-auto mb-9 max-w-xl text-base text-white/85 md:text-lg">
            Empieza hoy y deja que cada Daily te acerque a tu plaza. Crear tu
            cuenta lleva menos que leer un enunciado.
          </p>
          <motion.div whileHover={{ scale: 1.06, y: -3 }} whileTap={{ scale: 0.96 }} className="relative inline-block">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-full border-2 bg-white px-8 py-4 text-base font-bold text-[#B87A6F] shadow-[0_18px_40px_-12px_rgba(58,54,50,0.5)]"
              style={{ borderColor: INK }}
            >
              Crear cuenta gratis
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t-2 px-6 py-10 md:px-12" style={{ borderColor: 'rgba(17,24,39,0.12)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="relative h-8 w-28">
            <Image src="/img/logo_mirdaily.png" alt="MirDaily" fill sizes="112px" className="scale-[2.9] object-contain" />
          </div>
          <p className="text-xs text-[#8C857E]">
            © {new Date().getFullYear()} MirDaily — El MIR se gana un día a la vez.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/landings" className="text-xs font-bold text-[#B87A6F] hover:underline">
              Otras landings
            </Link>
            <Link href="/auth" className="text-xs font-bold text-[#B87A6F] hover:underline">
              Entrar →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
