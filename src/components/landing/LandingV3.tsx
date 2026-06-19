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
   MIRDaily — Landing variante C: «Atlas vivo»
   Fondo de cuaderno de anatomía cuadriculado, las ilustraciones celulares
   (leucocito, eritrocito, virus) como protagonistas flotando con parallax,
   y un visor de especímenes interactivo que revela su asignatura MIR.
   Misma estética cozy: crema, coral, Lexend, bordes oscuros suaves.
   ──────────────────────────────────────────────────────────────────────── */

const INK = 'rgba(17, 24, 39, 0.85)'
const CREAM = '#FAF7F4'
const CORAL = '#D4978C'
const CORAL_DEEP = '#B87A6F'

/* Patrón de cuaderno cuadriculado tenue */
const NOTEBOOK_BG = {
  backgroundColor: CREAM,
  backgroundImage:
    'linear-gradient(rgba(168,164,160,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(168,164,160,0.10) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
}

/* ─── Especímenes del atlas ────────────────────────────────────────────── */

type Specimen = {
  id: string
  img: string
  label: string
  latin: string
  subject: string
  fact: string
  accent: string
  icon: string
}

const SPECIMENS: Specimen[] = [
  {
    id: 'leucocito',
    img: '/img/1.png',
    label: 'Leucocito',
    latin: 'Neutrófilo polimorfonuclear',
    subject: 'Inmunología · Infecciosas',
    fact: 'Primera línea de defensa: fagocita patógenos en cuestión de minutos. Su recuento orienta el diagnóstico de infecciones bacterianas.',
    accent: '#7C3AED',
    icon: 'shield',
  },
  {
    id: 'eritrocito',
    img: '/img/2.png',
    label: 'Eritrocito',
    latin: 'Glóbulo rojo',
    subject: 'Hematología',
    fact: 'Su forma de disco bicóncavo maximiza el transporte de oxígeno. Las alteraciones de su tamaño definen las anemias micro y macrocíticas.',
    accent: '#D4978C',
    icon: 'water_drop',
  },
  {
    id: 'virus',
    img: '/img/3.png',
    label: 'Virión',
    latin: 'Partícula viral con cápside',
    subject: 'Microbiología',
    fact: 'Sus proteínas de superficie son la diana de antivirales y vacunas. Reconocer su estructura es clave en preguntas de inmunización.',
    accent: '#A78BFA',
    icon: 'coronavirus',
  },
]

/* ─── Visor de especímenes interactivo ─────────────────────────────────── */

