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
  type MotionValue,
} from 'framer-motion'
import LandingSwitcher from './LandingSwitcher'

/* ────────────────────────────────────────────────────────────────────────
   MIRDaily — Landing variante E: «Bienvenida parallax»
   Basada en la pantalla de inicio de sesión: el logo grande de /brand,
   la lluvia de células (eritrocito, leucocito, virus) y la tarjeta blanca
   con slider de píldora — pero con parallax multicapa real: las células
   viven en 3 profundidades que reaccionan al scroll y al ratón.
   ──────────────────────────────────────────────────────────────────────── */

const BORDER = '#F0EAE6'
const GREY = '#7D8A96'
const INK_TEXT = '#171312'
const CORAL_DEEP = '#B87A6F'

/* ─── Campo de células con parallax (posiciones deterministas) ─────────── */

type Cell = {
  src: string
  size: number
  top: string   // % de la altura total de la página
  left: string
  depth: 0 | 1 | 2 // 0 = lejos (pequeño, borroso, lento) · 2 = cerca (grande, nítido, rápido)
  bob: number   // duración del balanceo
  rotate: number
}

const CELLS: Cell[] = [
  // Profundidad 2 — primer plano
  { src: '/img/2.png', size: 120, top: '4%', left: '6%', depth: 2, bob: 5.2, rotate: -12 },
  { src: '/img/1.png', size: 135, top: '12%', left: '86%', depth: 2, bob: 6.1, rotate: 8 },
  { src: '/img/3.png', size: 110, top: '30%', left: '4%', depth: 2, bob: 5.6, rotate: 14 },
  { src: '/img/2.png', size: 100, top: '46%', left: '90%', depth: 2, bob: 4.8, rotate: -6 },
  { src: '/img/1.png', size: 125, top: '64%', left: '7%', depth: 2, bob: 5.9, rotate: 10 },
  { src: '/img/2.png', size: 105, top: '82%', left: '88%', depth: 2, bob: 5.4, rotate: -15 },
  // Profundidad 1 — media
  { src: '/img/2.png', size: 70, top: '8%', left: '24%', depth: 1, bob: 6.4, rotate: 20 },
  { src: '/img/3.png', size: 64, top: '18%', left: '70%', depth: 1, bob: 7.0, rotate: -10 },
  { src: '/img/2.png', size: 58, top: '38%', left: '16%', depth: 1, bob: 6.8, rotate: 6 },
  { src: '/img/1.png', size: 76, top: '52%', left: '78%', depth: 1, bob: 6.2, rotate: -18 },
  { src: '/img/2.png', size: 66, top: '70%', left: '22%', depth: 1, bob: 7.2, rotate: 12 },
  { src: '/img/3.png', size: 60, top: '88%', left: '72%', depth: 1, bob: 6.6, rotate: -8 },
  // Profundidad 0 — fondo
  { src: '/img/2.png', size: 40, top: '6%', left: '48%', depth: 0, bob: 8.2, rotate: 0 },
  { src: '/img/1.png', size: 46, top: '24%', left: '38%', depth: 0, bob: 8.8, rotate: 16 },
  { src: '/img/2.png', size: 36, top: '42%', left: '58%', depth: 0, bob: 9.0, rotate: -12 },
  { src: '/img/3.png', size: 42, top: '58%', left: '34%', depth: 0, bob: 8.4, rotate: 8 },
  { src: '/img/2.png', size: 38, top: '76%', left: '62%', depth: 0, bob: 9.4, rotate: -20 },
  { src: '/img/1.png', size: 44, top: '92%', left: '44%', depth: 0, bob: 8.6, rotate: 10 },
]

/* Células que caen como en la pantalla de login (deterministas) */
const FALLING = [
  { src: '/img/2.png', size: 46, left: '12%', duration: 38, delay: -6 },
  { src: '/img/2.png', size: 34, left: '32%', duration: 46, delay: -22 },
  { src: '/img/1.png', size: 52, left: '54%', duration: 42, delay: -14 },
  { src: '/img/2.png', size: 30, left: '68%', duration: 50, delay: -33 },
  { src: '/img/3.png', size: 44, left: '82%', duration: 44, delay: -9 },
  { src: '/img/2.png', size: 38, left: '93%', duration: 48, delay: -27 },
]

