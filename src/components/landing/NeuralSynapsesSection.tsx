'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion'

/* ────────────────────────────────────────────────────────────────────────
   Sinapsis — sección scrollytelling de la landing clásica.
   Una neurona central crece con el scroll, ramifica dendritas y conecta
   tres tarjetas sobre cómo la rutina diaria consolida el conocimiento.
   Todo el progreso narrativo está ligado a scrollYProgress (reversible);
   solo la "respiración" ambiental es una animación CSS continua.
   Paleta derivada de la landing (crema/coral/tinta), expuesta como
   variables CSS semánticas en el propio <section>.
   ──────────────────────────────────────────────────────────────────────── */

const INK = 'rgba(17, 24, 39, 0.85)'

type Range = [number, number]

type PathSpec = {
  d: string
  range: Range
  /** card: conexión a tarjeta · link: neurona↔neurona · peri/fine: decorativas */
  kind: 'card' | 'link' | 'peri' | 'fine'
  pulse?: boolean
}

type NodeSpec = {
  x: number
  y: number
  size: number
  range: Range
}

type CardSpec = {
  icon: string
  title: string
  description: string
  cx: number
  cy: number
  w: number
  port: { x: number; y: number }
  range: Range
}

type Layout = {
  viewBox: { w: number; h: number }
  /** Estilo del escenario para que el % de las tarjetas case con el viewBox */
  stageStyle: React.CSSProperties
  nucleus: { x: number; y: number; size: number }
  fadeCenter: { x: number; y: number; r: number }
  nodes: NodeSpec[]
  paths: PathSpec[]
  strokes: Record<PathSpec['kind'], number>
  cards: CardSpec[]
}

const CARD_COPY = [
  {
    icon: 'today',
    title: 'La chispa diaria',
    description:
      'Cada pregunta de tu Daily activa un concepto y enciende la primera conexión.',
  },
  {
    icon: 'style',
    title: 'El repaso que refuerza',
    description:
      'Las flashcards reactivan la ruta justo antes de que se debilite. Eso es la repetición espaciada.',
  },
  {
    icon: 'hub',
    title: 'Conocimiento en red',
    description:
      'Con la constancia, los conceptos sueltos se convierten en una red que responde sola el día del examen.',
  },
]

const DESKTOP: Layout = {
  viewBox: { w: 1200, h: 675 },
  stageStyle: {
    aspectRatio: '1200 / 675',
    width: 'min(72rem, 100%, calc((100svh - 240px) * 1.68))',
  },
  nucleus: { x: 600, y: 330, size: 76 },
  fadeCenter: { x: 600, y: 330, r: 660 },
  nodes: [
    { x: 560, y: 455, size: 26, range: [0.3, 0.36] },
    { x: 800, y: 170, size: 24, range: [0.34, 0.4] },
    { x: 880, y: 480, size: 22, range: [0.56, 0.62] },
  ],
  paths: [
    // Núcleo → tarjeta A
    { d: 'M600,330 C520,305 425,260 338,225', range: [0.1, 0.26], kind: 'card', pulse: true },
    // Núcleo → neuronas secundarias
    { d: 'M600,330 C588,372 576,414 560,455', range: [0.16, 0.32], kind: 'link' },
    { d: 'M600,330 C660,285 730,225 800,170', range: [0.2, 0.36], kind: 'link' },
    // Secundarias → tarjetas B y C
    { d: 'M800,170 C832,192 842,224 838,260', range: [0.4, 0.52], kind: 'card', pulse: true },
    { d: 'M560,455 C525,462 488,464 452,468', range: [0.46, 0.58], kind: 'card', pulse: true },
    // Núcleo → tercera neurona
    { d: 'M600,330 C690,375 800,430 880,480', range: [0.44, 0.58], kind: 'link' },
    // Periferia desde las secundarias
    { d: 'M560,455 C480,520 400,585 330,645', range: [0.6, 0.76], kind: 'peri' },
    { d: 'M560,455 C440,452 290,442 150,430', range: [0.64, 0.82], kind: 'peri' },
    { d: 'M800,170 C855,130 920,95 990,70', range: [0.62, 0.78], kind: 'peri' },
    { d: 'M800,170 C890,160 995,150 1090,150', range: [0.66, 0.84], kind: 'peri' },
    { d: 'M880,480 C940,520 1000,565 1055,610', range: [0.68, 0.84], kind: 'peri' },
    { d: 'M880,480 C850,545 815,600 790,650', range: [0.72, 0.88], kind: 'peri' },
    // Ramas finas que se funden con el fondo
    { d: 'M600,330 C615,245 600,155 625,80', range: [0.7, 0.9], kind: 'fine' },
    { d: 'M600,330 C500,345 350,350 210,360', range: [0.74, 0.94], kind: 'fine' },
    { d: 'M600,330 C640,400 660,470 650,560', range: [0.78, 0.96], kind: 'fine' },
  ],
  strokes: { card: 2.4, link: 1.8, peri: 1.2, fine: 0.9 },
  cards: [
    { ...CARD_COPY[0], cx: 204, cy: 212, w: 264, port: { x: 338, y: 225 }, range: [0.24, 0.34] },
    { ...CARD_COPY[1], cx: 972, cy: 262, w: 264, port: { x: 838, y: 262 }, range: [0.5, 0.6] },
    { ...CARD_COPY[2], cx: 400, cy: 545, w: 264, port: { x: 452, y: 468 }, range: [0.56, 0.66] },
  ],
}

