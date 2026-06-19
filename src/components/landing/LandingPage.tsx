'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useInView,
  AnimatePresence,
  type MotionValue,
} from 'framer-motion'
import LandingSwitcher from './LandingSwitcher'

/* ────────────────────────────────────────────────────────────────────────
   MIRDaily — Landing page
   Estética cozy de la app: crema #FAF7F4, coral #D4978C, Lexend,
   Material Symbols, bordes oscuros suaves y blobs flotantes.
   ──────────────────────────────────────────────────────────────────────── */

const INK = 'rgba(17, 24, 39, 0.85)'

const SUBJECTS = [
  'Cardiología', 'Neumología', 'Digestivo', 'Neurología', 'Infecciosas',
  'Ginecología', 'Pediatría', 'Psiquiatría', 'Endocrinología', 'Nefrología',
  'Hematología', 'Dermatología', 'Traumatología', 'Oftalmología', 'Urología',
  'Reumatología', 'Inmunología', 'Farmacología',
]

const FLOATING_ICONS = [
  { icon: 'stethoscope', top: '12%', left: '6%', size: 44, depth: 28, delay: 0 },
  { icon: 'ecg_heart', top: '22%', left: '88%', size: 52, depth: 46, delay: 0.6 },
  { icon: 'pill', top: '68%', left: '4%', size: 38, depth: 38, delay: 1.2 },
  { icon: 'neurology', top: '78%', left: '90%', size: 46, depth: 24, delay: 0.3 },
  { icon: 'syringe', top: '8%', left: '70%', size: 34, depth: 52, delay: 0.9 },
  { icon: 'microbiology', top: '60%', left: '94%', size: 36, depth: 34, delay: 1.5 },
  { icon: 'favorite', top: '40%', left: '2%', size: 30, depth: 44, delay: 0.45 },
  { icon: 'science', top: '88%', left: '60%', size: 32, depth: 30, delay: 1.8 },
]

/* ─── Pregunta de demo interactiva ─────────────────────────────────────── */

const DEMO_QUESTION = {
  stem:
    'Varón de 62 años con dolor torácico opresivo de 30 minutos de evolución. ECG: elevación del ST en II, III y aVF. ¿Cuál es el diagnóstico más probable?',
  options: [
    'Pericarditis aguda',
    'IAM de cara inferior',
    'Tromboembolismo pulmonar',
    'Disección aórtica',
  ],
  correctIndex: 1,
}

