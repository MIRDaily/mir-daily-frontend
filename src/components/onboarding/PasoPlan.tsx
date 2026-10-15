'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import Image from 'next/image'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { INK } from '@/components/ui/sticker'

// Onboarding · «Elige tu plan» (MOCKUP, 15/10/2026). Todavía no hace nada: no se guarda en el servidor
// ni cambia lo que el usuario puede usar; la elección solo se recuerda en este navegador. Cuando haya
// planes de verdad, este paso asignará el plan (y la prueba de Pro) en ai_planes.
//
// Qué incluye cada uno (propuesta del 15/10/2026): Gratis = daily, sus estadísticas, Versus y MedGuess;
// Plus = las herramientas a mano y 50 créditos de IA al mes para probar; Pro = la IA (700 al mes).
//
// Cada tarjeta tiene su textura (la regla del kit «sticker»): el calendario del Daily, el cuaderno de
// quien se hace sus propios apuntes y el polvo de estrellas de la IA. Se inclinan con el puntero, el
// marco de la elegida salta de una a otra, el fago cambia de pose y lo que se desbloquea se enciende
// abajo. Con «reducir movimiento», todo quieto.

export type PlanElegido = 'gratis' | 'plus' | 'pro'

const CLAVE = 'mirdaily.onboarding.plan'

export function leerPlanElegido(): PlanElegido | null {
  try {
    const v = window.localStorage.getItem(CLAVE)
    return v === 'gratis' || v === 'plus' || v === 'pro' ? v : null
  } catch {
    return null
  }
}

function guardarPlanElegido(p: PlanElegido) {
  try {
    window.localStorage.setItem(CLAVE, p)
  } catch {
    /* sin almacenamiento (navegación privada): es solo un recuerdo */
  }
}

type Plan = {
  id: PlanElegido
  nombre: string
  lema: string
  precio: string
  detalle: string
  ia: string
  creditos: number
  color: string
  tinta: string
  fondo: string
  icono: string
  pose: string
  frase: string
  textura: CSSProperties
}

const PLANES: Plan[] = [
  {
    id: 'gratis',
    nombre: 'Gratis',
    lema: 'Entrena cada día, sin compromiso',
    precio: '0 €',
    detalle: 'Para siempre',
    ia: 'Sin IA',
    creditos: 0,
    color: '#7D8A96',
    tinta: '#5D6A76',
    fondo: '#EEF1F3',
    icono: 'wb_sunny',
    pose: '/img/mascota/saludo.png',
    frase: 'Con el Daily ya entrenas cada día. ¡Y retas a tus amigos en Versus!',
    // El calendario del Daily: una cuadrícula de días.
    textura: {
      backgroundImage: [
        'repeating-linear-gradient(0deg, rgba(125,138,150,0.10) 0 1px, transparent 1px 1.15rem)',
        'repeating-linear-gradient(90deg, rgba(125,138,150,0.10) 0 1px, transparent 1px 1.15rem)',
      ].join(','),
    },
  },
  {
    id: 'plus',
    nombre: 'Plus',
    lema: 'Todas las herramientas, hechas por ti',
    precio: 'Gratis',
    detalle: 'durante la beta',
    ia: 'Prueba la IA · 50/mes',
    creditos: 50,
    color: '#5E8C5A',
    tinta: '#3F6E3C',
    fondo: '#EAF3E8',
    icono: 'construction',
    pose: '/img/mascota/con-mazo.png',
    frase: 'Tus mazos, tus mapas, tus resúmenes… y un poco de IA para probarla.',
    // El cuaderno de quien se hace sus apuntes: renglones y el margen rojo.
    textura: {
      backgroundImage: [
        'linear-gradient(90deg, transparent 1.4rem, rgba(212,102,122,0.22) 1.4rem 1.5rem, transparent 1.5rem)',
        'repeating-linear-gradient(0deg, rgba(94,140,90,0.13) 0 1px, transparent 1px 1.35rem)',
      ].join(','),
    },
  },
  {
    id: 'pro',
    nombre: 'Pro',
    lema: 'La IA prepara el material contigo',
    precio: 'Gratis',
    detalle: 'durante la beta',
    ia: 'IA · 700 créditos/mes',
    creditos: 700,
    color: '#E8A598',
    tinta: '#C4655A',
    fondo: '#FCEFEC',
    icono: 'auto_awesome',
    pose: '/img/mascota/confiado.png',
    frase: 'Sube tu PDF y en un minuto tienes mapa, flashcards y resumen. Yo me encargo.',
    // Polvo de estrellas: puntos finos y un brillo en la esquina.
    textura: {
      backgroundImage: [
        'radial-gradient(circle, rgba(196,101,90,0.22) 1px, transparent 1.6px)',
        'radial-gradient(circle at 85% 10%, rgba(232,165,152,0.35) 0, transparent 45%)',
      ].join(','),
      backgroundSize: '1rem 1rem, auto',
    },
  },
]