const MOBILE: Layout = {
  viewBox: { w: 390, h: 780 },
  stageStyle: {
    aspectRatio: '390 / 780',
    width: 'min(100%, calc((100svh - 200px) * 0.5))',
  },
  nucleus: { x: 195, y: 120, size: 56 },
  fadeCenter: { x: 195, y: 360, r: 520 },
  nodes: [
    { x: 48, y: 340, size: 20, range: [0.32, 0.38] },
    { x: 345, y: 430, size: 20, range: [0.38, 0.44] },
  ],
  paths: [
    // Núcleo → tarjeta A
    { d: 'M195,120 C165,160 215,210 195,251', range: [0.08, 0.22], kind: 'card', pulse: true },
    // Núcleo → neuronas secundarias (por los laterales)
    { d: 'M195,120 C125,150 70,230 48,340', range: [0.18, 0.34], kind: 'link' },
    { d: 'M195,120 C275,165 330,290 345,430', range: [0.24, 0.4], kind: 'link' },
    // Secundarias → tarjetas B y C
    { d: 'M48,340 C40,400 42,465 61,508', range: [0.38, 0.52], kind: 'card', pulse: true },
    { d: 'M345,430 C352,520 350,610 329,688', range: [0.46, 0.6], kind: 'card', pulse: true },
    // Periferia reducida
    { d: 'M48,340 C25,430 15,515 20,600', range: [0.62, 0.8], kind: 'peri' },
    { d: 'M345,430 C365,470 372,515 375,560', range: [0.66, 0.84], kind: 'peri' },
    // Ramas finas
    { d: 'M195,120 C150,70 110,45 70,30', range: [0.7, 0.88], kind: 'fine' },
    { d: 'M195,120 C245,75 290,55 330,35', range: [0.76, 0.94], kind: 'fine' },
  ],
  strokes: { card: 2, link: 1.6, peri: 1.1, fine: 0.9 },
  cards: [
    { ...CARD_COPY[0], cx: 195, cy: 320, w: 264, port: { x: 195, y: 253 }, range: [0.2, 0.3] },
    { ...CARD_COPY[1], cx: 195, cy: 510, w: 264, port: { x: 63, y: 510 }, range: [0.5, 0.6] },
    { ...CARD_COPY[2], cx: 195, cy: 690, w: 264, port: { x: 327, y: 690 }, range: [0.58, 0.68] },
  ],
}

