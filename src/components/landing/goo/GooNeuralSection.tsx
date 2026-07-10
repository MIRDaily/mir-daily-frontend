'use client'

import { useEffect, useRef, useState } from 'react'
import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion'
import { GooScene, type GooLayoutName } from './GooScene'

/* ────────────────────────────────────────────────────────────────────────
   Sección «Goo» — organismo neuronal 3D manipulable.
   El scroll (sticky + useScroll) gobierna el crecimiento de la red WebGL;
   el puntero deforma, agarra, estira, rompe y deja reconectarse.
   Las tarjetas son HTML real por encima del canvas. Sus estilos ligados al
   scroll se escriben directamente en el DOM desde onProgress de la escena:
   la landing clásica re-renderiza el árbol cada pocos segundos (visuales
   con setInterval) y los MotionValues por tarjeta perdían el enlace.
   ──────────────────────────────────────────────────────────────────────── */

const INK = 'rgba(17, 24, 39, 0.85)'

// Paleta inferida de la landing clásica (crema/coral), pasada a la escena
const PALETTE = {
  bg: '#FAF7F4',
  primary: '#D4978C',
  deep: '#B87A6F',
  blush: '#F3D9CF',
  light: '#FFF6F2',
}

type CardDef = {
  icon: string
  title: string
  description: string
  /** posición del centro en % del escenario */
  pos: { left: string; top: string }
  /** lado de la tarjeta donde vive el puerto */
  portSide: 'left' | 'right'
  range: [number, number]
}

const CARD_COPY = [
  {
    icon: 'today',
    title: 'La chispa diaria',
    description: 'Cada pregunta de tu Daily activa un concepto y enciende la primera conexión.',
  },
  {
    icon: 'style',
    title: 'El repaso que refuerza',
    description: 'Las flashcards reactivan la ruta justo antes de que se debilite. Repetición espaciada de verdad.',
  },
  {
    icon: 'hub',
    title: 'Conocimiento en red',
    description: 'Con la constancia, los conceptos sueltos se convierten en una red que responde sola el día del examen.',
  },
]

// range empieza cuando el tentáculo hace contacto (fin del reveal de su cuerda)
const DESKTOP_CARDS: CardDef[] = [
  { ...CARD_COPY[0], pos: { left: '74%', top: '22%' }, portSide: 'left', range: [0.45, 0.53] },
  { ...CARD_COPY[1], pos: { left: '78%', top: '66%' }, portSide: 'left', range: [0.74, 0.82] },
  { ...CARD_COPY[2], pos: { left: '18%', top: '78%' }, portSide: 'right', range: [0.67, 0.75] },
]

const MOBILE_CARDS: CardDef[] = [
  { ...CARD_COPY[0], pos: { left: '58%', top: '38%' }, portSide: 'left', range: [0.43, 0.51] },
  { ...CARD_COPY[1], pos: { left: '46%', top: '60%' }, portSide: 'right', range: [0.61, 0.69] },
  { ...CARD_COPY[2], pos: { left: '54%', top: '82%' }, portSide: 'right', range: [0.73, 0.81] },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))

