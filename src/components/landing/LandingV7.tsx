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
   MIRDaily — Landing variante G: «Cozy»
   Construida con los recursos cozy generados con IA (public/img/ai/cozy-*),
   fieles a la estética real de la app: crema, coral, contornos redondeados,
   mascota "pebble". El coral es primario; el petróleo, un acento mínimo.
   Incluye una sección de microscopía realista (medicina de verdad) y el
   vídeo hero cozy como loop de fondo con la imagen de póster.
   ──────────────────────────────────────────────────────────────────────── */

const INK = 'rgba(17, 24, 39, 0.85)'
const CORAL = '#D4978C'
const CORAL_DEEP = '#B87A6F'

const NEXT_MIR_DATE = new Date('2027-01-30T09:00:00')

/* ─── Cuenta atrás compacta ────────────────────────────────────────────── */

function MiniCountdown() {
  const [d, setD] = useState(0)
  useEffect(() => {
    const tick = () => setD(Math.max(0, Math.ceil((NEXT_MIR_DATE.getTime() - Date.now()) / 86_400_000)))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-2 bg-white/80 px-4 py-1.5 text-xs font-bold text-[#B87A6F] backdrop-blur-sm" style={{ borderColor: INK, borderStyle: 'dashed' }}>
      <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
      Faltan {d} días para el MIR
    </span>
  )
}

/* ─── Ilustración flotante con parallax de ratón ───────────────────────── */

function FloatingArt({
  src, size, top, left, depth, delay, mouseX, mouseY,
}: {
  src: string; size: number; top: string; left: string; depth: number; delay: number
  mouseX: MotionValue<number>; mouseY: MotionValue<number>
}) {
  const x = useTransform(mouseX, [0, 1], [-depth, depth])
  const y = useTransform(mouseY, [0, 1], [-depth, depth])
  return (
    <motion.div className="pointer-events-none absolute z-0 hidden lg:block" style={{ top, left, x, y }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, y: [0, -14, 0] }}
        transition={{
          opacity: { duration: 0.9, delay },
          scale: { duration: 0.9, delay, type: 'spring', stiffness: 140 },
          y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay },
        }}
      >
        <Image src={src} alt="" width={size} height={size} className="object-contain drop-shadow-[0_16px_28px_rgba(184,122,111,0.28)]" style={{ width: size, height: size }} />
      </motion.div>
    </motion.div>
  )
}

/* ─── Contador animado ─────────────────────────────────────────────────── */

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1400, 1)
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target])
  return <span ref={ref}>{value}{suffix}</span>
}

/* ─── Datos ────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    img: '/img/ai/cozy-daily.png',
    tag: 'La Daily',
    title: 'Tu sobre de preguntas, cada día',
    text: 'Cada mañana se abre un sobre nuevo con preguntas tipo MIR. Respóndelas, mantén tu racha y descubre la más fallada de la semana.',
  },
  {
    img: '/img/ai/cozy-ranking.png',
    tag: 'Ranking diario',
    title: 'Compite con miles de opositores',
    text: 'Tu posición y tu percentil, actualizados a diario. El MIR no es la nota: es dónde quedas frente al resto.',
  },
  {
    img: '/img/ai/cozy-studio.png',
    tag: 'Studio',
    title: 'Flashcards que se adaptan a ti',
    text: 'Mazos con repetición espaciada que priorizan justo lo que fallas. Smart Study decide qué repasar y cuándo.',
  },
  {
    img: '/img/ai/cozy-zen.png',
    tag: 'Sala Zen',
    title: 'Estudia acompañado, sin quemarte',
    text: 'Pomodoros compartidos, tu avatar estudiando y un gato que duerme mientras tú rindes. Constancia sin agobio.',
  },
]

const MICRO = [
  { img: '/img/ai/micro-sangre.png', tag: 'Hematología', text: 'Frotis de sangre periférica: hematíes con palidez central y neutrófilos polilobulados.' },
  { img: '/img/ai/micro-gram.png', tag: 'Microbiología', text: 'Tinción de Gram: cocos grampositivos en racimo y bacilos gramnegativos.' },
  { img: '/img/ai/micro-histologia.png', tag: 'Histología', text: 'Tejido nervioso teñido con H&E: neuronas piramidales entre la neuroglía.' },
]

/* ─── Página ───────────────────────────────────────────────────────────── */