const SECTION_CSS = `
.neuro-section {
  --neuro-core: #D4978C;
  --neuro-core-deep: #B87A6F;
  --neuro-branch: #B87A6F;
  --neuro-branch-soft: #C99A8F;
  --neuro-peri: #D9BDB4;
  --neuro-halo: rgba(212, 151, 140, 0.16);
  --neuro-pulse: #FBEFE9;
  --neuro-node-from: #FFF6F2;
  --neuro-node-to: #F3D9CF;
  --neuro-ink: rgba(17, 24, 39, 0.85);
  --neuro-glow: rgba(212, 151, 140, 0.45);
}
.neuro-breathe {
  animation: neuroBreathe 4.6s ease-in-out infinite;
}
.neuro-core-glow {
  animation: neuroGlow 4.6s ease-in-out infinite;
}
.neuro-pulse-path {
  stroke-dasharray: 0.12 0.88;
  animation: neuroPulse 3.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
.neuro-port-ping {
  animation: neuroPing 2.8s ease-out infinite;
}
@keyframes neuroBreathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.045); }
}
@keyframes neuroGlow {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
@keyframes neuroPulse {
  0% { stroke-dashoffset: 1.12; }
  55% { stroke-dashoffset: -0.12; }
  100% { stroke-dashoffset: -0.12; }
}
@keyframes neuroPing {
  0% { transform: scale(0.6); opacity: 0.8; }
  70% { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .neuro-breathe,
  .neuro-core-glow,
  .neuro-port-ping {
    animation: none;
  }
  .neuro-pulse-path {
    animation: none;
    opacity: 0 !important;
  }
}
`

/* ─── Rama de dendrita (trazo + halo + pulso opcional) ─────────────────── */

function Dendrite({
  spec,
  strokes,
  progress,
}: {
  spec: PathSpec
  strokes: Layout['strokes']
  progress: MotionValue<number>
}) {
  const pathLength = useTransform(progress, spec.range, [0, 1])
  const pulseOpacity = useTransform(
    progress,
    [spec.range[1], spec.range[1] + 0.04],
    [0, 0.9],
  )

  const stroke =
    spec.kind === 'card'
      ? 'var(--neuro-branch)'
      : spec.kind === 'link'
        ? 'var(--neuro-branch-soft)'
        : 'var(--neuro-peri)'
  const strokeOpacity = spec.kind === 'peri' ? 0.55 : spec.kind === 'fine' ? 0.35 : 1

  return (
    <g>
      {(spec.kind === 'card' || spec.kind === 'link') && (
        <motion.path
          d={spec.d}
          fill="none"
          stroke="var(--neuro-halo)"
          strokeWidth={strokes[spec.kind] * 3.4}
          strokeLinecap="round"
          style={{ pathLength }}
        />
      )}
      <motion.path
        d={spec.d}
        fill="none"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={strokes[spec.kind]}
        strokeLinecap="round"
        style={{ pathLength }}
      />
      {spec.pulse && (
        <motion.path
          className="neuro-pulse-path"
          d={spec.d}
          pathLength={1}
          fill="none"
          stroke="var(--neuro-pulse)"
          strokeWidth={strokes[spec.kind] * 1.5}
          strokeLinecap="round"
          style={{ opacity: pulseOpacity, animationDelay: `${spec.range[0] * 4}s` }}
        />
      )}
    </g>
  )
}

/* ─── Neurona secundaria ───────────────────────────────────────────────── */