function DemoQuestionCard() {
  const [selected, setSelected] = useState<number | null>(null)
  const answered = selected !== null
  const isCorrect = selected === DEMO_QUESTION.correctIndex

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="relative w-full max-w-md rounded-3xl border-2 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(184,122,111,0.45)]"
      style={{ borderColor: INK }}
    >
      {answered && isCorrect && (
        <div className="confetti-layer">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className={`confetti-piece confetti-piece-${i + 1}`} />
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <span
          className="rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ background: 'var(--accent-dark, #B87A6F)' }}
        >
          Pregunta tipo MIR
        </span>
        <span className="material-symbols-outlined text-[20px] text-[#B87A6F]">
          ecg_heart
        </span>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-[#3A3632]">
        {DEMO_QUESTION.stem}
      </p>

      <div className="flex flex-col gap-2.5">
        {DEMO_QUESTION.options.map((option, i) => {
          const isThisCorrect = i === DEMO_QUESTION.correctIndex
          const isThisSelected = i === selected

          let stateClasses = 'border-[#E5DED6] bg-[#FAF7F4] hover:border-[#D4978C] hover:bg-[#FBEFE9]'
          if (answered && isThisCorrect) {
            stateClasses = 'border-[#8BA888] bg-[#EAF2E8]'
          } else if (answered && isThisSelected && !isThisCorrect) {
            stateClasses = 'border-[#D4978C] bg-[#FBEAE4]'
          } else if (answered) {
            stateClasses = 'border-[#E5DED6] bg-[#FAF7F4] opacity-55'
          }

          return (
            <motion.button
              key={option}
              type="button"
              disabled={answered}
              onClick={() => setSelected(i)}
              whileTap={answered ? undefined : { scale: 0.97 }}
              animate={
                answered && isThisSelected && !isThisCorrect
                  ? { x: [0, -8, 8, -5, 5, 0] }
                  : {}
              }
              transition={{ duration: 0.45 }}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium text-[#3A3632] transition-colors duration-200 ${stateClasses}`}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold"
                style={{ borderColor: INK }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {option}
              {answered && isThisCorrect && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="material-symbols-outlined ml-auto text-[20px] text-[#5F7E5C]"
                >
                  check_circle
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F4] px-4 py-3">
              <p className="text-sm font-medium text-[#3A3632]">
                {isCorrect
                  ? '¡Correcta! Así se siente cada Daily 🎉'
                  : 'Casi. El ST en II, III y aVF apunta a cara inferior.'}
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="material-symbols-outlined text-[20px] text-[#B87A6F] transition-transform hover:rotate-180"
                style={{ transitionDuration: '400ms' }}
                aria-label="Reintentar"
              >
                refresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Contador animado ─────────────────────────────────────────────────── */

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    const duration = 1400
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
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

/* ─── Micro-visuales de cada feature ───────────────────────────────────── */

function DailyVisual() {
  return (
    <div className="relative flex h-28 items-center justify-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative flex h-16 w-24 items-center justify-center rounded-2xl border-2 bg-gradient-to-br from-[#FFF6F2] to-[#F3D9CF]"
        style={{ borderColor: INK }}
      >
        <span className="material-symbols-outlined nudge-wiggle text-[28px] text-[#B87A6F]">
          mail
        </span>
        <motion.span
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#D4978C] text-xs font-bold text-white shadow-md"
        >
          🔥
        </motion.span>
      </motion.div>
    </div>
  )
}

function StudioVisual() {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setFlipped((f) => !f), 2600)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-28 items-center justify-center" style={{ perspective: 800 }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-20 w-32"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 bg-gradient-to-br from-[#FFF6F2] to-[#F3D9CF] text-xs font-bold text-[#3A3632]"
          style={{ borderColor: INK, backfaceVisibility: 'hidden' }}
        >
          ¿Triada de Cushing?
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 bg-white px-2 text-center text-[10px] font-medium text-[#3A3632]"
          style={{ borderColor: INK, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          HTA + bradicardia + respiración irregular
        </div>
      </motion.div>
    </div>
  )
}

function LibraryVisual() {
  const heights = [44, 58, 38, 64, 50]
  const colors = ['#D4978C', '#8BA888', '#C9B98F', '#A0A8C0', '#E2A99E']
  return (
    <div className="flex h-28 items-end justify-center gap-1.5 pb-3">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: h }}
          viewport={{ once: true }}
          animate={{ y: [0, -3, 0] }}
          transition={{
            height: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
            y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 },
          }}
          className="w-5 rounded-t-md border-2 border-b-0"
          style={{ background: colors[i], borderColor: INK }}
        />
      ))}
    </div>
  )
}

function MedGuessVisual() {
  const word = 'SEPSIS'
  return (
    <div className="flex h-28 items-center justify-center gap-1.5">
      {word.split('').map((letter, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
          className="flex h-10 w-9 items-center justify-center rounded-lg border-2 bg-gradient-to-br from-[#FFF6F2] to-[#F3D9CF] text-sm font-bold text-[#3A3632]"
          style={{ borderColor: INK }}
        >
          {letter}
        </motion.div>
      ))}
    </div>
  )
}

function ZenVisual() {
  return (
    <div className="relative flex h-28 items-center justify-center">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="34" fill="none" stroke="#E5DED6" strokeWidth="6" />
        <motion.circle
          cx="42"
          cy="42"
          r="34"
          fill="none"
          stroke="#D4978C"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 34}
          animate={{ strokeDashoffset: [2 * Math.PI * 34, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <span className="material-symbols-outlined absolute text-[30px] text-[#B87A6F]">
        self_improvement
      </span>
      <span className="zen-zzz zen-zzz-1 left-auto right-2 top-2 text-[#8BA888]">z</span>
      <span className="zen-zzz zen-zzz-2 left-auto right-0 top-0 text-[#8BA888]">z</span>
    </div>
  )
}

function PanelVisual() {
  const intensities = [0, 1, 2, 0, 3, 2, 1, 2, 0, 1, 3, 2, 1, 0, 2, 3, 1, 2, 3, 0, 1]
  const palette = ['#EFEAE4', '#D8E4D5', '#AECBAA', '#8BA888']
  return (
    <div className="flex h-28 items-center justify-center">
      <div className="grid grid-cols-7 gap-1.5">
        {intensities.map((level, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.3 }}
            className="h-4 w-4 rounded-[5px]"
            style={{ background: palette[level] }}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Datos de features ────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: 'today',
    title: 'Daily',
    description:
      'Cada día, un sobre nuevo con preguntas tipo MIR. Respóndelas, compárate con el resto y mantén viva tu racha.',
    visual: <DailyVisual />,
  },
  {
    icon: 'style',
    title: 'Studio',
    description:
      'Crea mazos de flashcards inteligentes con repetición espaciada. Tu Smart Study decide qué repasar y cuándo.',
    visual: <StudioVisual />,
  },
  {
    icon: 'menu_book',
    title: 'Biblioteca',
    description:
      'Recursos organizados por especialidad para repasar la teoría justo cuando la necesitas.',
    visual: <LibraryVisual />,
  },
  {
    icon: 'abc',
    title: 'MedGuess',
    description:
      'El juego de palabras médicas. Adivina el término, aprende vocabulario y desconecta sin dejar de sumar.',
    visual: <MedGuessVisual />,
  },
  {
    icon: 'self_improvement',
    title: 'Sala Zen',
    description:
      'Estudia en compañía con sesiones pomodoro, avatares y un gato que duerme mientras tú rindes.',
    visual: <ZenVisual />,
  },
  {
    icon: 'monitoring',
    title: 'Panel de progreso',
    description:
      'Heatmap de constancia, percentiles, evolución por asignatura. Tus datos, convertidos en motivación.',
    visual: <PanelVisual />,
  },
]

const STEPS = [
  {
    icon: 'mark_email_unread',
    title: 'Abre tu Daily',
    description: 'Cada mañana te espera un sobre con preguntas seleccionadas. Ábrelo y ponte a prueba.',
  },
  {
    icon: 'insights',
    title: 'Compárate y aprende',
    description: 'Descubre tu percentil, revisa las explicaciones y detecta la pregunta más fallada de la semana.',
  },
  {
    icon: 'local_fire_department',
    title: 'Construye tu racha',
    description: 'La constancia gana el MIR. Tu heatmap se enciende día a día y tus mazos se adaptan a ti.',
  },
]

/* ─── Página ───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { scrollYProgress } = useScroll()
  const progressScale = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })

  const heroRef = useRef<HTMLElement>(null)
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)
  const smoothX = useSpring(mouseX, { stiffness: 60, damping: 20 })
  const smoothY = useSpring(mouseY, { stiffness: 60, damping: 20 })

  const handleHeroMouse = (e: React.MouseEvent) => {
    const rect = heroRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  const { scrollY } = useScroll()
  const heroParallax = useTransform(scrollY, [0, 600], [0, 120])
  const heroFade = useTransform(scrollY, [0, 500], [1, 0.25])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#171312]">
      {/* Barra de progreso de scroll */}
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
        style={{ background: 'rgba(250, 247, 244, 0.75)' }}
      >
        {/* El PNG del logo tiene mucho lienzo vacío: se escala dentro de un marco fijo */}
        <Link href="/" className="relative block h-10 w-32" aria-label="MirDaily">
          <Image
            src="/img/logo_mirdaily.png"
            alt="MirDaily"
            fill
            sizes="128px"
            className="scale-[2.9] object-contain"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]"
          >
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
      <section
        ref={heroRef}
        onMouseMove={handleHeroMouse}
        className="relative flex min-h-screen items-center overflow-hidden px-6 pb-20 pt-32 md:px-12"
      >
        {/* Blobs de fondo */}
        <div className="hub-blob pointer-events-none absolute -left-32 top-10 h-[480px] w-[480px] rounded-full bg-[#F3D9CF]" />
        <div className="hub-blob-alt pointer-events-none absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-[#E8E2D5]" />
        <div className="hub-blob pointer-events-none absolute left-1/3 top-2/3 h-[300px] w-[300px] rounded-full bg-[#F0E4E0]" style={{ animationDelay: '3s' }} />

        {/* Iconos médicos flotantes con parallax de ratón */}
        {FLOATING_ICONS.map((item, i) => (
          <FloatingIcon key={i} {...item} mouseX={smoothX} mouseY={smoothY} />
        ))}

        <motion.div
          style={{ y: heroParallax, opacity: heroFade }}
          className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2"
        >
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border-2 bg-white px-4 py-1.5 text-xs font-bold text-[#B87A6F]"
              style={{ borderColor: INK, borderStyle: 'dashed' }}
            >
              <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
              Tu rutina diaria para el MIR
            </motion.div>

            <h1 className="mb-6 text-4xl font-black leading-[1.08] tracking-tight text-[#171312] md:text-6xl">
              {['El MIR se gana', 'un día', 'a la vez.'].map((line, i) => (
                <motion.span
                  key={line}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.25 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="block"
                >
                  {i === 1 ? (
                    <span className="relative inline-block">
                      <span className="relative z-10 text-[#B87A6F]">{line}</span>
                      <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.7, delay: 1, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute bottom-1 left-0 right-0 z-0 h-4 origin-left rounded-md bg-[#F3D9CF]"
                      />
                    </span>
                  ) : (
                    line
                  )}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.8 }}
              className="mb-9 max-w-lg text-base leading-relaxed text-[#5C554F] md:text-lg"
            >
              Preguntas diarias tipo MIR, flashcards inteligentes, sala de estudio
              compartida y estadísticas que te comparan con miles de opositores.
              Todo en un mismo sitio, todos los días.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.95 }}
              className="flex flex-wrap items-center gap-4"
            >
              <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-2 rounded-full border-2 bg-[#D4978C] px-7 py-3.5 text-base font-bold text-white shadow-[0_14px_34px_-10px_rgba(184,122,111,0.7)] transition-colors hover:bg-[#B87A6F]"
                  style={{ borderColor: INK }}
                >
                  Empieza tu primera Daily
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
                href="#features"
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-3.5 text-base font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]"
              >
                Descubre cómo
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </a>
            </motion.div>
          </div>

          {/* Demo interactiva */}
          <div className="flex justify-center lg:justify-end">
            <DemoQuestionCard />
          </div>
        </motion.div>

        {/* Cue de scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <span className="review-scroll-cue" />
          <span className="review-scroll-cue review-scroll-cue-2" />
        </motion.div>
      </section>

      {/* ─── Marquee de especialidades ─── */}
      <section className="relative -rotate-1 border-y-2 bg-[#F3D9CF] py-4" style={{ borderColor: INK }}>
        <div className="flex overflow-hidden">
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1} className="landing-marquee flex shrink-0 items-center gap-8 pr-8">
              {SUBJECTS.map((subject) => (
                <span key={subject} className="flex items-center gap-8 whitespace-nowrap text-sm font-bold uppercase tracking-widest text-[#8C5F56]">
                  {subject}
                  <span className="h-1.5 w-1.5 rounded-full bg-[#B87A6F]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="relative mx-auto max-w-6xl px-6 py-28 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
            Todo tu estudio, vivo
          </span>
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Seis maneras de avanzar.
            <br />
            <span className="text-[#B87A6F]">Una sola rutina.</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8, rotate: i % 2 === 0 ? -0.6 : 0.6 }}
              className="group rounded-3xl border-2 bg-white p-6 shadow-soft transition-shadow hover:shadow-[0_24px_50px_-20px_rgba(184,122,111,0.4)]"
              style={{ borderColor: INK }}
            >
              {feature.visual}
              <div className="mt-2 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3D9CF] text-[#8C5F56]">
                  <span className="material-symbols-outlined text-[20px]">{feature.icon}</span>
                </span>
                <h3 className="text-lg font-bold">{feature.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#5C554F]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Cómo funciona ─── */}
      <section className="relative overflow-hidden bg-[#F5F1EC] py-28">
        <div className="hub-blob pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[#F3D9CF]" />
        <div className="relative mx-auto max-w-5xl px-6 md:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="mb-16 text-center text-3xl font-black tracking-tight md:text-5xl"
          >
            Tan simple como <span className="text-[#B87A6F]">abrir el sobre</span>
          </motion.h2>

          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.65, delay: i * 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="relative text-center"
              >
                <motion.div
                  whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
                  transition={{ duration: 0.5 }}
                  className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border-2 bg-white shadow-soft"
                  style={{ borderColor: INK }}
                >
                  <span className="material-symbols-outlined text-[34px] text-[#B87A6F]">
                    {step.icon}
                  </span>
                </motion.div>
                <span className="mb-2 inline-block rounded-full bg-[#E8E2D5] px-3 py-0.5 text-xs font-bold text-[#5C554F]">
                  Paso {i + 1}
                </span>
                <h3 className="mb-2 text-xl font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#5C554F]">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="mx-auto max-w-5xl px-6 py-24 md:px-12">
        <div className="grid gap-6 rounded-[2.5rem] border-2 bg-white p-10 text-center shadow-soft sm:grid-cols-3" style={{ borderColor: INK }}>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]">
              <AnimatedCounter target={1} />
            </p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">
              Daily nueva cada día del año
            </p>
          </div>
          <div className="border-[#E5DED6] sm:border-x-2 sm:px-6">
            <p className="text-5xl font-black text-[#B87A6F]">
              <AnimatedCounter target={6} />
            </p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">
              Modos de estudio integrados
            </p>
          </div>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]">
              <AnimatedCounter target={30} suffix="+" />
            </p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">
              Especialidades cubiertas
            </p>
          </div>
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="relative overflow-hidden px-6 pb-28 pt-10 md:px-12">
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
            mark_email_unread
          </motion.span>

          <h2 className="relative mb-4 text-3xl font-black leading-tight md:text-5xl">
            Tu sobre de hoy ya está esperando.
          </h2>
          <p className="relative mx-auto mb-9 max-w-xl text-base text-white/85 md:text-lg">
            Únete a la comunidad que prepara el MIR pregunta a pregunta, día a día.
            Crear tu cuenta lleva menos que leer un enunciado.
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
      <footer className="border-t-2 bg-[#F5F1EC] px-6 py-10 md:px-12" style={{ borderColor: 'rgba(17,24,39,0.12)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="relative h-8 w-28">
            <Image
              src="/img/logo_mirdaily.png"
              alt="MirDaily"
              fill
              sizes="112px"
              className="scale-[2.9] object-contain"
            />
          </div>
          <p className="text-xs text-[#8C857E]">
            © {new Date().getFullYear()} MirDaily — El MIR se gana un día a la vez.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/landing-v2" className="text-xs font-bold text-[#B87A6F] hover:underline">
              Ver versión nocturna 🌙
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

/* ─── Icono flotante con parallax ──────────────────────────────────────── */

function FloatingIcon({
  icon,
  top,
  left,
  size,
  depth,
  delay,
  mouseX,
  mouseY,
}: {
  icon: string
  top: string
  left: string
  size: number
  depth: number
  delay: number
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
}) {
  const x = useTransform(mouseX, [0, 1], [-depth, depth])
  const y = useTransform(mouseY, [0, 1], [-depth, depth])

  return (
    <motion.div
      className="pointer-events-none absolute z-0 hidden md:block"
      style={{ top, left, x, y }}
    >
      <motion.span
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.5, scale: 1, rotate: [0, 8, -8, 0] }}
        transition={{
          opacity: { duration: 0.8, delay: delay + 0.8 },
          scale: { duration: 0.8, delay: delay + 0.8, type: 'spring', stiffness: 180 },
          rotate: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay },
        }}
        className="material-symbols-outlined block text-[#C99A8F]"
        style={{ fontSize: size }}
      >
        {icon}
      </motion.span>
    </motion.div>
  )
}