export default function LandingV7() {
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
  const heroMediaParallax = useTransform(scrollY, [0, 700], [0, 70])
  const heroTextParallax = useTransform(scrollY, [0, 700], [0, 150])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#171312]">
      <motion.div className="fixed left-0 top-0 z-50 h-1 w-full origin-left bg-gradient-to-r from-[#E2A99E] via-[#D4978C] to-[#B87A6F]" style={{ scaleX: progressScale }} />
      <LandingSwitcher />

      {/* Nav */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-4 backdrop-blur-md md:px-12"
        style={{ background: 'rgba(250, 247, 244, 0.78)', borderBottom: '1px solid rgba(17,24,39,0.08)' }}
      >
        <Link href="/cozy" className="relative block h-10 w-32" aria-label="MirDaily">
          <Image src="/img/logo_mirdaily.png" alt="MirDaily" fill sizes="128px" className="scale-[2.9] object-contain" priority />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]">Entrar</Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
            <Link href="/auth" className="inline-block whitespace-nowrap rounded-full border-2 bg-[#D4978C] px-5 py-2 text-sm font-bold text-white shadow-[0_6px_20px_-6px_rgba(184,122,111,0.6)] transition-colors hover:bg-[#B87A6F]" style={{ borderColor: INK }}>
              Empezar gratis
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ─── Hero con vídeo cozy de fondo ─── */}
      <section ref={heroRef} onMouseMove={handleHeroMouse} className="relative flex min-h-screen items-center overflow-hidden px-6 pt-28 md:px-12">
        {/* Medio hero: vídeo cozy (poster = imagen), ocupa la derecha; texto sobre el respiro izquierdo */}
        <motion.div style={{ y: heroMediaParallax }} className="pointer-events-none absolute inset-0 z-0">
          <video
            className="h-full w-full object-cover object-right"
            autoPlay
            muted
            loop
            playsInline
            poster="/img/ai/cozy-hero.png"
          >
            <source src="/img/ai/hero-loop.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #FAF7F4 0%, rgba(250,247,244,0.92) 32%, rgba(250,247,244,0.35) 52%, rgba(250,247,244,0) 66%)' }} />
        </motion.div>

        <motion.div style={{ y: heroTextParallax }} className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mb-6">
              <MiniCountdown />
            </motion.div>

            <h1 className="mb-6 text-4xl font-black leading-[1.06] tracking-tight md:text-6xl">
              {['El MIR se gana', 'un día'].map((line, i) => (
                <motion.span key={line} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 + i * 0.15, ease: [0.22, 1, 0.36, 1] }} className="block">
                  {i === 1 ? (
                    <span className="relative inline-block">
                      <span className="relative z-10 text-[#B87A6F]">un día</span>
                      <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 1, ease: [0.22, 1, 0.36, 1] }} className="absolute bottom-1 left-0 right-0 z-0 h-4 origin-left rounded-md bg-[#F3D9CF]" />
                    </span>
                  ) : line}
                </motion.span>
              ))}
              <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }} className="block">a la vez.</motion.span>
            </h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.85 }} className="mb-8 max-w-md text-base leading-relaxed text-[#5C554F] md:text-lg">
              Una pregunta diaria, flashcards que se adaptan a ti y un ranking real
              entre opositores. La rutina cálida que sí sostienes hasta el día del examen.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1 }} className="flex flex-wrap items-center gap-4">
              <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
                <Link href="/auth" className="inline-flex items-center gap-2 rounded-full border-2 bg-[#D4978C] px-7 py-3.5 text-base font-bold text-white shadow-[0_14px_34px_-10px_rgba(184,122,111,0.7)] transition-colors hover:bg-[#B87A6F]" style={{ borderColor: INK }}>
                  Abre tu primera Daily
                  <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} className="material-symbols-outlined text-[20px]">arrow_forward</motion.span>
                </Link>
              </motion.div>
              <a href="#features" className="inline-flex items-center gap-1.5 rounded-full border-2 bg-white/70 px-5 py-3.5 text-base font-medium text-[#3A3632] backdrop-blur-sm transition-colors hover:bg-white" style={{ borderColor: 'rgba(17,24,39,0.15)' }}>
                Ver qué incluye
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </a>
            </motion.div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <span className="review-scroll-cue" />
          <span className="review-scroll-cue review-scroll-cue-2" />
        </motion.div>
      </section>

      {/* ─── Features cozy ─── */}
      <section id="features" className="relative overflow-hidden bg-[#F5F1EC] py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-12">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }} className="mb-16 text-center">
            <span className="mb-4 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">Todo tu estudio, vivo</span>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">Cuatro formas de <span className="text-[#B87A6F]">no estudiar solo</span></h2>
          </motion.div>

          <div className="flex flex-col gap-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}
              >
                <motion.div whileHover={{ scale: 1.02, rotate: i % 2 === 0 ? -0.8 : 0.8 }} className="overflow-hidden rounded-3xl border-2 bg-white shadow-soft [direction:ltr]" style={{ borderColor: INK }}>
                  <Image src={f.img} alt={f.title} width={1200} height={896} className="h-full w-full object-cover" />
                </motion.div>
                <div className="[direction:ltr]">
                  <span className="mb-3 inline-block rounded-full bg-[#F3D9CF] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#8C5F56]">{f.tag}</span>
                  <h3 className="mb-3 text-2xl font-black tracking-tight">{f.title}</h3>
                  <p className="max-w-md text-base leading-relaxed text-[#5C554F]">{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Microscopía: medicina de verdad ─── */}
      <section className="relative overflow-hidden px-6 py-28 md:px-12">
        <FloatingArt src="/img/ai/cozy-mascota.png" size={150} top="6%" left="84%" depth={34} delay={0.4} mouseX={smoothX} mouseY={smoothY} />
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }} className="mb-14 max-w-2xl">
            <span className="mb-4 inline-block rounded-full bg-[#E7F0EE] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#2F5D5A]">Medicina de verdad</span>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">Cozy por fuera, <span className="text-[#B87A6F]">riguroso por dentro</span></h2>
            <p className="mt-4 text-base leading-relaxed text-[#5C554F]">
              Detrás de la interfaz amable hay contenido serio: preguntas ancladas a la
              histología, la microbiología y la clínica reales del MIR.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {MICRO.map((m, i) => (
              <motion.div
                key={m.tag}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -8 }}
                className="group overflow-hidden rounded-3xl border-2 bg-white shadow-soft transition-shadow hover:shadow-[0_24px_50px_-20px_rgba(184,122,111,0.4)]"
                style={{ borderColor: INK }}
              >
                <div className="relative h-52 overflow-hidden">
                  <Image src={m.img} alt={m.tag} fill sizes="33vw" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#2F5D5A] backdrop-blur-sm">{m.tag}</span>
                </div>
                <p className="p-5 text-sm leading-relaxed text-[#5C554F]">{m.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
        <div className="grid gap-6 rounded-[2.5rem] border-2 bg-white p-10 text-center shadow-soft sm:grid-cols-3" style={{ borderColor: INK }}>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><Counter target={365} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Dailys al año, sin excepción</p>
          </div>
          <div className="border-[#E5DED6] sm:border-x-2 sm:px-6">
            <p className="text-5xl font-black text-[#B87A6F]"><Counter target={10} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Dimensiones de etiquetado</p>
          </div>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><Counter target={1} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Pago único · sin suscripción</p>
          </div>
        </div>
      </section>

      {/* ─── CTA final con la mascota ─── */}
      <section className="relative overflow-hidden px-6 pb-28 md:px-12">
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

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.2 }}
            className="relative mx-auto mb-4 h-28 w-28"
          >
            <Image src="/img/ai/cozy-mascota.png" alt="Mascota MirDaily" fill sizes="112px" className="object-contain drop-shadow-lg" />
          </motion.div>

          <h2 className="relative mb-4 text-3xl font-black leading-tight md:text-5xl">Tu sobre de hoy ya te espera.</h2>
          <p className="relative mx-auto mb-9 max-w-xl text-base text-white/85 md:text-lg">
            Únete a la comunidad que prepara el MIR pregunta a pregunta, día a día.
            Crear tu cuenta lleva menos que leer un enunciado.
          </p>
          <motion.div whileHover={{ scale: 1.06, y: -3 }} whileTap={{ scale: 0.96 }} className="relative inline-block">
            <Link href="/auth" className="inline-flex items-center gap-2 rounded-full border-2 bg-white px-8 py-4 text-base font-bold text-[#B87A6F] shadow-[0_18px_40px_-12px_rgba(58,54,50,0.5)]" style={{ borderColor: INK }}>
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
          <p className="text-xs text-[#8C857E]">© {new Date().getFullYear()} MirDaily — El MIR se gana un día a la vez.</p>
          <div className="flex items-center gap-4">
            <Link href="/landings" className="text-xs font-bold text-[#B87A6F] hover:underline">Otras landings</Link>
            <Link href="/auth" className="text-xs font-bold text-[#B87A6F] hover:underline">Entrar →</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
