'use client'

import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { debugRender } from '@/lib/debugRSC'
import { useAuth } from '@/hooks/useAuth'
import { useMonthlyProgress } from '@/hooks/useAnalytics'
import { useProgressContext } from '@/providers/ProgressProvider'
import type { MonthlyProgressResponse } from '@/services/analyticsService'

// El popup y la decoración de las tarjetas (SVG animados que solo se ven al
// pasar el ratón: `opacity: 0` en reposo) se cargan aparte y después de la
// primera pintura. No entran en el bundle inicial de /studio ni se montan
// durante la hidratación, que es donde se notaba el tirón al cargar.
const SmartSimulacroModal = dynamic(
  () => import('@/components/simulacro/SmartSimulacroModal'),
  { ssr: false },
)
const SingleSheetArt = dynamic(
  () => import('@/components/studio/SimulacrosHoverArt').then((m) => m.SingleSheetArt),
  { ssr: false },
)
const StackedSheetsArt = dynamic(
  () => import('@/components/studio/SimulacrosHoverArt').then((m) => m.StackedSheetsArt),
  { ssr: false },
)
const DeckArt = dynamic(
  () => import('@/components/studio/MazosHoverArt').then((m) => m.DeckArt),
  { ssr: false },
)
const FlipCardArt = dynamic(
  () => import('@/components/studio/FlashcardsHoverArt').then((m) => m.FlipCardArt),
  { ssr: false },
)
const WaveCta = dynamic(
  () => import('@/components/studio/SimulacroWaveArt').then((m) => m.WaveCta),
  { ssr: false },
)
const ZenTimerArt = dynamic(
  () => import('@/components/studio/ZenHoverArt').then((m) => m.ZenTimerArt),
  { ssr: false },
)
const EcgMonitorArt = dynamic(
  () => import('@/components/studio/ElectrosHoverArt').then((m) => m.EcgMonitorArt),
  { ssr: false },
)
const EcgTraceCta = dynamic(
  () => import('@/components/studio/ElectrosHoverArt').then((m) => m.EcgTraceCta),
  { ssr: false },
)

type OverviewCard = {
  title: string
  value: string
  badge?: string
  /** Color del badge: verde si la tendencia sube, rojo si baja, neutro si no cambia. */
  badgeTone?: 'up' | 'down' | 'flat'
  description: string
  icon: string
  tone: 'success' | 'error'
}

type StudioCard = {
  id: string
  icon: string
  title: string
  description: string
  type: 'featured' | 'split-actions' | 'progress' | 'zen' | 'link'
  badge?: string
  cta?: string
  href?: string
  primaryAction?: string
  secondaryAction?: string
  progress?: number
  meta?: string
  linkOne?: string
  linkTwo?: string
}

const numberFormat = new Intl.NumberFormat('es-ES')

/** El punto débil que ya viene resuelto en el desafío personalizado. */
type PuntoDebil = { tema: string; asignatura: string; precision: number | null }

/* El punto débil, del heatmap real.

   Hasta el 08-09-2026 esta tarjeta era una cadena escrita a mano que decía
   "Digestivo · Precisión baja en patología esofágica (45%)" a todo el mundo.
   Nadie podía comprobar que mentía hasta que el desafío personalizado del
   perfil empezó a enseñar el punto débil DE VERDAD: el producto se contradecía
   a sí mismo, y una de las dos respuestas era inventada.

   El dato NO se pide aparte: sale del propio desafío "Ataca tu punto débil",
   que ya lo trae resuelto en su meta. Al primer intento se conectó a
   analytics_weak_points, que parecía el sitio natural, y el resultado fue que
   la tarjeta y el desafío señalaban temas DISTINTOS: aquel endpoint no exige
   un mínimo de intentos y mirdaily_weak_topic sí (ocho), así que la tarjeta
   se iba a temas con seis respuestas, donde un 33% es ruido y no un punto
   débil. Dos definiciones de lo mismo vuelven a ser una contradicción, aunque
   las dos salgan de datos reales. Una sola fuente, y de paso una petición
   menos. */