function SecondaryNeuron({
  node,
  layout,
  progress,
}: {
  node: NodeSpec
  layout: Layout
  progress: MotionValue<number>
}) {
  const scale = useTransform(progress, node.range, [0, 1])
  const opacity = useTransform(progress, node.range, [0, 1])

  return (
    <motion.div
      aria-hidden="true"
      className="absolute z-10"
      style={{
        left: `${(node.x / layout.viewBox.w) * 100}%`,
        top: `${(node.y / layout.viewBox.h) * 100}%`,
        width: node.size,
        height: node.size,
        x: '-50%',
        y: '-50%',
        scale,
        opacity,
      }}
    >
      <div
        className="neuro-breathe h-full w-full rounded-full border-2"
        style={{
          borderColor: 'var(--neuro-ink)',
          background:
            'radial-gradient(circle at 35% 32%, var(--neuro-node-from), var(--neuro-node-to))',
          boxShadow: '0 0 14px 2px var(--neuro-glow)',
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'var(--neuro-core-deep)' }}
        />
      </div>
    </motion.div>
  )
}

/* ─── Tarjeta conectada a la red ───────────────────────────────────────── */

function NeuralCard({
  card,
  layout,
  progress,
}: {
  card: CardSpec
  layout: Layout
  progress: MotionValue<number>
}) {
  const opacity = useTransform(progress, card.range, [0.3, 1])
  const y = useTransform(progress, card.range, [14, 0])
  const scale = useTransform(progress, card.range, [0.96, 1])
  const borderColor = useTransform(progress, card.range, ['#E5DED6', INK])
  const boxShadow = useTransform(progress, card.range, [
    '0 0 0 0 rgba(184, 122, 111, 0)',
    '0 20px 44px -20px rgba(184, 122, 111, 0.4)',
  ])

  const portScale = useTransform(
    progress,
    [card.range[0] - 0.02, card.range[0] + 0.04],
    [0, 1],
  )
  const pingOpacity = useTransform(
    progress,
    [card.range[0], card.range[0] + 0.05],
    [0, 1],
  )

  return (
    <>
      <motion.div
        className="absolute z-20 rounded-3xl border-2 bg-white p-4 md:p-5"
        style={{
          left: `${(card.cx / layout.viewBox.w) * 100}%`,
          top: `${(card.cy / layout.viewBox.h) * 100}%`,
          width: `${(card.w / layout.viewBox.w) * 100}%`,
          x: '-50%',
          y: '-50%',
          translateY: y,
          opacity,
          scale,
          borderColor,
          boxShadow,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#8C5F56]"
            style={{ background: '#F3D9CF' }}
          >
            <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
          </span>
          <h3 className="text-sm font-bold text-[#171312] md:text-base">{card.title}</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#5C554F] md:text-[13px]">
          {card.description}
        </p>
      </motion.div>

      {/* Puerto receptor en el borde de la tarjeta */}
      <motion.div
        aria-hidden="true"
        className="absolute z-30"
        style={{
          left: `${(card.port.x / layout.viewBox.w) * 100}%`,
          top: `${(card.port.y / layout.viewBox.h) * 100}%`,
          x: '-50%',
          y: '-50%',
          scale: portScale,
        }}
      >
        <motion.span
          className="neuro-port-ping absolute inset-0 rounded-full"
          style={{ background: 'var(--neuro-core)', opacity: pingOpacity }}
        />
        <span
          className="relative block h-3 w-3 rounded-full border-2"
          style={{
            borderColor: 'var(--neuro-ink)',
            background: 'var(--neuro-core)',
            boxShadow: '0 0 10px 2px var(--neuro-glow)',
          }}
        />
      </motion.div>
    </>
  )
}

/* ─── Sección ──────────────────────────────────────────────────────────── */

export default function NeuralSynapsesSection() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  })
  // Con movimiento reducido la red se muestra completa y estática.
  const staticProgress = useMotionValue(1)
  const progress = reducedMotion ? staticProgress : scrollYProgress

  const layout = isDesktop ? DESKTOP : MOBILE
  const { viewBox, nucleus } = layout

  const nucleusScale = useTransform(progress, [0, 0.09], [0.4, 1])
  const nucleusOpacity = useTransform(progress, [0, 0.08], [0.12, 1])
  const glowOpacity = useTransform(progress, [0, 0.1], [0, 1])

  return (
    <section
      ref={wrapperRef}
      className="neuro-section relative h-[300vh] md:h-[400vh]"
      aria-label="Cómo tu rutina diaria construye una red de conocimiento"
    >
      <style>{SECTION_CSS}</style>

      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="shrink-0 px-6 pb-2 pt-24 text-center md:pt-24">
          <span className="mb-3 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
            Así aprende tu cerebro
          </span>
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Cada Daily deja <span className="text-[#B87A6F]">una conexión nueva</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#5C554F] md:text-base">
            Sigue bajando: la red crece contigo, pregunta a pregunta.
          </p>
        </div>

        {/* Escenario */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
          <div className="relative max-h-full" style={layout.stageStyle}>
            {/* Dendritas */}
            <svg
              aria-hidden="true"
              focusable="false"
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <radialGradient
                  id="neuroFadeGradient"
                  gradientUnits="userSpaceOnUse"
                  cx={layout.fadeCenter.x}
                  cy={layout.fadeCenter.y}
                  r={layout.fadeCenter.r}
                >
                  <stop offset="45%" stopColor="#fff" stopOpacity="1" />
                  <stop offset="80%" stopColor="#fff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <mask id="neuroFadeMask">
                  <rect
                    width={viewBox.w}
                    height={viewBox.h}
                    fill="url(#neuroFadeGradient)"
                  />
                </mask>
              </defs>

              {/* Conexiones principales, sin máscara: nítidas */}
              {layout.paths
                .filter((p) => p.kind === 'card' || p.kind === 'link')
                .map((spec) => (
                  <Dendrite
                    key={spec.d}
                    spec={spec}
                    strokes={layout.strokes}
                    progress={progress}
                  />
                ))}

              {/* Periferia: se funde con el fondo */}
              <g mask="url(#neuroFadeMask)">
                {layout.paths
                  .filter((p) => p.kind === 'peri' || p.kind === 'fine')
                  .map((spec) => (
                    <Dendrite
                      key={spec.d}
                      spec={spec}
                      strokes={layout.strokes}
                      progress={progress}
                    />
                  ))}
              </g>
            </svg>

            {/* Núcleo protagonista */}
            <motion.div
              aria-hidden="true"
              className="absolute z-10"
              style={{
                left: `${(nucleus.x / viewBox.w) * 100}%`,
                top: `${(nucleus.y / viewBox.h) * 100}%`,
                width: nucleus.size,
                height: nucleus.size,
                x: '-50%',
                y: '-50%',
                scale: nucleusScale,
                opacity: nucleusOpacity,
              }}
            >
              <motion.div
                className="neuro-core-glow absolute -inset-3 rounded-full"
                style={{
                  opacity: glowOpacity,
                  boxShadow: '0 0 44px 10px var(--neuro-glow)',
                }}
              />
              <div
                className="neuro-breathe relative h-full w-full rounded-full border-2"
                style={{
                  borderColor: 'var(--neuro-ink)',
                  background:
                    'radial-gradient(circle at 35% 30%, var(--neuro-node-from), var(--neuro-node-to))',
                }}
              >
                <div
                  className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full md:h-5 md:w-5"
                  style={{
                    background: 'var(--neuro-core-deep)',
                    boxShadow: '0 0 12px 3px var(--neuro-glow)',
                  }}
                />
              </div>
            </motion.div>

            {/* Neuronas secundarias */}
            {layout.nodes.map((node) => (
              <SecondaryNeuron
                key={`${node.x}-${node.y}`}
                node={node}
                layout={layout}
                progress={progress}
              />
            ))}

            {/* Tarjetas conectadas */}
            {layout.cards.map((card) => (
              <NeuralCard
                key={card.title}
                card={card}
                layout={layout}
                progress={progress}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