type Funcion = { nombre: string; icono: string; desde: PlanElegido; pruebaEnPlus?: boolean }
const FUNCIONES: Funcion[] = [
  { nombre: 'Daily con revisión', icono: 'today', desde: 'gratis' },
  { nombre: 'Estadísticas del Daily', icono: 'monitoring', desde: 'gratis' },
  { nombre: 'Versus', icono: 'swords', desde: 'gratis' },
  { nombre: 'MedGuess', icono: 'stethoscope', desde: 'gratis' },
  { nombre: 'Mazos y flashcards', icono: 'style', desde: 'plus' },
  { nombre: 'Mapas mentales', icono: 'account_tree', desde: 'plus' },
  { nombre: 'Resúmenes activos', icono: 'text_snippet', desde: 'plus' },
  { nombre: 'Simulacros', icono: 'quiz', desde: 'plus' },
  { nombre: 'Repaso espaciado', icono: 'event_repeat', desde: 'plus' },
  { nombre: 'Panel de rendimiento', icono: 'insights', desde: 'plus' },
  { nombre: 'IA desde tus documentos', icono: 'auto_awesome', desde: 'pro', pruebaEnPlus: true },
]
const NIVEL: Record<PlanElegido, number> = { gratis: 0, plus: 1, pro: 2 }
// Lo que cuesta un tema mediano (25.000 caracteres) con mapa, flashcards y resumen, con la tarifa v1.
const CREDITOS_POR_TEMA = 19

function Icono({ nombre, color, tam = '1.2rem', relleno = false }: { nombre: string; color: string; tam?: string; relleno?: boolean }) {
  return (
    <span aria-hidden className="inline-block shrink-0 leading-none" style={{ color }}>
      <span className="material-symbols-outlined leading-none" style={{ fontSize: tam, fontVariationSettings: relleno ? "'FILL' 1" : undefined }}>
        {nombre}
      </span>
    </span>
  )
}

/** Cifra que cuenta hasta su valor al cambiar. */
function Contador({ valor, reducir }: { valor: number; reducir: boolean }) {
  const [n, setN] = useState(valor)
  const previo = useRef(valor)
  useEffect(() => {
    const desde = previo.current
    previo.current = valor
    if (reducir) {
      const id = requestAnimationFrame(() => setN(valor))
      return () => cancelAnimationFrame(id)
    }
    const c = animate(desde, valor, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [valor, reducir])
  return <span className="tabular-nums">{n.toLocaleString('es-ES')}</span>
}

/** Destellos que salen de la tarjeta al elegirla. */
function Estallido({ color }: { color: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2
        const dist = 4.2 + (i % 3) * 1.4
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-[38%] block rounded-full"
            style={{ width: i % 2 ? '0.45rem' : '0.3rem', height: i % 2 ? '0.45rem' : '0.3rem', background: i % 3 === 0 ? INK : color, marginLeft: '-0.2rem' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: `${Math.cos(ang) * dist}rem`, y: `${Math.sin(ang) * dist}rem`, opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          />
        )
      })}
    </span>
  )
}