const DEPTH_STYLE = [
  { blur: 5, opacity: 0.45, scrollFactor: -60, mouseFactor: 8 },
  { blur: 2, opacity: 0.7, scrollFactor: -160, mouseFactor: 20 },
  { blur: 0, opacity: 0.95, scrollFactor: -320, mouseFactor: 38 },
]

function ParallaxCell({
  cell,
  scrollY,
  pageHeight,
  mouseX,
  mouseY,
}: {
  cell: Cell
  scrollY: MotionValue<number>
  pageHeight: number
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
}) {
  const conf = DEPTH_STYLE[cell.depth]
  const yScroll = useTransform(scrollY, [0, Math.max(pageHeight, 1000)], [0, conf.scrollFactor])
  const xMouse = useTransform(mouseX, [0, 1], [-conf.mouseFactor, conf.mouseFactor])
  const yMouse = useTransform(mouseY, [0, 1], [-conf.mouseFactor, conf.mouseFactor])
  const y = useTransform([yScroll, yMouse], ([a, b]) => (a as number) + (b as number))

  return (
    <motion.div
      className="absolute"
      style={{ top: cell.top, left: cell.left, x: xMouse, y, opacity: conf.opacity }}
    >
      <motion.div
        animate={{ y: [0, -14, 0], rotate: [cell.rotate, cell.rotate + 7, cell.rotate] }}
        transition={{ duration: cell.bob, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image
          src={cell.src}
          alt=""
          width={cell.size}
          height={cell.size}
          className="object-contain"
          style={{
            width: cell.size,
            height: cell.size,
            filter: conf.blur ? `blur(${conf.blur}px)` : 'none',
          }}
        />
      </motion.div>
    </motion.div>
  )
}

function ParallaxField() {
  const { scrollY } = useScroll()
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 18 })
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 18 })
  const [pageHeight, setPageHeight] = useState(4000)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth)
      mouseY.set(e.clientY / window.innerHeight)
    }
    window.addEventListener('mousemove', onMove)
    setPageHeight(document.body.scrollHeight)
    return () => window.removeEventListener('mousemove', onMove)
  }, [mouseX, mouseY])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {CELLS.map((cell, i) => (
        <ParallaxCell
          key={i}
          cell={cell}
          scrollY={scrollY}
          pageHeight={pageHeight}
          mouseX={smoothX}
          mouseY={smoothY}
        />
      ))}
      {/* Lluvia suave como en /auth */}
      {FALLING.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`fall-${i}`}
          src={f.src}
          alt=""
          className="falling-item"
          style={{
            width: f.size,
            left: f.left,
            opacity: 0.5,
            animation: `falling ${f.duration}s linear infinite`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Tarjeta homenaje al login: slider de píldora + paneles ───────────── */

function WelcomeCard() {
  const [mode, setMode] = useState<'entrar' | 'crear'>('crear')

  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md rounded-xl border bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
      style={{ borderColor: BORDER }}
    >
      {/* Slider de píldora, como en /auth */}
      <div className="relative mb-6 flex rounded-lg bg-[#FAF7F4] p-1">
        <motion.div
          className="absolute bottom-1 top-1 w-1/2 rounded-md border bg-white"
          style={{ borderColor: BORDER }}
          animate={{ left: mode === 'entrar' ? '4px' : 'calc(50% - 4px)' }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        />
        <button
          type="button"
          onClick={() => setMode('entrar')}
          className={`relative z-10 flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-500 ${
            mode === 'entrar' ? 'text-[#171312]' : 'text-[#7D8A96]'
          }`}
        >
          Ya tengo cuenta
        </button>
        <button
          type="button"
          onClick={() => setMode('crear')}
          className={`relative z-10 flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-500 ${
            mode === 'crear' ? 'text-[#171312]' : 'text-[#7D8A96]'
          }`}
        >
          Soy nuevo
        </button>
      </div>

      {/* Paneles con el morph blur del login real */}
      <div className="relative min-h-[210px]">
        <div
          className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${
            mode === 'entrar'
              ? 'opacity-100 translate-x-0 scale-100 blur-0'
              : 'pointer-events-none opacity-0 -translate-x-3 scale-[0.98] blur-sm'
          }`}
        >
          <p className="text-sm" style={{ color: GREY }}>Bienvenido de nuevo</p>
          <p className="mt-1 text-lg font-semibold" style={{ color: INK_TEXT }}>
            Tu racha te está esperando.
          </p>
          <div className="mt-4 rounded-lg border bg-[#FAF7F4] p-4" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: GREY }}>Daily de hoy</span>
              <span className="flex items-center gap-1 font-bold text-[#B87A6F]">
                <span className="material-symbols-outlined nudge-wiggle text-[18px]">mail</span>
                Sin abrir
              </span>
            </div>
          </div>
          <Link
            href="/auth"
            className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-[#D4978C] text-sm font-bold text-white transition-colors hover:bg-[#B87A6F]"
          >
            Iniciar sesión
          </Link>
        </div>

        <div
          className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${
            mode === 'crear'
              ? 'opacity-100 translate-x-0 scale-100 blur-0'
              : 'pointer-events-none opacity-0 translate-x-3 scale-[0.98] blur-sm'
          }`}
        >
          <p className="text-sm" style={{ color: GREY }}>Crea tu cuenta</p>
          <p className="mt-1 text-lg font-semibold" style={{ color: INK_TEXT }}>
            Tu primera Daily, en un minuto.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {['Preguntas tipo MIR cada día', 'Ranking y percentil reales', 'Flashcards que se adaptan a ti'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm" style={{ color: GREY }}>
                <span className="material-symbols-outlined text-[18px] text-[#8BA888]">check_circle</span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/auth"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#D4978C] text-sm font-bold text-white transition-colors hover:bg-[#B87A6F]"
          >
            Crear cuenta gratis
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Contador animado ─────────────────────────────────────────────────── */

function WelcomeCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
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

/* ─── Features estilo tarjeta de login ─────────────────────────────────── */

const FEATURES = [
  {
    icon: 'today',
    title: 'Daily',
    text: 'Un sobre de preguntas tipo MIR cada día. Racha, ranking y la pregunta más fallada de la semana.',
  },
  {
    icon: 'style',
    title: 'Studio',
    text: 'Mazos de flashcards con repetición espaciada que priorizan justo lo que se te resiste.',
  },
  {
    icon: 'leaderboard',
    title: 'Percentil real',
    text: 'Compárate con miles de opositores y mira tu posición evolucionar día a día.',
  },
  {
    icon: 'self_improvement',
    title: 'Sala Zen',
    text: 'Pomodoros compartidos con avatares para que estudiar no sea estar solo.',
  },
  {
    icon: 'menu_book',
    title: 'Biblioteca',
    text: 'La teoría de cada especialidad, lista para repasar cuando la necesitas.',
  },
  {
    icon: 'monitoring',
    title: 'Panel',
    text: 'Heatmap de constancia y estadísticas por asignatura hasta el día del examen.',
  },
]

/* ─── Página ───────────────────────────────────────────────────────────── */

export default function LandingV5() {
  const { scrollYProgress } = useScroll()
  const progressScale = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })
  const { scrollY } = useScroll()

  // Parallax del propio hero: el logo sube más despacio que el contenido
  const logoY = useTransform(scrollY, [0, 600], [0, 140])
  const cardY = useTransform(scrollY, [0, 600], [0, 40])
  const heroFade = useTransform(scrollY, [0, 520], [1, 0])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#171312]">
      {/* Barra de progreso */}
      <motion.div
        className="fixed left-0 top-0 z-50 h-1 w-full origin-left bg-gradient-to-r from-[#E2A99E] via-[#D4978C] to-[#B87A6F]"
        style={{ scaleX: progressScale }}
      />

      <LandingSwitcher />

      {/* Campo de células con parallax — cubre toda la página */}
      <ParallaxField />

      {/* Nav */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-4 backdrop-blur-md md:px-12"
        style={{ background: 'rgba(250, 247, 244, 0.7)', borderBottom: `1px solid ${BORDER}` }}
      >
        <Link href="/bienvenida" className="relative block h-10 w-32" aria-label="MirDaily">
          <Image src="/img/logo_mirdaily.png" alt="MirDaily" fill sizes="128px" className="scale-[2.9] object-contain" priority />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]">
            Entrar
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
            <Link
              href="/auth"
              className="inline-block whitespace-nowrap rounded-full bg-[#D4978C] px-5 py-2 text-sm font-bold text-white shadow-[0_6px_20px_-6px_rgba(184,122,111,0.6)] transition-colors hover:bg-[#B87A6F]"
            >
              Empezar gratis
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ─── Hero: la pantalla de login convertida en portada ─── */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-16 pt-28">
        <motion.div style={{ y: logoY, opacity: heroFade }} className="flex w-full flex-col items-center px-2 text-center">
          {/* Logo grande como en /auth */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-40 w-full max-w-[34rem] sm:h-56"
          >
            <Image
              src="/brand/logo_mirdaily.png"
              alt="MIRDaily"
              fill
              sizes="544px"
              className="scale-[2.1] object-contain drop-shadow-[0_6px_22px_rgba(0,0,0,0.08)]"
              priority
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="-mt-4 mb-2 text-base sm:-mt-6 md:text-lg"
            style={{ color: GREY }}
          >
            Bienvenido a tu rutina diaria para el MIR
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mb-10 max-w-md text-sm leading-relaxed"
            style={{ color: GREY }}
          >
            Preguntas diarias, flashcards inteligentes, sala de estudio y un
            ranking que te dice dónde estás. Todo empieza al cruzar esta puerta.
          </motion.p>
        </motion.div>

        {/* Tarjeta homenaje al login */}
        <motion.div style={{ y: cardY }} className="relative z-10 flex w-full justify-center">
          <WelcomeCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
        >
          <span className="review-scroll-cue" />
          <span className="review-scroll-cue review-scroll-cue-2" />
        </motion.div>
      </section>

      {/* ─── Features ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Lo que hay al <span className="text-[#B87A6F]">otro lado</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed" style={{ color: GREY }}>
            Seis herramientas conectadas en una sola rutina diaria.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="rounded-xl border bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_16px_40px_-12px_rgba(184,122,111,0.35)]"
              style={{ borderColor: BORDER }}
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FAF7F4]" style={{ border: `1px solid ${BORDER}` }}>
                  <span className="material-symbols-outlined text-[22px] text-[#B87A6F]">{f.icon}</span>
                </span>
                <h3 className="text-lg font-bold">{f.title}</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: GREY }}>{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-12 md:px-12">
        <div
          className="grid gap-6 rounded-xl border bg-white p-10 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)] sm:grid-cols-3"
          style={{ borderColor: BORDER }}
        >
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><WelcomeCounter target={365} /></p>
            <p className="mt-2 text-sm font-medium" style={{ color: GREY }}>Dailys al año, sin excepción</p>
          </div>
          <div className="sm:border-x sm:px-6" style={{ borderColor: BORDER }}>
            <p className="text-5xl font-black text-[#B87A6F]"><WelcomeCounter target={6} /></p>
            <p className="mt-2 text-sm font-medium" style={{ color: GREY }}>Modos de estudio integrados</p>
          </div>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><WelcomeCounter target={30} suffix="+" /></p>
            <p className="mt-2 text-sm font-medium" style={{ color: GREY }}>Especialidades cubiertas</p>
          </div>
        </div>
      </section>

      {/* ─── CTA final: vuelta a la puerta ─── */}
      <section className="relative z-10 px-6 pb-28 pt-16 md:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-xl rounded-xl border bg-white p-10 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
          style={{ borderColor: BORDER }}
        >
          <div className="relative mx-auto mb-2 h-24 w-64">
            <Image
              src="/brand/logo_mirdaily.png"
              alt="MIRDaily"
              fill
              sizes="256px"
              className="scale-[1.9] object-contain"
            />
          </div>
          <p className="mb-1 text-sm" style={{ color: GREY }}>¿Listo para entrar?</p>
          <h2 className="mb-6 text-2xl font-black tracking-tight md:text-3xl">
            Tu sobre de hoy sigue sin abrir.
          </h2>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/auth"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#D4978C] text-sm font-bold text-white transition-colors hover:bg-[#B87A6F]"
            >
              Crear cuenta gratis
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </motion.div>
          <p className="mt-3 text-xs" style={{ color: GREY }}>
            Sin tarjeta · en menos de un minuto
          </p>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t px-6 py-10 md:px-12" style={{ borderColor: BORDER, background: 'rgba(250,247,244,0.85)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="relative h-8 w-28">
            <Image src="/img/logo_mirdaily.png" alt="MirDaily" fill sizes="112px" className="scale-[2.9] object-contain" />
          </div>
          <p className="text-xs" style={{ color: GREY }}>
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