function buildWeakPointCard(
  topic: PuntoDebil | null,
  loading: boolean,
): OverviewCard {
  const base = { title: 'Punto Débil Detectado', icon: 'priority_high', tone: 'error' as const }

  if (!topic) {
    return {
      ...base,
      value: '—',
      description: loading
        ? 'Buscando dónde flojeas…'
        : 'Responde unas cuantas preguntas y aquí saldrá tu tema más flojo.',
    }
  }

  const pct = topic.precision == null ? null : Math.round(topic.precision)

  return {
    ...base,
    value: topic.asignatura,
    description:
      pct == null
        ? `Tu tema más flojo ahora mismo es ${topic.tema}.`
        : `${topic.tema}: ${pct}% de acierto en los últimos 30 días.`,
  }
}

/* La tarjeta destacada prometía "IA Predictiva" y nombraba dos asignaturas
   fijas. El motor predictivo está especificado pero NO implementado, así que
   se le quita el nombre que no le corresponde y se describe lo que de verdad
   hace: un simulacro centrado en lo que peor llevas, según el heatmap. */
function buildFeaturedCard(topic: PuntoDebil | null): StudioCard {
  const base = {
    id: 'simulacros',
    icon: 'psychology_alt',
    cta: 'Generar sesión personalizada',
    badge: 'RECOMENDADO',
    type: 'featured' as const,
  }

  if (!topic) {
    return {
      ...base,
      title: 'Simulacro a tu medida',
      description:
        'Cuando tengamos datos de tus fallos, te propondremos aquí una sesión centrada en ellos.',
    }
  }

  return {
    ...base,
    title: 'Simulacro a tu medida',
    description: `Una sesión de 30 preguntas centrada en ${topic.tema}, de ${topic.asignatura}, que es donde peor vas ahora mismo.`,
  }
}

// "Progreso Mensual" con datos reales: preguntas repasadas en los últimos 30
// días, su variación frente a los 30 previos y el acumulado del año.
function buildProgressCard(
  progress: MonthlyProgressResponse | null,
  loading: boolean,
): OverviewCard {
  const base = { title: 'Progreso Mensual', icon: 'trending_up', tone: 'success' as const }

  if (!progress) {
    return {
      ...base,
      value: '—',
      description: loading
        ? 'Calculando tu actividad…'
        : 'Empieza a repasar para ver aquí tu progreso.',
    }
  }

  const { month, year, trendPct } = progress
  // Mismo volumen que el mes previo no es "subir": ni flecha arriba ni verde.
  const trendPrefix = trendPct == null ? '' : trendPct > 0 ? '↑ +' : trendPct < 0 ? '↓ ' : '→ '

  return {
    ...base,
    value: month.questions > 0 ? `+${numberFormat.format(month.questions)}` : '0',
    // Sin mes previo con actividad no hay tendencia honesta que enseñar.
    badge:
      trendPct == null ? undefined : `${trendPrefix}${numberFormat.format(trendPct)}%`,
    badgeTone:
      trendPct == null ? undefined : trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'flat',
    description:
      year.questions === 1
        ? '1 pregunta repasada en el último año'
        : `${numberFormat.format(year.questions)} preguntas repasadas en el último año`,
  }
}

const studioCardsBase: ReadonlyArray<StudioCard> = [
  {
    id: 'preguntas-simulacros',
    icon: 'quiz',
    title: 'Preguntas y Simulacros',
    description: 'Crea nuevos simulacros, revisa tu historial o haz un test rápido.',
    primaryAction: 'Crear Simulacro',
    secondaryAction: 'Revisar Historial',
    type: 'split-actions',
  },
  {
    id: 'mazos',
    icon: 'layers',
    title: 'Mazos',
    description: 'Repaso espaciado de tus preguntas guardadas para retenerlas a largo plazo.',
    cta: 'Ir a mis mazos',
    href: '/decks',
    type: 'link',
  },
  {
    id: 'flashcards',
    icon: 'style',
    title: 'Flashcards',
    description: 'Crea y repasa tus propias tarjetas (anverso y reverso) con repetición espaciada.',
    cta: 'Ir a mis flashcards',
    href: '/flashcards',
    type: 'link',
  },
  {
    id: 'sala-zen',
    icon: 'self_improvement',
    title: 'Sala Zen',
    description: 'Relajación y mindfulness para mejorar tu concentración.',
    primaryAction: 'Crear Sala',
    secondaryAction: 'Unirme',
    type: 'zen',
  },
  {
    id: 'electros',
    icon: 'cardiology',
    title: 'Electros',
    description:
      'Aprende a leer un ECG desde cero en la Academia y practica con trazos realistas de 12 derivaciones: eje, territorios del infarto y arritmias, latiendo en tiempo real.',
    cta: 'Entrar en Electros',
    badge: 'NUEVO',
    href: '/studio/electros',
    type: 'featured',
  },
] as const

