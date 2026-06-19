'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useInView,
} from 'framer-motion'
import LandingSwitcher from './LandingSwitcher'

/* ────────────────────────────────────────────────────────────────────────
   MIRDaily — Landing variante B: «Guardia nocturna»
   Tema oscuro cálido con coral brillante, ECG animado, cuenta atrás real
   hasta la próxima Daily y bento grid con spotlight que sigue al cursor.
   La variante A (clásica, modo día) vive en `/`.
   ──────────────────────────────────────────────────────────────────────── */

const NIGHT_BG = '#211D1A'
const NIGHT_CARD = '#2A2522'
const NIGHT_BORDER = 'rgba(245, 241, 236, 0.14)'
const CREAM = '#F5F1EC'
const CORAL = '#E2A99E'
const CORAL_DEEP = '#D4978C'

/* ─── ECG animado ──────────────────────────────────────────────────────── */

function EcgLine() {
  // Dos complejos QRS sobre línea base, en un tramo que se repite
  const segment =
    'l90,0 l14,-7 l10,0 l8,-46 l10,92 l8,-50 l12,11 l14,0 l130,0'
  const path = `M-300,0 ${segment} ${segment} ${segment} ${segment} ${segment} ${segment}`

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-50">
      <svg
        viewBox="0 0 1800 200"
        className="h-[200px] w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <g transform="translate(0,100)">
          <path d={path} fill="none" stroke="rgba(226,169,158,0.12)" strokeWidth="2" />
          <motion.path
            d={path}
            fill="none"
            stroke={CORAL}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="280 2400"
            animate={{ strokeDashoffset: [2680, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            style={{ filter: 'drop-shadow(0 0 8px rgba(226,169,158,0.9))' }}
          />
        </g>
      </svg>
    </div>
  )
}

/* ─── Cuenta atrás hasta la próxima Daily (medianoche) ─────────────────── */

function DailyCountdown() {
  const [parts, setParts] = useState<[string, string, string]>(['--', '--', '--'])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const diff = Math.max(midnight.getTime() - now.getTime(), 0)
      const h = String(Math.floor(diff / 3_600_000)).padStart(2, '0')
      const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0')
      const s = String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0')
      setParts([h, m, s])
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const labels = ['horas', 'min', 'seg']

  return (
    <div className="flex items-center gap-3">
      {parts.map((value, i) => (
        <div key={labels[i]} className="flex items-center gap-3">
          <div className="text-center">
            <div
              className="min-w-[64px] rounded-2xl border px-3 py-2.5 font-black tabular-nums"
              style={{
                borderColor: NIGHT_BORDER,
                background: NIGHT_CARD,
                color: CORAL,
                fontSize: 28,
                boxShadow: '0 0 24px rgba(226,169,158,0.12) inset',
              }}
            >
              {value}
            </div>
            <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#8C857E]">
              {labels[i]}
            </span>
          </div>
          {i < 2 && (
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="-mt-5 text-2xl font-black"
              style={{ color: CORAL }}
            >
              :
            </motion.span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Tarjeta con spotlight que sigue al cursor ────────────────────────── */

function SpotlightCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouse = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouse}
      className={`group relative overflow-hidden rounded-3xl border p-6 transition-transform duration-300 hover:-translate-y-1 ${className}`}
      style={{ background: NIGHT_CARD, borderColor: NIGHT_BORDER }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(226,169,158,0.16), transparent 70%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

/* ─── Mini-visuales del bento ──────────────────────────────────────────── */

function NightHeatmap() {
  const intensities = [1, 0, 2, 3, 1, 2, 0, 3, 2, 1, 3, 0, 1, 2, 3, 2, 0, 1, 2, 3, 1, 2, 3, 1, 0, 2, 1, 3]
  const palette = ['#332D28', '#5C4038', '#9C6A5E', CORAL]
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {intensities.map((level, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.4 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.03, duration: 0.3 }}
          whileHover={{ scale: 1.35 }}
          className="h-3.5 w-3.5 rounded"
          style={{
            background: palette[level],
            boxShadow: level === 3 ? `0 0 10px rgba(226,169,158,0.5)` : 'none',
          }}
        />
      ))}
    </div>
  )
}

function CardStack() {
  return (
    <div className="relative h-24">
      {[2, 1, 0].map((depth) => (
        <motion.div
          key={depth}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: depth * 0.35 }}
          className="absolute left-1/2 top-1/2 flex h-16 w-28 items-center justify-center rounded-xl border text-[10px] font-bold"
          style={{
            borderColor: NIGHT_BORDER,
            background: depth === 0 ? 'linear-gradient(145deg, #3A332E, #2E2823)' : NIGHT_CARD,
            color: depth === 0 ? CORAL : 'transparent',
            transform: `translate(calc(-50% + ${depth * 10 - 14}px), calc(-50% + ${depth * -8}px)) rotate(${depth * 4}deg)`,
            zIndex: 3 - depth,
          }}
        >
          {depth === 0 && 'Repaso en 2 días'}
        </motion.div>
      ))}
    </div>
  )
}

function PulseRing() {
  return (
    <div className="relative flex h-24 items-center justify-center">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: i * 1.1 }}
          className="absolute h-14 w-14 rounded-full border-2"
          style={{ borderColor: CORAL }}
        />
      ))}
      <span
        className="material-symbols-outlined relative text-[34px]"
        style={{ color: CORAL }}
      >
        self_improvement
      </span>
    </div>
  )
}