function SpecimenViewer() {
  const [activeId, setActiveId] = useState(SPECIMENS[0].id)
  const active = SPECIMENS.find((s) => s.id === activeId)!

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      {/* Lámina del espécimen */}
      <div className="relative flex justify-center">
        <div
          className="relative flex aspect-square w-full max-w-sm items-center justify-center rounded-[2rem] border-2 bg-white"
          style={{ borderColor: INK, boxShadow: '0 24px 60px -30px rgba(184,122,111,0.5)' }}
        >
          {/* Esquinas tipo lámina de atlas */}
          {[
            'left-3 top-3 border-l-2 border-t-2',
            'right-3 top-3 border-r-2 border-t-2',
            'left-3 bottom-3 border-b-2 border-l-2',
            'right-3 bottom-3 border-b-2 border-r-2',
          ].map((pos) => (
            <span
              key={pos}
              className={`absolute h-5 w-5 ${pos}`}
              style={{ borderColor: 'rgba(17,24,39,0.3)' }}
            />
          ))}

          {/* Halo del color del espécimen */}
          <motion.div
            key={`${active.id}-halo`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.22 }}
            transition={{ duration: 0.6 }}
            className="absolute h-56 w-56 rounded-full blur-3xl"
            style={{ background: active.accent }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: 8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Image
                  src={active.img}
                  alt={active.label}
                  width={240}
                  height={240}
                  className="h-52 w-52 object-contain drop-shadow-xl"
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Etiqueta latina manuscrita */}
          <motion.span
            key={`${active.id}-latin`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-6 italic text-[#8C857E]"
            style={{ fontSize: 13 }}
          >
            {active.latin}
          </motion.span>
        </div>
      </div>

      {/* Ficha del espécimen */}
      <div>
        {/* Pestañas de selección */}
        <div className="mb-6 flex flex-wrap gap-2.5">
          {SPECIMENS.map((s) => {
            const isActive = s.id === activeId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-all ${
                  isActive ? 'text-white' : 'bg-white text-[#3A3632] hover:bg-[#FBEFE9]'
                }`}
                style={{
                  borderColor: INK,
                  background: isActive ? s.accent : undefined,
                }}
              >
                <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                {s.label}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ background: active.accent }}
            >
              {active.subject}
            </span>
            <h3 className="mb-3 text-3xl font-black tracking-tight">{active.label}</h3>
            <p className="max-w-md text-base leading-relaxed text-[#5C554F]">{active.fact}</p>

            <div className="mt-6 flex items-center gap-2 text-sm font-bold" style={{ color: CORAL_DEEP }}>
              <span className="material-symbols-outlined text-[18px]">touch_app</span>
              Toca otra célula para explorar
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Ilustración flotante con parallax de ratón ──────────────────────── */

function FloatingSpecimen({
  img,
  alt,
  size,
  top,
  left,
  depth,
  delay,
  rotate,
  mouseX,
  mouseY,
}: {
  img: string
  alt: string
  size: number
  top: string
  left: string
  depth: number
  delay: number
  rotate: number
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
}) {
  const x = useTransform(mouseX, [0, 1], [-depth, depth])
  const y = useTransform(mouseY, [0, 1], [-depth, depth])

  return (
    <motion.div className="pointer-events-none absolute z-0" style={{ top, left, x, y }}>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1, y: [0, -16, 0], rotate: [rotate, rotate + 6, rotate] }}
        transition={{
          opacity: { duration: 0.8, delay },
          scale: { duration: 0.8, delay, type: 'spring', stiffness: 140 },
          y: { duration: 5 + depth * 0.04, repeat: Infinity, ease: 'easeInOut', delay },
          rotate: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay },
        }}
      >
        <Image
          src={img}
          alt={alt}
          width={size}
          height={size}
          className="object-contain drop-shadow-[0_18px_28px_rgba(184,122,111,0.28)]"
          style={{ width: size, height: size }}
        />
      </motion.div>
    </motion.div>
  )
}

/* ─── Contador animado ─────────────────────────────────────────────────── */

function AtlasCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
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

/* ─── Datos de secciones ───────────────────────────────────────────────── */

const SYSTEMS = [
  { icon: 'cardiology', name: 'Sistema cardiovascular', subjects: 'Cardiología · Nefrología', img: '/img/2.png' },
  { icon: 'immunology', name: 'Sistema inmunitario', subjects: 'Inmunología · Infecciosas', img: '/img/1.png' },
  { icon: 'coronavirus', name: 'Agentes infecciosos', subjects: 'Microbiología · Farmacología', img: '/img/3.png' },
]

const PILLARS = [
  {
    icon: 'biotech',
    title: 'Aprende viendo',
    text: 'Cada concepto del MIR ligado a su base anatómica y celular. La teoría deja de ser abstracta.',
  },
  {
    icon: 'quiz',
    title: 'Practica a diario',
    text: 'Preguntas tipo MIR cada día, flashcards inteligentes y un ranking que te compara con miles.',
  },
  {
    icon: 'trending_up',
    title: 'Mide tu avance',
    text: 'Heatmap de constancia, percentiles y evolución por asignatura. Tus datos, tu motivación.',
  },
]

/* ─── Página ───────────────────────────────────────────────────────────── */

export default function LandingV3() {
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
  const heroParallax = useTransform(scrollY, [0, 600], [0, 110])

  return (
    <div className="min-h-screen overflow-x-hidden text-[#171312]" style={NOTEBOOK_BG}>
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
        <Link href="/atlas" className="relative block h-10 w-32" aria-label="MirDaily">
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
      <section
        ref={heroRef}
        onMouseMove={handleHeroMouse}
        className="relative flex min-h-screen items-center overflow-hidden px-6 pb-20 pt-32 md:px-12"
      >
        {/* Células flotando */}
        <FloatingSpecimen img="/img/2.png" alt="" size={92} top="16%" left="6%" depth={34} delay={0.4} rotate={-8} mouseX={smoothX} mouseY={smoothY} />
        <FloatingSpecimen img="/img/1.png" alt="" size={130} top="58%" left="3%" depth={46} delay={0.8} rotate={6} mouseX={smoothX} mouseY={smoothY} />
        <FloatingSpecimen img="/img/3.png" alt="" size={104} top="12%" left="84%" depth={40} delay={0.6} rotate={10} mouseX={smoothX} mouseY={smoothY} />
        <FloatingSpecimen img="/img/2.png" alt="" size={70} top="72%" left="88%" depth={28} delay={1.1} rotate={-12} mouseX={smoothX} mouseY={smoothY} />

        <motion.div
          style={{ y: heroParallax }}
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border-2 bg-white px-4 py-1.5 text-xs font-bold text-[#B87A6F]"
            style={{ borderColor: INK, borderStyle: 'dashed' }}
          >
            <span className="material-symbols-outlined text-[16px]">biotech</span>
            Tu atlas MIR, vivo e interactivo
          </motion.div>

          <h1 className="mb-6 text-4xl font-black leading-[1.08] tracking-tight md:text-6xl">
            {['Estudia el cuerpo', 'humano como', 'nunca lo viste.'].map((line, i) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.25 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                {i === 2 ? (
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
            className="mx-auto mb-9 max-w-xl text-base leading-relaxed text-[#5C554F] md:text-lg"
          >
            MirDaily convierte la preparación del MIR en un atlas interactivo:
            preguntas diarias, flashcards inteligentes y estadísticas, con cada
            concepto anclado a su base anatómica y celular.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.95 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-full border-2 bg-[#D4978C] px-7 py-3.5 text-base font-bold text-white shadow-[0_14px_34px_-10px_rgba(184,122,111,0.7)] transition-colors hover:bg-[#B87A6F]"
                style={{ borderColor: INK }}
              >
                Abre tu atlas gratis
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
              href="#atlas"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-3.5 text-base font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]"
            >
              Explora los especímenes
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </a>
          </motion.div>
        </motion.div>

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

      {/* ─── Visor de especímenes ─── */}
      <section id="atlas" className="relative mx-auto max-w-6xl px-6 py-28 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="mb-14 text-center"
        >
          <span className="mb-4 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
            Visor de especímenes
          </span>
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Cada célula, <span className="text-[#B87A6F]">una asignatura</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[2.5rem] border-2 bg-white/70 p-8 backdrop-blur-sm md:p-12"
          style={{ borderColor: INK }}
        >
          <SpecimenViewer />
        </motion.div>
      </section>

      {/* ─── Sistemas (con ilustraciones) ─── */}
      <section className="mx-auto max-w-6xl px-6 pb-20 md:px-12">
        <div className="grid gap-6 md:grid-cols-3">
          {SYSTEMS.map((system, i) => (
            <motion.div
              key={system.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
              className="group overflow-hidden rounded-3xl border-2 bg-white shadow-soft transition-shadow hover:shadow-[0_24px_50px_-20px_rgba(184,122,111,0.4)]"
              style={{ borderColor: INK }}
            >
              <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-[#FFF6F2] to-[#F3D9CF]">
                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [0, 4, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                  className="transition-transform duration-300 group-hover:scale-110"
                >
                  <Image src={system.img} alt={system.name} width={110} height={110} className="h-24 w-24 object-contain drop-shadow-lg" />
                </motion.div>
              </div>
              <div className="p-6">
                <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3D9CF] text-[#8C5F56]">
                  <span className="material-symbols-outlined text-[20px]">{system.icon}</span>
                </span>
                <h3 className="text-lg font-bold">{system.name}</h3>
                <p className="mt-1 text-sm text-[#5C554F]">{system.subjects}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Pilares ─── */}
      <section className="relative overflow-hidden py-24">
        <div className="mx-auto max-w-5xl px-6 md:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="mb-16 text-center text-3xl font-black tracking-tight md:text-5xl"
          >
            Ver, practicar y <span className="text-[#B87A6F]">medir</span>
          </motion.h2>

          <div className="grid gap-10 md:grid-cols-3">
            {PILLARS.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.65, delay: i * 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <motion.div
                  whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
                  transition={{ duration: 0.5 }}
                  className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border-2 bg-white shadow-soft"
                  style={{ borderColor: INK }}
                >
                  <span className="material-symbols-outlined text-[34px] text-[#B87A6F]">{pillar.icon}</span>
                </motion.div>
                <h3 className="mb-2 text-xl font-bold">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-[#5C554F]">{pillar.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:px-12">
        <div className="grid gap-6 rounded-[2.5rem] border-2 bg-white p-10 text-center shadow-soft sm:grid-cols-3" style={{ borderColor: INK }}>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><AtlasCounter target={365} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Días de preguntas al año</p>
          </div>
          <div className="border-[#E5DED6] sm:border-x-2 sm:px-6">
            <p className="text-5xl font-black text-[#B87A6F]"><AtlasCounter target={6} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Modos de estudio integrados</p>
          </div>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><AtlasCounter target={30} suffix="+" /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Especialidades cubiertas</p>
          </div>
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="relative overflow-hidden px-6 pb-28 pt-8 md:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-[3rem] border-2 bg-gradient-to-br from-[#E2A99E] to-[#B87A6F] px-8 py-16 text-center text-white md:px-16"
          style={{ borderColor: INK }}
        >
          {/* Células decorativas en el CTA */}
          <motion.div
            animate={{ y: [0, -14, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute -left-6 -top-6 opacity-90"
          >
            <Image src="/img/1.png" alt="" width={120} height={120} className="h-28 w-28 object-contain drop-shadow-xl" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 12, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute -bottom-8 -right-4 opacity-90"
          >
            <Image src="/img/3.png" alt="" width={130} height={130} className="h-32 w-32 object-contain drop-shadow-xl" />
          </motion.div>

          <h2 className="relative mb-4 text-3xl font-black leading-tight md:text-5xl">
            Tu atlas del MIR empieza hoy.
          </h2>
          <p className="relative mx-auto mb-9 max-w-xl text-base text-white/85 md:text-lg">
            Únete a la comunidad que estudia con base, no de memoria. Crear tu
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
            © {new Date().getFullYear()} MirDaily — El cuerpo humano, asignatura por asignatura.
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