const studioGreetingTemplates: ReadonlyArray<string> = [
  'Vamos a por tu plaza, {name}.',
  '{name}, hoy toca construir una ventaja más en tu preparación.',
  'Cada bloque suma, {name}. Vamos a mantener el ritmo.',
  'Buen momento para afinar tus puntos débiles, {name}.',
  '{name}, una sesión enfocada hoy puede marcar la diferencia.',
] as const

const studioDailyDuration = 0.5
const studioDailyEase = 'easeOut' as const
const studioGreetingRevealDelay = 0.96

// Antes también animaba `filter: blur()`, pero desenfocar ~15 elementos a la vez
// cargaba la primera pintura de repintados. Opacidad + desplazamiento + escala
// se componen en GPU y bastan para el mismo efecto de entrada.
function entranceProps(
  reduceMotion: boolean | null,
  delay: number,
  distance = 18,
  scale = 0.985,
) {
  if (reduceMotion) {
    return { initial: false as const }
  }

  return {
    initial: { opacity: 0, y: distance, scale },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: studioDailyDuration, delay, ease: studioDailyEase },
  }
}

/**
 * Bloque que aparece al entrar en el viewport y se vuelve a esconder al salir
 * (mismo patrón que `LazyCard` del dashboard / revisión del daily). Reacciona al
 * scroll: la tarjeta se revela justo donde el usuario está mirando y se apaga
 * al alejarse, así el recorrido por la página se siente vivo.
 */
