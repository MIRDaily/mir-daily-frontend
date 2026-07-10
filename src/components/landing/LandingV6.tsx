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
   MIRDaily — Landing variante F: «Editorial»
   Construida alrededor de los recursos de imagen generados con IA
   (public/img/ai). Combina lo mejor de las variantes favoritas:
   pregunta interactiva + marquee (clásica), ilustraciones protagonistas
   (atlas), cuenta atrás al MIR (recta final) y parallax (bienvenida).
   Paleta: crema + coral de marca, con verde petróleo #2F5D5A de los
   recursos como color de confianza.
   ──────────────────────────────────────────────────────────────────────── */

const INK = 'rgba(17, 24, 39, 0.85)'
const CORAL = '#D4978C'
const CORAL_DEEP = '#B87A6F'
const TEAL = '#2F5D5A'

const NEXT_MIR_DATE = new Date('2027-01-30T09:00:00')

/* ─── Cuenta atrás al MIR (de recta final) ─────────────────────────────── */

function MirCountdown() {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0 })
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(NEXT_MIR_DATE.getTime() - Date.now(), 0)
      setParts({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const blocks = [
    { v: parts.d, l: 'días' },
    { v: parts.h, l: 'h' },
    { v: parts.m, l: 'min' },
    { v: parts.s, l: 'seg' },
  ]

  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border-2 bg-white/80 px-4 py-2.5 backdrop-blur-sm" style={{ borderColor: INK }}>
      <span className="material-symbols-outlined text-[18px]" style={{ color: CORAL_DEEP }}>event</span>
      <span className="text-xs font-bold uppercase tracking-wide text-[#8C857E]">MIR en</span>
      {blocks.map((b, i) => (
        <span key={b.l} className="flex items-baseline gap-1">
          <span className="text-lg font-black tabular-nums" style={{ color: CORAL_DEEP }}>
            {String(b.v).padStart(2, '0')}
          </span>
          <span className="text-[10px] font-bold text-[#8C857E]">{b.l}</span>
          {i < blocks.length - 1 && <span className="text-[#D4B8AE]">·</span>}
        </span>
      ))}
    </div>
  )
}

/* ─── Pregunta interactiva (de la clásica) ─────────────────────────────── */

const DEMO = {
  stem: 'Mujer de 34 años con astenia, palidez y microcitosis en el hemograma. Ferritina baja. ¿Diagnóstico más probable?',
  options: ['Anemia de trastornos crónicos', 'Anemia ferropénica', 'Talasemia menor', 'Anemia megaloblástica'],
  correct: 1,
}