/* ─── Contador grande animado ──────────────────────────────────────────── */

function GlowCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
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
    <span ref={ref} style={{ textShadow: '0 0 30px rgba(226,169,158,0.45)' }}>
      {value}
      {suffix}
    </span>
  )
}

/* ─── Línea temporal «Un día en MirDaily» ──────────────────────────────── */

const TIMELINE = [
  {
    time: '08:00',
    icon: 'mark_email_unread',
    title: 'Llega tu sobre',
    text: 'La Daily aparece en tu bandeja. Preguntas nuevas, racha en juego.',
  },
  {
    time: '14:30',
    icon: 'style',
    title: 'Sesión de Studio',
    text: 'Tus mazos saben qué toca repasar hoy. Smart Study hace el resto.',
  },
  {
    time: '19:00',
    icon: 'self_improvement',
    title: 'Sala Zen',
    text: 'Pomodoros en compañía. Tu avatar estudia, el gato duerme.',
  },
  {
    time: '23:59',
    icon: 'leaderboard',
    title: 'Cierra el ranking',
    text: 'Percentil del día, heatmap encendido y mañana, más.',
  },
]

function TimelineSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 75%', 'end 60%'],
  })
  const lineScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24 })

  return (
    <section className="relative mx-auto max-w-3xl px-6 py-28">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7 }}
        className="mb-20 text-center text-3xl font-black tracking-tight md:text-5xl"
        style={{ color: CREAM }}
      >
        Un día dentro de{' '}
        <span style={{ color: CORAL, textShadow: '0 0 28px rgba(226,169,158,0.4)' }}>
          MirDaily
        </span>
      </motion.h2>

      <div ref={ref} className="relative">
        {/* Raíl + línea que se dibuja con el scroll */}
        <div
          className="absolute bottom-2 left-[27px] top-2 w-0.5 md:left-1/2 md:-translate-x-1/2"
          style={{ background: NIGHT_BORDER }}
        />
        <motion.div
          className="absolute bottom-2 left-[27px] top-2 w-0.5 origin-top md:left-1/2 md:-translate-x-1/2"
          style={{
            scaleY: lineScale,
            background: `linear-gradient(${CORAL}, ${CORAL_DEEP})`,
            boxShadow: '0 0 12px rgba(226,169,158,0.6)',
          }}
        />

        <div className="flex flex-col gap-16">
          {TIMELINE.map((item, i) => {
            const left = i % 2 === 0
            return (
              <motion.div
                key={item.time}
                initial={{ opacity: 0, x: left ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={`relative flex items-center gap-6 pl-16 md:w-1/2 md:pl-0 ${
                  left
                    ? 'md:mr-auto md:flex-row-reverse md:pr-14 md:text-right'
                    : 'md:ml-auto md:pl-14'
                }`}
              >
                {/* Nodo */}
                <div
                  className={`absolute left-[13px] flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                    left ? 'md:left-auto md:-right-[14px]' : 'md:-left-[14px]'
                  }`}
                  style={{ borderColor: CORAL, background: NIGHT_BG }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                    className="h-2 w-2 rounded-full"
                    style={{ background: CORAL }}
                  />
                </div>

                <div>
                  <span
                    className="mb-1 inline-block rounded-full border px-3 py-0.5 text-xs font-black tabular-nums"
                    style={{ borderColor: NIGHT_BORDER, color: CORAL }}
                  >
                    {item.time}
                  </span>
                  <h3 className="mb-1 flex items-center gap-2 text-lg font-bold" style={{ color: CREAM }}>
                    <span
                      className={`material-symbols-outlined text-[20px] ${left ? 'md:order-2' : ''}`}
                      style={{ color: CORAL }}
                    >
                      {item.icon}
                    </span>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#A89F96]">{item.text}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── Página ───────────────────────────────────────────────────────────── */

const MARQUEE_WORDS = ['Daily', 'Studio', 'Biblioteca', 'MedGuess', 'Sala Zen', 'Panel', 'Racha', 'Percentil']

export default function LandingV2() {
  const { scrollYProgress } = useScroll()
  const progressScale = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })
  const { scrollY } = useScroll()
  const heroGlow = useTransform(scrollY, [0, 500], [1, 0.15])

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: NIGHT_BG, color: CREAM }}>
      {/* Barra de progreso */}
      <motion.div
        className="fixed left-0 top-0 z-50 h-1 w-full origin-left"
        style={{
          scaleX: progressScale,
          background: `linear-gradient(90deg, ${CORAL}, ${CORAL_DEEP})`,
          boxShadow: '0 0 14px rgba(226,169,158,0.8)',
        }}
      />

      <LandingSwitcher />

      {/* Nav */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-4 backdrop-blur-md md:px-12"
        style={{ background: 'rgba(33, 29, 26, 0.7)', borderBottom: `1px solid ${NIGHT_BORDER}` }}
      >
        <Link href="/landing-v2" className="whitespace-nowrap text-xl font-black tracking-tight" aria-label="MirDaily">
          Mir<span style={{ color: CORAL }}>Daily</span>
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="ml-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: CORAL, boxShadow: '0 0 10px rgba(226,169,158,0.9)' }}
          />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="rounded-full px-4 py-2 text-sm font-medium text-[#C9C0B7] transition-colors hover:text-white"
          >
            Entrar
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
            <Link
              href="/auth"
              className="inline-block whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold transition-shadow hover:shadow-[0_0_28px_rgba(226,169,158,0.5)]"
              style={{ background: CORAL, color: NIGHT_BG }}
            >
              Empezar gratis
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ─── Hero ─── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pb-24 pt-32">
        {/* Resplandores */}
        <motion.div style={{ opacity: heroGlow }} className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(226,169,158,0.14), transparent 65%)' }}
          />
          <div
            className="absolute -left-40 bottom-0 h-[380px] w-[380px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(140,160,140,0.08), transparent 65%)' }}
          />
        </motion.div>

        <EcgLine />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ borderColor: NIGHT_BORDER, color: CORAL }}
          >
            <motion.span
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: CORAL, boxShadow: '0 0 8px rgba(226,169,158,1)' }}
            />
            En directo · la comunidad está estudiando
          </motion.div>

          <h1 className="mb-7 text-4xl font-black leading-[1.05] tracking-tight md:text-7xl">
            {'Mientras otros duermen,'.split(' ').map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="mr-[0.25em] inline-block"
              >
                {word}
              </motion.span>
            ))}
            <br />
            <motion.span
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
              style={{ color: CORAL, textShadow: '0 0 40px rgba(226,169,158,0.5)' }}
            >
              tu racha sigue viva.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1 }}
            className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-[#A89F96] md:text-lg"
          >
            La plataforma que convierte la preparación del MIR en un hábito diario:
            preguntas, flashcards inteligentes, sala de estudio y ranking en tiempo real.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.15 }}
            className="mb-12 flex flex-col items-center gap-3"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#8C857E]">
              Próxima Daily en
            </span>
            <DailyCountdown />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold transition-shadow hover:shadow-[0_0_44px_rgba(226,169,158,0.55)]"
                style={{ background: CORAL, color: NIGHT_BG, boxShadow: '0 0 30px rgba(226,169,158,0.35)' }}
              >
                Reservar mi sobre de mañana
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </Link>
            </motion.div>
            <a
              href="#bento"
              className="rounded-full border px-6 py-4 text-base font-medium text-[#C9C0B7] transition-colors hover:text-white"
              style={{ borderColor: NIGHT_BORDER }}
            >
              Ver qué hay dentro
            </a>
          </motion.div>
        </div>
      </section>

      {/* ─── Marquee ─── */}
      <section className="border-y py-4" style={{ borderColor: NIGHT_BORDER }}>
        <div className="flex overflow-hidden">
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1} className="landing-marquee flex shrink-0 items-center gap-10 pr-10">
              {MARQUEE_WORDS.map((word) => (
                <span
                  key={word}
                  className="flex items-center gap-10 whitespace-nowrap text-sm font-black uppercase tracking-[0.3em]"
                  style={{ color: 'rgba(245,241,236,0.4)' }}
                >
                  {word}
                  <span className="material-symbols-outlined text-[14px]" style={{ color: CORAL }}>
                    ecg_heart
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Bento grid ─── */}
      <section id="bento" className="mx-auto max-w-6xl px-6 py-28 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Tu kit de guardia,{' '}
            <span style={{ color: CORAL, textShadow: '0 0 28px rgba(226,169,158,0.4)' }}>
              completo
            </span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="grid auto-rows-[minmax(150px,auto)] gap-4 md:grid-cols-4"
        >
          {/* Daily — pieza grande */}
          <SpotlightCard className="md:col-span-2 md:row-span-2">
            <span className="material-symbols-outlined mb-3 text-[32px]" style={{ color: CORAL }}>
              mark_email_unread
            </span>
            <h3 className="mb-2 text-2xl font-black">Daily</h3>
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-[#A89F96]">
              Cada medianoche se libera un sobre nuevo de preguntas tipo MIR.
              Lo abres, respondes y descubres tu posición frente a toda la comunidad.
            </p>
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: NIGHT_BORDER, background: 'rgba(33,29,26,0.6)' }}
            >
              <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#8C857E]">
                Tu constancia
                <span className="flex items-center gap-1" style={{ color: CORAL }}>
                  <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                  Racha activa
                </span>
              </div>
              <NightHeatmap />
            </div>
          </SpotlightCard>

          {/* Studio */}
          <SpotlightCard className="md:col-span-2">
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <span className="material-symbols-outlined mb-2 text-[26px]" style={{ color: CORAL }}>
                  style
                </span>
                <h3 className="mb-1 text-xl font-black">Studio</h3>
                <p className="text-sm leading-relaxed text-[#A89F96]">
                  Mazos con repetición espaciada que deciden por ti qué repasar.
                </p>
              </div>
              <div className="hidden w-36 sm:block">
                <CardStack />
              </div>
            </div>
          </SpotlightCard>

          {/* Sala Zen */}
          <SpotlightCard>
            <PulseRing />
            <h3 className="mb-1 text-lg font-black">Sala Zen</h3>
            <p className="text-xs leading-relaxed text-[#A89F96]">
              Pomodoros compartidos para no estudiar en soledad.
            </p>
          </SpotlightCard>

          {/* MedGuess */}
          <SpotlightCard>
            <div className="mb-3 flex gap-1">
              {'MIR'.split('').map((letter, i) => (
                <motion.span
                  key={i}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.15 }}
                  className="flex h-9 w-8 items-center justify-center rounded-lg border text-sm font-black"
                  style={{ borderColor: NIGHT_BORDER, color: CORAL, background: 'rgba(33,29,26,0.6)' }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>
            <h3 className="mb-1 text-lg font-black">MedGuess</h3>
            <p className="text-xs leading-relaxed text-[#A89F96]">
              El juego de palabras médicas para desconectar sumando.
            </p>
          </SpotlightCard>

          {/* Biblioteca */}
          <SpotlightCard className="md:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="material-symbols-outlined mb-2 text-[26px]" style={{ color: CORAL }}>
                  menu_book
                </span>
                <h3 className="mb-1 text-xl font-black">Biblioteca + Panel</h3>
                <p className="text-sm leading-relaxed text-[#A89F96]">
                  Teoría por especialidad y estadísticas con percentiles, evolución y heatmap.
                </p>
              </div>
              <div className="hidden shrink-0 items-end gap-1 sm:flex">
                {[34, 50, 28, 58, 42, 64].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: h }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    className="w-3 rounded-t"
                    style={{ background: i === 5 ? CORAL : 'rgba(226,169,158,0.3)' }}
                  />
                ))}
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      </section>

      {/* ─── Timeline ─── */}
      <TimelineSection />

      {/* ─── Stats ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-28">
        <div
          className="grid gap-8 rounded-[2.5rem] border p-10 text-center sm:grid-cols-3"
          style={{ borderColor: NIGHT_BORDER, background: NIGHT_CARD }}
        >
          {[
            { target: 365, suffix: '', label: 'Dailys al año, sin excepción' },
            { target: 6, suffix: '', label: 'Modos de estudio integrados' },
            { target: 30, suffix: '+', label: 'Especialidades cubiertas' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-5xl font-black tabular-nums" style={{ color: CORAL }}>
                <GlowCounter target={stat.target} suffix={stat.suffix} />
              </p>
              <p className="mt-2 text-sm font-medium text-[#A89F96]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="relative overflow-hidden px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-3xl rounded-[3rem] border px-8 py-16 text-center"
          style={{
            borderColor: 'rgba(226,169,158,0.35)',
            background: `radial-gradient(ellipse at top, rgba(226,169,158,0.12), transparent 60%), ${NIGHT_CARD}`,
          }}
        >
          {/* Partículas flotantes */}
          {[
            { left: '12%', top: '20%', d: 0 },
            { left: '85%', top: '30%', d: 1.1 },
            { left: '20%', top: '75%', d: 0.5 },
            { left: '75%', top: '70%', d: 1.6 },
            { left: '50%', top: '12%', d: 0.8 },
          ].map((particle, i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -14, 0], opacity: [0.25, 0.8, 0.25] }}
              transition={{ duration: 3.4, repeat: Infinity, delay: particle.d, ease: 'easeInOut' }}
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
              style={{ left: particle.left, top: particle.top, background: CORAL, boxShadow: '0 0 8px rgba(226,169,158,0.9)' }}
            />
          ))}

          <h2 className="mb-4 text-3xl font-black leading-tight md:text-5xl">
            La medianoche no espera.
          </h2>
          <p className="mx-auto mb-9 max-w-md text-base text-[#A89F96]">
            Crea tu cuenta gratis y que el sobre de mañana ya lleve tu nombre.
          </p>
          <motion.div whileHover={{ scale: 1.06, y: -3 }} whileTap={{ scale: 0.96 }} className="inline-block">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold transition-shadow hover:shadow-[0_0_50px_rgba(226,169,158,0.6)]"
              style={{ background: CORAL, color: NIGHT_BG, boxShadow: '0 0 34px rgba(226,169,158,0.4)' }}
            >
              Crear cuenta gratis
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t px-6 py-10" style={{ borderColor: NIGHT_BORDER }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm font-black">
            Mir<span style={{ color: CORAL }}>Daily</span>
          </span>
          <p className="text-xs text-[#8C857E]">
            © {new Date().getFullYear()} MirDaily — El MIR se gana un día a la vez.
          </p>
          <Link href="/" className="text-xs font-bold hover:underline" style={{ color: CORAL }}>
            Ver versión clásica ☀
          </Link>
        </div>
      </footer>
    </div>
  )
}