function Reveal({
  children,
  className,
  id,
  reduceMotion,
  onMouseEnter,
  onMouseLeave,
  // Los encabezados solo entran una vez; las tarjetas entran y salen con el
  // scroll (`once` = false) para que el recorrido se sienta vivo.
  once = false,
}: {
  children: ReactNode
  className?: string
  id?: string
  reduceMotion: boolean | null
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { amount: 0.2, margin: '0px 0px -10% 0px', once })

  if (reduceMotion) {
    return (
      <div ref={ref} className={className} id={id} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      id={id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, y: 26, scale: 0.985 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 26, scale: 0.985 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function resolveStudioName(
  user: { display_name?: string; username?: string; email?: string } | null,
): string | null {
  const displayName = String(user?.display_name ?? '').trim()
  if (displayName) return displayName

  const username = String(user?.username ?? '').trim()
  if (username) return username

  const email = String(user?.email ?? '').trim()
  if (email.includes('@')) return email.split('@')[0]

  return null
}

export default function StudioPage() {
  debugRender('StudioPage')
  const { user, loading } = useAuth()
  const reduceMotion = useReducedMotion()
  const [simulacrosHovered, setSimulacrosHovered] = useState(false)
  const [simulacrosArtVariant, setSimulacrosArtVariant] = useState<0 | 1>(0)
  const [mazosHovered, setMazosHovered] = useState(false)
  const [flashcardsHovered, setFlashcardsHovered] = useState(false)
  const [featuredHovered, setFeaturedHovered] = useState(false)
  const [zenHovered, setZenHovered] = useState(false)
  const [electrosHovered, setElectrosHovered] = useState(false)
  const monthlyProgress = useMonthlyProgress(Boolean(user))
  const levelProgress = useProgressContext()

  // Del desafío personalizado, que ya lo trae resuelto: misma fuente que el
  // perfil, así que las dos pantallas no pueden decir cosas distintas.
  const weakTopic = useMemo<PuntoDebil | null>(() => {
    const meta = levelProgress.data?.daily.find((c) => c.metric === 'weak_topic_questions')?.meta
    const tema = typeof meta?.topic_name === 'string' ? meta.topic_name : null
    if (!tema) return null
    const precision = typeof meta?.accuracy === 'number' ? meta.accuracy : null
    return {
      tema,
      asignatura: typeof meta?.subject_name === 'string' ? meta.subject_name : '',
      precision,
    }
  }, [levelProgress.data])

  const overviewCards = useMemo<ReadonlyArray<OverviewCard>>(
    () => [
      buildProgressCard(monthlyProgress.data, monthlyProgress.loading || loading),
      buildWeakPointCard(weakTopic, levelProgress.loading || loading),
    ],
    [monthlyProgress.data, monthlyProgress.loading, loading, weakTopic, levelProgress.loading],
  )

  const studioCards = useMemo<ReadonlyArray<StudioCard>>(
    () => [buildFeaturedCard(weakTopic), ...studioCardsBase],
    [weakTopic],
  )

  // El "Simulacro a tu medida" necesita saber dónde flojea el usuario. Mientras
  // no haya un punto débil detectado, el CTA se queda desactivado con aviso: es
  // la misma señal que alimenta la tarjeta, así que no hay una petición extra.
  const smartReady = weakTopic != null
  const [smartOpen, setSmartOpen] = useState(false)

  useLayoutEffect(() => {
    const prevScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    const forceTop = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    forceTop()
    const raf1 = window.requestAnimationFrame(forceTop)
    const raf2 = window.requestAnimationFrame(() => window.requestAnimationFrame(forceTop))
    const t1 = window.setTimeout(forceTop, 50)
    const t2 = window.setTimeout(forceTop, 180)

    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.history.scrollRestoration = prevScrollRestoration
    }
  }, [])

  const studioName = useMemo(() => resolveStudioName(user), [user])
  const selectedGreetingTemplate = useMemo(() => {
    const today = new Date()
    const daySeed = Number(
      `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`,
    )
    const index = Math.abs(daySeed) % studioGreetingTemplates.length
    return studioGreetingTemplates[index]
  }, [])
  const greetingParts = useMemo(
    () => selectedGreetingTemplate.split('{name}'),
    [selectedGreetingTemplate],
  )

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Fondo decorativo */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(125,138,150,0.08)_0,transparent_30%),radial-gradient(circle_at_80%_75%,rgba(232,165,152,0.08)_0,transparent_30%)]" />
      <div className="pointer-events-none fixed -bottom-[10%] -left-[5%] z-0 h-96 w-96 rounded-full bg-[#8BA888]/15 blur-3xl" />


      <motion.main
        className="relative z-10 mx-auto w-full max-w-7xl px-6 py-8"
        {...entranceProps(reduceMotion, 0.04, 14, 0.995)}
      >
        <div className="flex flex-col gap-10">
          <motion.section
            className="mb-4 flex flex-col gap-1 sm:mb-8"
            {...entranceProps(reduceMotion, 0.1, 16, 0.99)}
          >
            {/* "Studio" encima del saludo. Es el h1 de la página. */}
            <motion.h1
              className="text-xl font-black uppercase tracking-[0.18em] text-[#2c3e50]/60 sm:text-2xl"
              {...entranceProps(reduceMotion, 0.12, 10, 0.99)}
            >
              Studio
            </motion.h1>

            <div className="min-w-0">
              <motion.p
                className="relative overflow-hidden text-lg font-light leading-tight"
                initial={reduceMotion ? false : { clipPath: 'inset(0 100% 0 0)', opacity: 0.98 }}
                animate={reduceMotion ? undefined : { clipPath: 'inset(0 0 0 0)', opacity: 1 }}
                transition={{ duration: 0.58, delay: studioGreetingRevealDelay, ease: [0.2, 0.9, 0.2, 1] }}
              >
                <span className="relative z-10">
                  {greetingParts[0]}
                </span>
                <span
                  className={`inline-block align-baseline text-3xl font-black uppercase leading-none tracking-tight text-[#d18d80] [overflow-wrap:anywhere] sm:text-4xl ${
                    !studioName ? 'min-w-[6ch]' : ''
                  } ${
                    !studioName && loading ? 'rounded bg-[#E8A598]/18' : ''
                  }`}
                >
                  {studioName ?? '\u00A0'}
                </span>
                <span className="relative z-10">
                  {greetingParts[1]}
                </span>
                {!reduceMotion ? (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-[-14px] z-20 w-8 bg-gradient-to-r from-transparent via-white/70 to-transparent blur-[2px]"
                    initial={{ left: '-14px', opacity: 0 }}
                    animate={{ left: 'calc(100% + 14px)', opacity: [0, 1, 1, 0] }}
                    transition={{
                      duration: 0.58,
                      delay: studioGreetingRevealDelay + 0.02,
                      ease: 'linear',
                      times: [0, 0.08, 0.9, 1],
                    }}
                  />
                ) : null}
              </motion.p>
            </div>
          </motion.section>

          <section>
            <Reveal once reduceMotion={reduceMotion} className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">dashboard</span>
              <h2 className="text-xl font-bold text-[#2c3e50]">Visión General del Estudio</h2>
            </Reveal>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {overviewCards.map((card) => (
                <Reveal
                  key={card.title}
                  reduceMotion={reduceMotion}
                  className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div
                    className={`absolute right-0 top-0 h-full w-24 bg-gradient-to-l to-transparent ${
                      card.tone === 'success' ? 'from-[#8BA888]/12' : 'from-[#C4655A]/12'
                    }`}
                  />
                  <div className="relative z-10">
                    <span className="text-sm font-medium uppercase tracking-wider">{card.title}</span>
                    <div className="mt-2 flex items-baseline gap-3">
                      <p
                        className={`text-4xl font-black tracking-tight ${
                          card.tone === 'success' ? 'text-[#8BA888]' : 'text-[#2c3e50]'
                        }`}
                      >
                        {card.value}
                      </p>
                      {card.badge ? (
                        <span
                          className={`rounded-lg px-2 py-0.5 text-sm font-bold ${
                            card.badgeTone === 'down'
                              ? 'bg-[#C4655A]/10 text-[#C4655A]'
                              : card.badgeTone === 'flat'
                                ? 'bg-[#7D8A96]/10 text-[#7D8A96]'
                                : 'bg-[#8BA888]/10 text-[#8BA888]'
                          }`}
                        >
                          {card.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm">{card.description}</p>
                  </div>
                  <div
                    className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full ${
                      card.tone === 'success'
                        ? 'bg-[#8BA888]/10 text-[#8BA888]'
                        : 'bg-[#C4655A]/10 text-[#C4655A]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl">{card.icon}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {studioCards.map((card, index) => (
              <Fragment key={card.id}>
                {/* Encabezado de sección: separa la tarjeta destacada del resto
                    de módulos para que no quede todo apelmazado. Mismo estilo
                    que "Visión General del Estudio". */}
                {index === 1 ? (
                  <Reveal
                    once
                    reduceMotion={reduceMotion}
                    className="mt-6 flex items-center gap-2 sm:mt-8 md:col-span-2"
                  >
                    <span className="material-symbols-outlined">folder_copy</span>
                    <h2 className="text-xl font-bold text-[#2c3e50]">
                      Módulos de entrenamiento
                    </h2>
                  </Reveal>
                ) : null}
                <Reveal
                  reduceMotion={reduceMotion}
                  id={card.id}
                  className={`group relative overflow-hidden rounded-2xl border-2 p-6 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[#2c3e50] hover:shadow-[4px_4px_0_0_#2c3e50] ${
                  card.type === 'featured'
                    ? 'border-[#E8A598]/30 bg-gradient-to-br from-white to-[#fff0ec] md:col-span-2'
                    : card.type === 'zen'
                      ? 'border-[#EAE4E2] bg-[#f4f7f4]'
                      : 'border-[#EAE4E2] bg-white'
                }`}
                {...(card.id === 'preguntas-simulacros'
                  ? {
                      onMouseEnter: () => setSimulacrosHovered(true),
                      onMouseLeave: () => {
                        setSimulacrosHovered(false)
                        setSimulacrosArtVariant((v) => (v === 0 ? 1 : 0))
                      },
                    }
                  : card.id === 'mazos'
                    ? {
                        onMouseEnter: () => setMazosHovered(true),
                        onMouseLeave: () => setMazosHovered(false),
                      }
                    : card.id === 'flashcards'
                      ? {
                          onMouseEnter: () => setFlashcardsHovered(true),
                          onMouseLeave: () => setFlashcardsHovered(false),
                        }
                      : card.id === 'simulacros'
                        ? {
                            onMouseEnter: () => setFeaturedHovered(true),
                            onMouseLeave: () => setFeaturedHovered(false),
                          }
                        : card.id === 'sala-zen'
                          ? {
                              onMouseEnter: () => setZenHovered(true),
                              onMouseLeave: () => setZenHovered(false),
                            }
                          : card.id === 'electros'
                            ? {
                                onMouseEnter: () => setElectrosHovered(true),
                                onMouseLeave: () => setElectrosHovered(false),
                              }
                            : {})}
              >
                {card.id === 'preguntas-simulacros' ? (
                  <AnimatePresence initial={false}>
                    {simulacrosArtVariant === 0 ? (
                      <SingleSheetArt key="single" hovered={simulacrosHovered} />
                    ) : (
                      <StackedSheetsArt key="stacked" hovered={simulacrosHovered} />
                    )}
                  </AnimatePresence>
                ) : null}
                {card.id === 'mazos' ? <DeckArt hovered={mazosHovered} /> : null}
                {card.id === 'flashcards' ? <FlipCardArt hovered={flashcardsHovered} /> : null}
                {card.id === 'sala-zen' ? <ZenTimerArt hovered={zenHovered} /> : null}
                {card.id === 'electros' ? <EcgMonitorArt hovered={electrosHovered} /> : null}
                {card.id === 'simulacros' && smartReady ? (
                  <WaveCta hovered={featuredHovered}>
                    <span className="material-symbols-outlined">play_arrow</span>
                    {card.cta}
                  </WaveCta>
                ) : null}
                {/* La tarjeta entera abre el popup del "Simulacro a tu medida"
                    (capa propia por encima del contenido, como en Electros).
                    Solo si hay un punto débil detectado: sin datos no hace nada
                    y debajo se explica por qué. */}
                {card.id === 'simulacros' && smartReady ? (
                  <button
                    type="button"
                    onClick={() => setSmartOpen(true)}
                    aria-label={`${card.title}: ${card.cta}`}
                    className="absolute inset-0 z-20 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8A598]"
                  />
                ) : null}
                {card.id === 'electros' ? (
                  <EcgTraceCta hovered={electrosHovered}>
                    <span className="material-symbols-outlined">monitor_heart</span>
                    {card.cta}
                  </EcgTraceCta>
                ) : null}
                {/* La tarjeta entera navega: el contenido es pointer-events-none
                    y el CTA queda debajo, así que hace falta una capa propia. */}
                {card.id === 'electros' && card.href ? (
                  <Link
                    href={card.href}
                    aria-label={`${card.title}: ${card.cta}`}
                    className="absolute inset-0 z-20 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8A598]"
                  />
                ) : null}
                <div
                  className={`relative z-10 flex h-full flex-col justify-between ${
                    card.type === 'featured' ? 'pointer-events-none' : ''
                  }`}
                >
                  <div
                    className={
                      card.id === 'preguntas-simulacros'
                        ? 'sm:pr-56'
                        : card.id === 'mazos'
                          ? 'sm:pr-72'
                          : card.id === 'flashcards'
                            ? 'sm:pr-44'
                            : card.id === 'sala-zen'
                              ? 'sm:pr-44'
                              : card.id === 'electros'
                                ? 'sm:pr-64 lg:pr-80'
                                : undefined
                    }
                  >
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div
                        className={`rounded-xl p-3 ${
                          card.type === 'featured'
                            ? 'bg-[#E8A598] text-white'
                            : card.type === 'zen'
                              ? 'bg-white text-[#8BA888]'
                              : 'bg-[#F2EFED] text-[#2c3e50]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-3xl">{card.icon}</span>
                      </div>
                      {card.badge ? (
                        <span
                          className={`rounded border px-2 py-1 text-xs font-bold ${
                            card.type === 'zen'
                              ? 'border-[#8BA888]/20 bg-[#8BA888]/10 text-[#8BA888]'
                              : 'border-[#E8A598]/20 bg-[#E8A598]/10 text-[#d18d80]'
                          }`}
                        >
                          {card.badge}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mb-2 text-2xl font-bold text-[#2c3e50]">{card.title}</h3>
                    <p className="mb-5 text-sm sm:text-base">{card.description}</p>
                    {card.id === 'simulacros' && !smartReady ? (
                      <p className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8A598]/30 bg-[#E8A598]/10 px-2.5 py-1 text-xs font-bold text-[#d18d80]">
                        <span className="material-symbols-outlined text-sm">lock</span>
                        Responde más preguntas para desbloquearlo
                      </p>
                    ) : null}
                  </div>

                  {card.type === 'featured' ? (
                    <div aria-hidden="true" className="pointer-events-none h-[54px]" />
                  ) : null}

                  {card.type === 'split-actions' ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/studio/simulacro"
                        className="flex flex-1 items-center justify-center rounded-xl bg-[#E8A598] px-4 py-3 text-base font-medium text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
                      >
                        {card.primaryAction}
                      </Link>
                      <Link
                        href="/studio/simulacro/historial"
                        className="flex flex-1 items-center justify-center rounded-xl border border-[#7D8A96]/30 bg-white px-4 py-3 text-base font-medium transition-colors hover:border-[#7D8A96]/50 hover:bg-[#F2EFED]"
                      >
                        {card.secondaryAction}
                      </Link>
                    </div>
                  ) : null}

                  {card.type === 'progress' ? (
                    <div>
                      <span className="mb-3 inline-block rounded border border-[#8BA888]/20 bg-[#8BA888]/10 px-2 py-1 text-xs font-bold text-[#8BA888]">
                        {card.meta}
                      </span>
                      <div className="mb-3">
                        <div className="mb-1 flex justify-end">
                          <span className="text-xs font-bold text-[#2c3e50]">{card.progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-[#8BA888]" style={{ width: `${card.progress}%` }} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Link
                          className="flex flex-1 items-center justify-center rounded-xl bg-[#E8A598] px-4 py-3 text-base font-medium text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
                          href="/decks"
                        >
                          {card.linkOne}
                        </Link>
                        <Link
                          className="flex flex-1 items-center justify-center rounded-xl border border-[#7D8A96]/30 bg-white px-4 py-3 text-base font-medium transition-colors hover:border-[#7D8A96]/50 hover:bg-[#F2EFED]"
                          href="/decks"
                        >
                          {card.linkTwo}
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {card.type === 'zen' ? (
                    <div className="flex flex-row gap-3">
                      <Link href="/zen" className="flex-1 rounded-lg bg-[#E8A598] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80] text-center">
                        {card.primaryAction}
                      </Link>
                      <Link href="/zen" className="flex-1 rounded-lg bg-[#7D8A96] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6c7985] text-center">
                        {card.secondaryAction}
                      </Link>
                    </div>
                  ) : null}

                  {card.type === 'link' && card.href ? (
                    <Link
                      href={card.href}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-6 py-3 text-base font-medium text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80] sm:w-auto"
                    >
                      {card.cta}
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                  ) : null}
                </div>
                </Reveal>
              </Fragment>
            ))}
          </section>

          <section className="border-t border-[#EAE4E2] pt-8">
            <Reveal once reduceMotion={reduceMotion}>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider">Acceso Rápido</h3>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Reveal once reduceMotion={reduceMotion}>
                <Link
                  href="/library"
                  className="group flex cursor-pointer items-center gap-4 rounded-xl border border-[#EAE4E2] bg-white p-4 transition-colors hover:border-[#E8A598]/50"
                >
                  <div className="rounded-lg bg-[#F2EFED] p-2 text-[#7D8A96] transition-colors group-hover:bg-[#E8A598] group-hover:text-white">
                    <span className="material-symbols-outlined">menu_book</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2c3e50]">Conceptos Básicos</h4>
                    <p className="text-xs">Biblioteca de manuales</p>
                  </div>
                </Link>
              </Reveal>
              <Reveal once reduceMotion={reduceMotion}>
                <Link
                  href="/studio/minijuegos"
                  className="group flex cursor-pointer items-center gap-4 rounded-xl border border-[#EAE4E2] bg-white p-4 transition-colors hover:border-[#E8A598]/50"
                >
                  <div className="rounded-lg bg-[#F2EFED] p-2 text-[#7D8A96] transition-colors group-hover:bg-[#E8A598] group-hover:text-white">
                    <span className="material-symbols-outlined">sports_esports</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2c3e50]">Minijuegos</h4>
                    <p className="text-xs">Repasa jugando: GramSwipe y más</p>
                  </div>
                </Link>
              </Reveal>
            </div>
          </section>
        </div>
      </motion.main>

      {smartOpen ? <SmartSimulacroModal onClose={() => setSmartOpen(false)} /> : null}
    </div>
  )
}