function DemoQuestion() {
  const [selected, setSelected] = useState<number | null>(null)
  const answered = selected !== null
  const isCorrect = selected === DEMO.correct

  return (
    <div className="relative w-full max-w-md rounded-3xl border-2 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(47,93,90,0.45)]" style={{ borderColor: INK }}>
      {answered && isCorrect && (
        <div className="confetti-layer">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className={`confetti-piece confetti-piece-${i + 1}`} />
          ))}
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: CORAL_DEEP }}>
          Pregunta tipo MIR
        </span>
        <span className="rounded-full bg-[#F3D9CF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#8C5F56]">
          Hematología
        </span>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-[#3A3632]">{DEMO.stem}</p>
      <div className="flex flex-col gap-2.5">
        {DEMO.options.map((opt, i) => {
          const thisCorrect = i === DEMO.correct
          const thisSelected = i === selected
          let cls = 'border-[#E5DED6] bg-[#FAF7F4] hover:border-[#D4978C] hover:bg-[#FBEFE9]'
          if (answered && thisCorrect) cls = 'border-[#8BA888] bg-[#EAF2E8]'
          else if (answered && thisSelected && !thisCorrect) cls = 'border-[#D4978C] bg-[#FBEAE4]'
          else if (answered) cls = 'border-[#E5DED6] bg-[#FAF7F4] opacity-55'
          return (
            <motion.button
              key={opt}
              type="button"
              disabled={answered}
              onClick={() => setSelected(i)}
              whileTap={answered ? undefined : { scale: 0.97 }}
              animate={answered && thisSelected && !thisCorrect ? { x: [0, -8, 8, -5, 5, 0] } : {}}
              transition={{ duration: 0.45 }}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium text-[#3A3632] transition-colors duration-200 ${cls}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold" style={{ borderColor: INK }}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
              {answered && thisCorrect && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }} className="material-symbols-outlined ml-auto text-[20px] text-[#5F7E5C]">
                  check_circle
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {answered && (
          <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 16 }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F4] px-4 py-3">
              <p className="text-sm font-medium text-[#3A3632]">
                {isCorrect ? '¡Correcta! Microcitosis + ferritina baja = ferropénica.' : 'Casi. La ferritina baja es la clave: es ferropénica.'}
              </p>
              <button type="button" onClick={() => setSelected(null)} className="material-symbols-outlined text-[20px] text-[#B87A6F] transition-transform hover:rotate-180" style={{ transitionDuration: '400ms' }} aria-label="Reintentar">
                refresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Ilustración flotante con parallax (de bienvenida/atlas) ──────────── */

function FloatingArt({
  src, size, top, left, depth, delay, rotate, mouseX, mouseY,
}: {
  src: string; size: number; top: string; left: string; depth: number; delay: number; rotate: number
  mouseX: MotionValue<number>; mouseY: MotionValue<number>
}) {
  const x = useTransform(mouseX, [0, 1], [-depth, depth])
  const y = useTransform(mouseY, [0, 1], [-depth, depth])
  return (
    <motion.div className="pointer-events-none absolute z-0 hidden lg:block" style={{ top, left, x, y }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, y: [0, -16, 0], rotate: [rotate, rotate + 5, rotate] }}
        transition={{
          opacity: { duration: 0.9, delay },
          scale: { duration: 0.9, delay, type: 'spring', stiffness: 140 },
          y: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay },
          rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut', delay },
        }}
        className="overflow-hidden rounded-3xl border-2 bg-white shadow-[0_20px_40px_-20px_rgba(47,93,90,0.4)]"
        style={{ borderColor: INK, width: size, height: size * 0.75 }}
      >
        <Image src={src} alt="" width={size} height={Math.round(size * 0.75)} className="h-full w-full object-cover" />
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

const SUBJECTS = [
  'Cardiología', 'Neumología', 'Digestivo', 'Neurología', 'Infecciosas', 'Ginecología',
  'Pediatría', 'Psiquiatría', 'Endocrino', 'Nefrología', 'Hematología', 'Dermatología',
  'Traumatología', 'Oftalmología', 'Urología', 'Reumatología', 'Inmunología', 'Farmacología',
]

const FEATURES = [
  {
    img: '/img/ai/feature-etiquetado-10d.png',
    title: 'Etiquetado en 10 dimensiones',
    text: 'Cada pregunta está clasificada por especialidad, dificultad, año, tema y otras 6 dimensiones. Estudia justo lo que necesitas.',
  },
  {
    img: '/img/ai/feature-ranking.png',
    title: 'Ranking diario',
    text: 'Cada día compites con miles de opositores. Tu posición y tu percentil, actualizados en tiempo real.',
  },
  {
    img: '/img/ai/feature-banco.png',
    title: 'Banco de preguntas',
    text: 'Miles de preguntas tipo MIR, ordenadas y siempre a mano. El archivo más completo, sin perderte en él.',
  },
  {
    img: '/img/ai/feature-progreso.png',
    title: 'Seguimiento de progreso',
    text: 'Heatmap de constancia, evolución por asignatura y racha diaria. Tus datos convertidos en motivación.',
  },
]

/* ─── Página ───────────────────────────────────────────────────────────── */

export default function LandingV6() {
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
  const heroImageParallax = useTransform(scrollY, [0, 700], [0, 80])
  const heroTextParallax = useTransform(scrollY, [0, 700], [0, 160])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#171312]">
      <motion.div
        className="fixed left-0 top-0 z-50 h-1 w-full origin-left"
        style={{ scaleX: progressScale, background: `linear-gradient(90deg, ${CORAL}, ${CORAL_DEEP}, ${TEAL})` }}
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
        <Link href="/editorial" className="relative block h-10 w-32" aria-label="MirDaily">
          <Image src="/img/logo_mirdaily.png" alt="MirDaily" fill sizes="128px" className="scale-[2.9] object-contain" priority />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3632] transition-colors hover:bg-[#F3EBE3]">Entrar</Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
            <Link href="/auth" className="inline-block whitespace-nowrap rounded-full border-2 px-5 py-2 text-sm font-bold text-white shadow-[0_6px_20px_-6px_rgba(47,93,90,0.5)] transition-colors" style={{ borderColor: INK, background: CORAL_DEEP }}>
              Empezar gratis
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ─── Hero con hero-a.png de fondo ─── */}
      <section ref={heroRef} onMouseMove={handleHeroMouse} className="relative flex min-h-screen items-center overflow-hidden px-6 pt-28 md:px-12">
        {/* Imagen hero: ocupa la mitad derecha, su "acción" cae ahí; texto sobre la zona de respiro izquierda */}
        <motion.div style={{ y: heroImageParallax }} className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/img/ai/hero-a.png"
            alt="Escritorio de estudio MIR al atardecer"
            fill
            priority
            sizes="100vw"
            className="object-cover object-right"
          />
          {/* Degradado para asegurar legibilidad del texto sobre la zona izquierda */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #FAF7F4 0%, rgba(250,247,244,0.92) 34%, rgba(250,247,244,0.4) 52%, rgba(250,247,244,0) 68%)' }} />
        </motion.div>

        <motion.div style={{ y: heroTextParallax }} className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mb-6">
              <MirCountdown />
            </motion.div>

            <h1 className="mb-6 text-4xl font-black leading-[1.06] tracking-tight text-[#171312] md:text-6xl">
              {['Prepara el MIR', 'con método,'].map((line, i) => (
                <motion.span key={line} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 + i * 0.15, ease: [0.22, 1, 0.36, 1] }} className="block">
                  {line}
                </motion.span>
              ))}
              <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }} className="block">
                <span className="relative inline-block">
                  <span className="relative z-10" style={{ color: CORAL_DEEP }}>no con suerte.</span>
                  <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 1.1, ease: [0.22, 1, 0.36, 1] }} className="absolute bottom-1 left-0 right-0 z-0 h-4 origin-left rounded-md bg-[#F3D9CF]" />
                </span>
              </motion.span>
            </h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.85 }} className="mb-8 max-w-md text-base leading-relaxed text-[#5C554F] md:text-lg">
              Preguntas diarias etiquetadas en 10 dimensiones, ranking real entre
              opositores y seguimiento de tu progreso. Un pago único por convocatoria,
              sin suscripciones.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1 }} className="flex flex-wrap items-center gap-4">
              <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
                <Link href="/auth" className="inline-flex items-center gap-2 rounded-full border-2 px-7 py-3.5 text-base font-bold text-white shadow-[0_14px_34px_-10px_rgba(47,93,90,0.6)] transition-colors" style={{ borderColor: INK, background: CORAL_DEEP }}>
                  Empieza gratis hoy
                  <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} className="material-symbols-outlined text-[20px]">arrow_forward</motion.span>
                </Link>
              </motion.div>
              <a href="#demo" className="inline-flex items-center gap-1.5 rounded-full border-2 bg-white/70 px-5 py-3.5 text-base font-medium text-[#3A3632] backdrop-blur-sm transition-colors hover:bg-white" style={{ borderColor: 'rgba(17,24,39,0.15)' }}>
                Probar una pregunta
                <span className="material-symbols-outlined text-[18px]">quiz</span>
              </a>
            </motion.div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <span className="review-scroll-cue" />
          <span className="review-scroll-cue review-scroll-cue-2" />
        </motion.div>
      </section>

      {/* ─── Marquee (de la clásica) ─── */}
      <section className="relative -rotate-1 border-y-2 py-4" style={{ borderColor: INK, background: CORAL_DEEP }}>
        <div className="flex overflow-hidden">
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1} className="landing-marquee flex shrink-0 items-center gap-8 pr-8">
              {SUBJECTS.map((s) => (
                <span key={s} className="flex items-center gap-8 whitespace-nowrap text-sm font-bold uppercase tracking-widest text-[#EAD9D2]">
                  {s}
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D4978C]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pregunta interactiva + parallax de recursos ─── */}
      <section id="demo" className="relative overflow-hidden px-6 py-28 md:px-12">
        <FloatingArt src="/img/ai/social-cuadrado.png" size={180} top="8%" left="3%" depth={30} delay={0.3} rotate={-5} mouseX={smoothX} mouseY={smoothY} />
        <FloatingArt src="/img/ai/feature-ranking.png" size={200} top="60%" left="84%" depth={40} delay={0.6} rotate={6} mouseX={smoothX} mouseY={smoothY} />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <span className="mb-4 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
              Pruébalo ahora
            </span>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">
              Así se siente cada <span style={{ color: CORAL_DEEP }}>Daily</span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-[#5C554F]">
              Responde una pregunta real tipo MIR, compárate con el resto y revisa la
              explicación al instante. Cada acierto suma a tu racha y a tu posición en
              el ranking del día.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <DemoQuestion />
          </div>
        </div>
      </section>

      {/* ─── Features con ilustraciones IA ─── */}
      <section className="relative overflow-hidden bg-[#F5F1EC] py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-12">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }} className="mb-16 text-center">
            <span className="mb-4 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
              Por qué MIR Daily
            </span>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              Cuatro razones para <span style={{ color: CORAL_DEEP }}>no estudiar solo</span>
            </h2>
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
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: CORAL_DEEP }}>
                    <span className="text-lg font-black">{i + 1}</span>
                  </span>
                  <h3 className="mb-3 text-2xl font-black tracking-tight">{f.title}</h3>
                  <p className="max-w-md text-base leading-relaxed text-[#5C554F]">{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Mockup del producto ─── */}
      <section className="relative mx-auto max-w-6xl px-6 py-28 md:px-12">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }} className="mb-12 text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Tu <span style={{ color: CORAL_DEEP }}>ranking diario</span>, en vivo
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#5C554F]">
            Cada mañana ves tu posición, tu percentil y tu racha. El MIR no es la nota:
            es tu percentil frente al resto.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -6 }}
          className="overflow-hidden rounded-[2rem] border-2 bg-white p-2 shadow-[0_30px_70px_-30px_rgba(47,93,90,0.5)]"
          style={{ borderColor: INK }}
        >
          <Image src="/img/ai/mockup-ranking-a.png" alt="Dashboard de ranking diario de MIR Daily" width={2752} height={1536} className="w-full rounded-[1.5rem]" />
        </motion.div>
      </section>

      {/* ─── Stats ─── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
        <div className="grid gap-6 rounded-[2.5rem] border-2 bg-white p-10 text-center shadow-soft sm:grid-cols-3" style={{ borderColor: INK }}>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><Counter target={10} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Dimensiones de etiquetado</p>
          </div>
          <div className="border-[#E5DED6] sm:border-x-2 sm:px-6">
            <p className="text-5xl font-black text-[#B87A6F]"><Counter target={365} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Días de ranking al año</p>
          </div>
          <div>
            <p className="text-5xl font-black text-[#B87A6F]"><Counter target={1} /></p>
            <p className="mt-2 text-sm font-medium text-[#5C554F]">Pago único · sin suscripción</p>
          </div>
        </div>
      </section>

      {/* ─── CTA final con social-story ─── */}
      <section className="relative overflow-hidden px-6 pb-28 md:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto grid max-w-4xl overflow-hidden rounded-[3rem] border-2 md:grid-cols-[1.4fr_1fr]"
          style={{ borderColor: INK }}
        >
          <div className="bg-gradient-to-br from-[#E2A99E] to-[#B87A6F] px-8 py-16 text-center text-white md:px-12 md:text-left">
            <span className="material-symbols-outlined mb-5 inline-block text-[48px] text-white">local_fire_department</span>
            <h2 className="mb-4 text-3xl font-black leading-tight md:text-4xl">
              El Pase Convocatoria te espera.
            </h2>
            <p className="mb-8 max-w-sm text-base text-white/85">
              Un pago único hasta el día del examen. Sin renovaciones, sin sorpresas.
              Empieza gratis y decide luego.
            </p>
            <motion.div whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.96 }} className="inline-block">
              <Link href="/auth" className="inline-flex items-center gap-2 rounded-full border-2 bg-white px-8 py-4 text-base font-bold shadow-[0_18px_40px_-12px_rgba(0,0,0,0.4)]" style={{ borderColor: INK, color: CORAL_DEEP }}>
                Crear cuenta gratis
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </Link>
            </motion.div>
          </div>
          <div className="relative hidden min-h-[360px] md:block">
            <Image src="/img/ai/social-story.png" alt="" fill sizes="40vw" className="object-cover" />
          </div>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t-2 px-6 py-10 md:px-12" style={{ borderColor: 'rgba(17,24,39,0.12)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="relative h-8 w-28">
            <Image src="/img/logo_mirdaily.png" alt="MirDaily" fill sizes="112px" className="scale-[2.9] object-contain" />
          </div>
          <p className="text-xs text-[#8C857E]">© {new Date().getFullYear()} MirDaily — Prepara el MIR con método, no con suerte.</p>
          <div className="flex items-center gap-4">
            <Link href="/landings" className="text-xs font-bold text-[#B87A6F] hover:underline">Otras landings</Link>
            <Link href="/auth" className="text-xs font-bold text-[#B87A6F] hover:underline">Entrar →</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