export default function GooNeuralSection() {
  const wrapperRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const cardOuterEls = useRef<(HTMLDivElement | null)[]>([])
  const cardTugEls = useRef<(HTMLDivElement | null)[]>([])
  const cardBodyEls = useRef<(HTMLDivElement | null)[]>([])
  const portEls = useRef<(HTMLSpanElement | null)[]>([])
  const sceneRef = useRef<GooScene | null>(null)

  const reducedMotion = useReducedMotion()
  const [layout, setLayout] = useState<GooLayoutName>('desktop')
  const [webglFailed, setWebglFailed] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setLayout(mq.matches ? 'desktop' : 'mobile')
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  })
  const staticProgress = useMotionValue(1)
  const progress = reducedMotion ? staticProgress : scrollYProgress

  useMotionValueEvent(progress, 'change', (v) => sceneRef.current?.setProgress(v))

  const cards = layout === 'desktop' ? DESKTOP_CARDS : MOBILE_CARDS

  // Estilos scroll-linked escritos directamente en el DOM (sin estado React)
  const applyProgressStyles = (p: number, defs: CardDef[]) => {
    defs.forEach((card, i) => {
      const a = ramp(p, card.range[0], card.range[1])
      const outer = cardOuterEls.current[i]
      const body = cardBodyEls.current[i]
      const port = portEls.current[i]
      if (outer) {
        // invisible hasta que el tentáculo hace contacto
        outer.style.opacity = String(a)
        outer.style.transform = `scale(${0.92 + 0.08 * a})`
      }
      if (body) {
        body.style.borderColor = a > 0.55 ? INK : '#E5DED6'
        body.style.boxShadow =
          a > 0.55 ? '0 20px 44px -20px rgba(184, 122, 111, 0.45)' : '0 0 0 0 rgba(184, 122, 111, 0)'
      }
      if (port) port.style.opacity = String(ramp(p, card.range[0], card.range[0] + 0.04))
    })
    if (hintRef.current) {
      hintRef.current.style.opacity = String(
        Math.min(ramp(p, 0.12, 0.2), 1 - ramp(p, 0.85, 0.95)),
      )
    }
  }
  const applyRef = useRef(applyProgressStyles)
  applyRef.current = applyProgressStyles

  // Ciclo de vida de la escena WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !stage || !wrapper) return

    const defs = layout === 'desktop' ? DESKTOP_CARDS : MOBILE_CARDS
    let scene: GooScene
    try {
      scene = new GooScene({
        canvas,
        host: stage,
        layout,
        palette: PALETTE,
        reducedMotion: !!reducedMotion,
        onProgress: (p) => applyRef.current(p, defs),
        onCardTug: (card, dx, dy) => {
          const el = cardTugEls.current[card]
          if (el) el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`
        },
      })
    } catch {
      setWebglFailed(true)
      // sin WebGL: red estática de respaldo con las tarjetas activas
      applyRef.current(1, defs)
      return
    }
    sceneRef.current = scene
    scene.setProgress(progress.get())
    // con movimiento reducido la red y las tarjetas se muestran completas desde el inicio
    if (reducedMotion) applyRef.current(1, defs)
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as { __gooScene?: GooScene }).__gooScene = scene
    }

    const measurePorts = () => {
      const stageRect = stage.getBoundingClientRect()
      if (stageRect.width === 0) return
      const rels = portEls.current.map((el, i) => {
        // inx: hacia el interior de la tarjeta (mundo +x = derecha de pantalla)
        const inx = defs[i]?.portSide === 'left' ? 1 : -1
        if (!el) return { x: 0.5, y: 0.5, inx }
        const r = el.getBoundingClientRect()
        return {
          x: (r.left + r.width / 2 - stageRect.left) / stageRect.width,
          y: (r.top + r.height / 2 - stageRect.top) / stageRect.height,
          inx,
        }
      })
      scene.setPortsRel(rels)
    }

    const onResize = () => {
      scene.resize()
      measurePorts()
    }
    measurePorts()
    // segunda medición tras cargar fuentes/layout definitivo
    const t = setTimeout(measurePorts, 400)
    window.addEventListener('resize', onResize)

    // solo consume frames cuando la sección está a la vista
    const io = new IntersectionObserver(
      (entries) => scene.setRunning(entries[0]?.isIntersecting ?? false),
      { rootMargin: '100px' },
    )
    io.observe(wrapper)

    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
      io.disconnect()
      sceneRef.current = null
      scene.dispose()
    }
    // progress es estable entre renders; solo reconstruimos por layout/reduced-motion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, reducedMotion])

  return (
    <section
      ref={wrapperRef}
      className="relative h-[320vh] md:h-[420vh]"
      aria-label="Organismo neuronal interactivo: la red de tu conocimiento crece con la rutina diaria"
    >
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="pointer-events-none relative z-30 shrink-0 px-6 pb-2 pt-24 text-center">
          <span className="mb-3 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
            Así aprende tu cerebro
          </span>
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Materia gris, <span className="text-[#B87A6F]">literalmente viva</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#5C554F] md:text-base">
            Baja para verla crecer. Tócala: agárrala, estírala, rómpela… siempre vuelve a conectarse.
          </p>
        </div>

        {/* Escenario: canvas + tarjetas HTML */}
        <div
          ref={stageRef}
          className="relative min-h-0 flex-1"
          style={{ touchAction: 'pan-y' }}
        >
          {!webglFailed && (
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          )}
          {webglFailed && (
            // Fallback sin WebGL: masa suave estática con los colores de la landing
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(340px 260px at 32% 42%, rgba(212,151,140,0.5), transparent 70%), radial-gradient(200px 160px at 62% 28%, rgba(226,169,158,0.4), transparent 70%), radial-gradient(220px 180px at 48% 72%, rgba(243,217,207,0.55), transparent 70%)',
              }}
            />
          )}

          {cards.map((card, i) => (
            <div
              key={card.title}
              ref={(el) => {
                cardOuterEls.current[i] = el
              }}
              className="absolute z-20 w-[68%] max-w-[280px] -translate-x-1/2 -translate-y-1/2 md:w-[280px]"
              style={{
                left: card.pos.left,
                top: card.pos.top,
                opacity: 0,
                transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
              }}
            >
              {/* wrapper interno: la escena escribe aquí los tirones de la red */}
              <div
                ref={(el) => {
                  cardTugEls.current[i] = el
                }}
                style={{ willChange: 'transform' }}
              >
                <div
                  ref={(el) => {
                    cardBodyEls.current[i] = el
                  }}
                  className="relative rounded-3xl border-2 bg-white/95 p-4 backdrop-blur-sm md:p-5"
                  style={{
                    borderColor: '#E5DED6',
                    transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
                  }}
                >
                  <span
                    ref={(el) => {
                      portEls.current[i] = el
                    }}
                    aria-hidden="true"
                    className="absolute top-1/2 block h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2"
                    style={{
                      [card.portSide]: '-8px',
                      borderColor: INK,
                      background: PALETTE.primary,
                      boxShadow: '0 0 12px 3px rgba(212, 151, 140, 0.5)',
                      opacity: 0,
                    }}
                  />
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#8C5F56]"
                      style={{ background: PALETTE.blush }}
                    >
                      <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                    </span>
                    <h3 className="text-sm font-bold text-[#171312] md:text-base">{card.title}</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#5C554F] md:text-[13px]">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Pista de interacción */}
          <p
            ref={hintRef}
            className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-[#8C5F56] backdrop-blur-sm"
            style={{ opacity: 0 }}
          >
            <span className="material-symbols-outlined mr-1.5 align-[-4px] text-[16px]">touch_app</span>
            Agarra un filamento y estíralo hasta romperlo
          </p>
        </div>
      </div>
    </section>
  )
}