function TarjetaPlan({
  plan,
  activo,
  indice,
  reducir,
  estallido,
  onElegir,
  refBoton,
}: {
  plan: Plan
  activo: boolean
  indice: number
  reducir: boolean
  estallido: number
  onElegir: () => void
  refBoton: (el: HTMLButtonElement | null) => void
}) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const brilloX = useMotionValue(50)
  const brilloY = useMotionValue(30)
  const srx = useSpring(rx, { stiffness: 180, damping: 16 })
  const sry = useSpring(ry, { stiffness: 180, damping: 16 })
  const brillo = useMotionTemplate`radial-gradient(circle at ${brilloX}% ${brilloY}%, rgba(255,255,255,0.65), transparent 50%)`
  const sombra = useTransform([srx, sry], ([a, b]: number[]) => `${4 - (b as number) * 0.5}px ${4 + (a as number) * 0.5}px 0 0 ${INK}`)
  const pro = plan.id === 'pro'

  const mover = (e: PointerEvent<HTMLButtonElement>) => {
    if (reducir || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    ry.set((px - 0.5) * 12)
    rx.set(-(py - 0.5) * 12)
    brilloX.set(px * 100)
    brilloY.set(py * 100)
  }
  const salir = () => {
    rx.set(0)
    ry.set(0)
  }

  return (
    <motion.div
      className="relative"
      style={{ perspective: '60rem' }}
      initial={reducir ? false : { opacity: 0, y: 24, rotate: indice === 0 ? -2 : indice === 2 ? 2 : 0 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 18, delay: reducir ? 0 : 0.08 * indice }}
    >
      {/* Pro elegido: un borde de luz que gira alrededor de la tarjeta. */}
      {pro && activo && !reducir && (
        <span aria-hidden className="pointer-events-none absolute -inset-[0.7rem] overflow-hidden rounded-[2.1rem] opacity-90 blur-[2px]">
          <motion.span
            className="absolute block"
            style={{ left: '-50%', top: '-50%', width: '200%', height: '200%', background: 'conic-gradient(from 0deg, #E8A598, #F6D6A8, #C4655A, #F2B8AE, #E8A598)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          />
        </span>
      )}

      {pro && (
        <motion.span
          className="absolute -top-3 right-5 z-30 rounded-full px-2.5 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white"
          style={{ background: plan.tinta, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
          animate={reducir ? undefined : { y: [0, -3, 0], rotate: [0, -2, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          Recomendado
        </motion.span>
      )}

      <motion.button
        ref={refBoton}
        type="button"
        role="radio"
        aria-checked={activo}
        tabIndex={activo ? 0 : -1}
        data-plan={plan.id}
        onClick={onElegir}
        onPointerMove={mover}
        onPointerLeave={salir}
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.6rem] bg-white p-5 text-left outline-none focus-visible:ring-4 focus-visible:ring-[#E8A598]/50"
        style={{
          rotateX: srx,
          rotateY: sry,
          transformStyle: 'preserve-3d',
          border: `2px solid ${activo ? INK : '#E3DCD8'}`,
          boxShadow: activo ? sombra : 'none',
          ...plan.textura,
        }}
        animate={{ scale: activo ? 1.03 : 1, opacity: activo ? 1 : 0.86, filter: activo ? 'saturate(1)' : 'saturate(0.55)' }}
        whileHover={reducir ? undefined : { opacity: 1, filter: 'saturate(1)' }}
        whileTap={reducir ? undefined : { scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        {/* Brillo que sigue al puntero. */}
        {!reducir && <motion.span aria-hidden className="pointer-events-none absolute inset-0 opacity-70 mix-blend-soft-light" style={{ background: brillo }} />}
        {/* El tinte del plan, que entra al elegirla. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${plan.fondo} 0%, rgba(255,255,255,0) 70%)` }}
          animate={{ opacity: activo ? 1 : 0 }}
        />

        <span className="relative z-10 flex items-center gap-2.5">
          <motion.span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
            style={{ background: plan.fondo, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
            animate={activo && !reducir ? { rotate: [0, -10, 8, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
            transition={{ duration: 0.55 }}
          >
            <Icono nombre={plan.icono} color={plan.tinta} tam="1.4rem" relleno={activo} />
          </motion.span>
          <span className="text-[1.55rem] font-black leading-none text-[#2C3E50]">{plan.nombre}</span>
          {/* La marca de la elegida salta de una tarjeta a otra. */}
          <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ border: `2px solid ${activo ? INK : '#D9D2CE'}` }}>
            {activo && (
              <motion.span
                layoutId="plan-marca"
                className="grid h-full w-full place-items-center rounded-full"
                style={{ background: plan.tinta }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <Icono nombre="check" color="#fff" tam="1.05rem" />
              </motion.span>
            )}
          </span>
        </span>

        <span className="relative z-10 mt-2 block min-h-[2.5rem] text-[0.88rem] leading-snug text-[#5D6A76]">{plan.lema}</span>

        <span className="relative z-10 mt-3 flex items-baseline gap-1.5">
          <span className="text-[2rem] font-black leading-none" style={{ color: plan.tinta }}>
            {plan.precio}
          </span>
          <span className="text-[0.8rem] font-bold text-[#7D8A96]">{plan.detalle}</span>
        </span>

        <span
          className="relative z-10 mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[0.75rem] font-extrabold"
          style={{ border: `2px solid ${plan.creditos ? INK : '#D9D2CE'}`, color: plan.creditos ? '#2C3E50' : '#7D8A96' }}
        >
          <Icono nombre={plan.creditos ? 'toll' : 'block'} color={plan.creditos ? plan.tinta : '#9AA5AF'} tam="1rem" />
          {plan.ia}
        </span>
        {pro && <span className="relative z-10 mt-2 block text-[0.72rem] font-bold text-[#7D8A96]">7 días de prueba · +300 de regalo el primer mes</span>}

        <AnimatePresence>{activo && estallido > 0 && !reducir && <Estallido key={estallido} color={plan.color} />}</AnimatePresence>
      </motion.button>
    </motion.div>
  )
}

export default function PasoPlan({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const reducir = !!useReducedMotion()
  const [elegido, setElegido] = useState<PlanElegido>(() => (typeof window === 'undefined' ? null : leerPlanElegido()) ?? 'pro')
  const [estallido, setEstallido] = useState(0)
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const plan = PLANES.find((p) => p.id === elegido) ?? PLANES[2]
  const nivel = NIVEL[elegido]
  const incluidas = FUNCIONES.filter((f) => NIVEL[f.desde] <= nivel).length

  const elegir = (p: PlanElegido) => {
    if (p !== elegido) setEstallido((n) => n + 1)
    setElegido(p)
    guardarPlanElegido(p)
  }

  // Flechas para moverse entre planes (como un grupo de radios); Intro sigue adelante.
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = PLANES.findIndex((p) => p.id === elegido)
    const ir = (j: number) => {
      e.preventDefault()
      const k = (j + PLANES.length) % PLANES.length
      elegir(PLANES[k].id)
      botones.current[k]?.focus()
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ir(i + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ir(i - 1)
  }

  return (
    <section className="relative space-y-7" data-paso-plan>
      {/* Halo del color del plan, detrás de todo. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-0 rounded-[2rem]"
        animate={{ background: `radial-gradient(60% 50% at 50% 0%, ${plan.fondo} 0%, rgba(255,255,255,0) 70%)` }}
        transition={{ duration: 0.6 }}
      />

      {/* Cabecera: el fago cambia de pose y de frase con el plan. */}
      <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:justify-center sm:text-left">
        <div className="relative h-[8.5rem] w-[8.5rem] shrink-0 sm:-mb-2">
          {/* Sin modo «wait»: la pose nueva entra mientras sale la vieja (con clics seguidos no se atasca). */}
          <AnimatePresence initial={false}>
            <motion.div
              key={plan.pose}
              className="absolute inset-0"
              initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -12, y: 10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              exit={reducir ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, scale: 0.7, rotate: 10, transition: { duration: 0.2, ease: 'easeIn' } }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <motion.div
                className="relative h-full w-full"
                animate={reducir ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Image src={plan.pose} alt="" fill sizes="136px" className="object-contain drop-shadow-[0_6px_10px_rgba(44,62,80,0.18)]" priority />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="min-w-0 max-w-xl">
          <h2 className="text-[2rem] font-black leading-tight tracking-tight text-[#2C3E50] md:text-[2.4rem]">Elige tu plan</h2>
          <div className="relative mt-2 min-h-[3.4rem] rounded-2xl bg-white px-4 py-2.5 text-[0.92rem] text-[#2C3E50]" style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}>
            {/* El pico del bocadillo, hacia el fago. */}
            <span
              aria-hidden
              className="absolute -left-[0.55rem] bottom-3 hidden h-4 w-4 rotate-45 bg-white sm:block"
              style={{ borderLeft: `2px solid ${INK}`, borderBottom: `2px solid ${INK}` }}
            />
            {/* Las frases se apilan en la misma celda: la nueva entra mientras sale la vieja. */}
            <div className="grid">
              <AnimatePresence initial={false}>
                <motion.p
                  key={plan.id}
                  style={{ gridArea: '1 / 1' }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  {plan.frase}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="relative grid gap-4 md:grid-cols-3 md:gap-5" role="radiogroup" aria-label="Plan" onKeyDown={teclado}>
        {PLANES.map((p, k) => (
          <TarjetaPlan
            key={p.id}
            plan={p}
            activo={elegido === p.id}
            indice={k}
            reducir={reducir}
            estallido={elegido === p.id ? estallido : 0}
            onElegir={() => elegir(p.id)}
            refBoton={(el) => {
              botones.current[k] = el
            }}
          />
        ))}
      </div>

      {/* Lo que desbloqueas: se enciende con el plan. */}
      <div className="relative rounded-[1.6rem] bg-white p-4 sm:p-5" style={{ border: `2px solid ${INK}` }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-[#7D8A96]">Lo que desbloqueas</p>
          <p className="text-[0.85rem] font-extrabold text-[#2C3E50]">
            <span style={{ color: plan.tinta }}>
              <Contador valor={incluidas} reducir={reducir} />
            </span>{' '}
            de {FUNCIONES.length}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {FUNCIONES.map((f, i) => {
            const dentro = NIVEL[f.desde] <= nivel
            const prueba = !dentro && f.pruebaEnPlus && elegido === 'plus'
            const encendida = dentro || prueba
            return (
              <motion.div
                key={f.nombre}
                className="relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-[0.8rem] font-bold"
                animate={{
                  backgroundColor: dentro ? plan.fondo : prueba ? '#F5F8F4' : '#F6F4F3',
                  color: encendida ? '#2C3E50' : '#A8B0B7',
                  scale: dentro ? 1 : 0.97,
                }}
                transition={{ duration: 0.3, delay: reducir ? 0 : i * 0.035 }}
                style={{ borderWidth: 2, borderColor: dentro ? INK : prueba ? '#9DBF99' : 'transparent', borderStyle: prueba ? 'dashed' : 'solid' }}
              >
                <motion.span
                  key={`${f.nombre}-${encendida}`}
                  initial={reducir || !encendida ? false : { scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16, delay: reducir ? 0 : i * 0.035 }}
                  className="inline-block"
                >
                  <Icono nombre={encendida ? f.icono : 'lock'} color={dentro ? plan.tinta : prueba ? '#5E8C5A' : '#B8BFC5'} tam="1.1rem" relleno={dentro} />
                </motion.span>
                <span className="min-w-0 leading-tight">
                  {f.nombre}
                  {prueba && <span className="block text-[0.66rem] font-extrabold text-[#5E8C5A]">Para probar</span>}
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* Los créditos de IA del mes, con lo que dan de sí. */}
        <div className="mt-4 rounded-2xl bg-[#FAF7F4] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[0.85rem]">
            <span className="flex items-center gap-1.5 font-extrabold text-[#2C3E50]">
              <Icono nombre="toll" color={plan.tinta} tam="1.05rem" />
              {plan.creditos ? (
                <>
                  <Contador valor={plan.creditos} reducir={reducir} /> créditos de IA al mes
                </>
              ) : (
                'Sin IA'
              )}
            </span>
            <span className="text-[0.78rem] text-[#7D8A96]">
              {plan.creditos
                ? `≈ ${Math.floor(plan.creditos / CREDITOS_POR_TEMA)} temas con mapa, flashcards y resumen`
                : 'Las herramientas y la IA, en Plus y Pro'}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#ECE6E2]" style={{ border: `2px solid ${INK}` }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundImage: `repeating-linear-gradient(45deg, ${plan.color} 0 0.5rem, ${plan.tinta} 0.5rem 1rem)` }}
              animate={{ width: `${Math.max(0, (plan.creditos / 700) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            />
          </div>
        </div>
      </div>

      <p className="relative text-center text-[0.78rem] text-[#7D8A96]">
        Durante la beta todo es gratis y elegir un plan todavía no cambia nada. Puedes cambiarlo cuando quieras; estudiar con lo que ya has creado nunca gasta créditos.
      </p>

      <div className="relative flex w-full items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Atrás
        </button>
        <motion.button
          type="button"
          onClick={onNext}
          className="group relative flex items-center gap-2 overflow-hidden rounded-2xl px-6 py-3 text-base font-black text-white"
          style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}
          animate={{ backgroundColor: plan.tinta }}
          whileHover={reducir ? undefined : { y: -2 }}
          whileTap={reducir ? undefined : { y: 1 }}
          data-continuar-plan
        >
          {!reducir && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 block w-12"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)', left: 0 }}
              animate={{ x: ['-4rem', '16rem'] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
            />
          )}
          <span className="relative">Continuar con {plan.nombre}</span>
          <span className="material-symbols-outlined relative transition-transform group-hover:translate-x-1">arrow_forward</span>
        </motion.button>
      </div>
    </section>
  )
}
