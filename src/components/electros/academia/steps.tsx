'use client'

/* ════════════════════════════════════════════════════════════════════════
   Un componente por tipo de paso. Todos reciben su `step` ya tipado por la
   unión discriminada del currículo y avisan con `onSolved()` cuando el alumno
   completa la interacción (el reproductor habilita entonces "Continuar").

   Los pasos que solo hay que mirar (info, conduction, ladder, summary) los
   desbloquea el reproductor directamente, así que aquí no llaman a onSolved.

   Presentación: cada paso con ilustración usa `StepLayout`, que la coloca en
   un escenario grande a la izquierda y deja el texto y los controles a la
   derecha. En móvil se apila, pero el punto de partida es el escritorio.
═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { EcgTracer, phaseAt } from '@/lib/electros/academia/ecgmini'
import { isLeaf, TREES, WALLS, type LeafNode } from '@/lib/electros/academia/algorithms'
import { LEAD_ORDER } from '@/lib/electros/leads'
import type { Step } from '@/lib/electros/academia/curriculum'
import {
  Bullseye,
  ConductionLadder,
  HeartConduction,
  HeartScene,
  PAPER_STYLE,
  RhythmStrip,
  SEV_COLOR,
  Stage,
  useAnimationLoop,
  WavesScene,
  type StageTone,
} from './scenes'

type StepProps<T extends Step['type']> = {
  step: Extract<Step, { type: T }>
  onSolved: () => void
  color: string
}

/* ─── Andamiaje compartido ──────────────────────────────────────────────── */

/** Escenario grande + columna de lectura. Sin `visual` queda una sola columna. */
function StepLayout({
  visual,
  children,
  tone,
  accent,
  label,
  stageClass = 'min-h-[300px] lg:min-h-[420px]',
}: {
  visual?: ReactNode
  children: ReactNode
  tone?: StageTone
  accent?: string
  label?: string
  stageClass?: string
}) {
  if (!visual) return <div className="mx-auto max-w-2xl">{children}</div>

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-10">
      <Stage tone={tone} accent={accent} label={label} className={stageClass}>
        {visual}
      </Stage>
      <motion.div
        className="flex flex-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  )
}

function Feedback({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <motion.div
      className={`mt-5 flex items-start gap-3 rounded-2xl border-2 p-4 ${
        ok ? 'border-[#8BA888]/45 bg-[#F1F5F0]' : 'border-[#C9A24A]/45 bg-[#FDF8EC]'
      }`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
    >
      <span className={`material-symbols-outlined ${ok ? 'text-[#8BA888]' : 'text-[#C9A24A]'}`}>
        {ok ? 'check_circle' : 'info'}
      </span>
      <p className="text-[15px] leading-relaxed text-[#2C3E50]">{children}</p>
    </motion.div>
  )
}

function Prompt({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-lg font-medium leading-snug text-[#2C3E50]">{children}</p>
}

function Slider(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props
  return (
    <div className="mt-5">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#7D8A96]/60">
        {label}
      </span>
      <input
        type="range"
        {...rest}
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[#EAE4E2] accent-[#E8A598]"
      />
    </div>
  )
}

/** Cifra grande de lectura, el "display" del instrumento. */
function Readout({ value, tag, ok }: { value: ReactNode; tag: string; ok: boolean }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAE4E2] bg-white px-4 py-3">
      <span className="text-2xl font-black text-[#2C3E50] tabular-nums">{value}</span>
      <motion.span
        key={tag}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
          ok ? 'bg-[#8BA888]/15 text-[#6a8a67]' : 'bg-[#F2EFED] text-[#7D8A96]'
        }`}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {tag}
      </motion.span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   INFO
═══════════════════════════════════════════════════════════════════════════ */
function InfoVisual({ kind }: { kind: NonNullable<Extract<Step, { type: 'info' }>['visual']> }) {
  const [f, setF] = useState(0)
  useAnimationLoop((t) => setF((t / 3.6) % 1), kind === 'heart-static')

  if (kind === 'heart-static') {
    return (
      <motion.div
        className="h-64 w-52 lg:h-80 lg:w-64"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <HeartConduction f={f} />
      </motion.div>
    )
  }

  if (kind === 'wave-labeled') {
    return (
      <div className="w-full max-w-lg">
        <WavesScene labelled />
      </div>
    )
  }

  if (kind === 'grid') {
    return (
      <div className="w-full max-w-lg">
        <svg viewBox="0 0 320 140" className="h-full w-full">
          <rect x="0" y="30" width="60" height="60" fill="rgba(212,151,140,0.22)" rx="3" />
          <rect
            x="0"
            y="30"
            width="60"
            height="60"
            fill="none"
            stroke="#B87A6F"
            strokeWidth="2"
            strokeDasharray="5 3"
            rx="3"
          />
          <text x="4" y="112" fontSize="12" fontWeight="800" fill="#2C3E50" fontFamily="inherit">
            1 cuadro grande
          </text>
          <text x="4" y="128" fontSize="11" fontWeight="600" fill="#B87A6F" fontFamily="inherit">
            = 0,20 s y 0,5 mV
          </text>
          <path d="M120 60 L300 60" stroke="#241c1a" strokeWidth="2" strokeDasharray="4 4" />
          <text x="120" y="52" fontSize="11" fontWeight="700" fill="#B87A6F" fontFamily="inherit">
            25 mm/s · 10 mm/mV
          </text>
        </svg>
      </div>
    )
  }

  if (kind === 'leads') {
    return (
      <div className="grid w-full max-w-md grid-cols-3 gap-2.5 sm:grid-cols-4">
        {LEAD_ORDER.map((name, i) => (
          <motion.span
            key={name}
            className="flex items-center justify-center rounded-xl border-2 border-[#2c3e50] bg-white py-2.5 text-sm font-black text-[#2C3E50] shadow-[2px_2px_0_0_#2c3e50]"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 320, damping: 20 }}
          >
            {name}
          </motion.span>
        ))}
      </div>
    )
  }

  if (kind === 'order') {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        {['Ritmo', 'Frecuencia', 'Eje', 'Intervalos', 'Morfología'].map((s, i) => (
          <motion.span
            key={s}
            className="flex items-center gap-3 rounded-xl border-2 border-[#2c3e50] bg-white px-4 py-2.5 text-sm font-bold text-[#2C3E50] shadow-[2px_2px_0_0_#2c3e50]"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.09 * i, type: 'spring', stiffness: 300, damping: 22 }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8A598] text-xs font-black text-white">
              {i + 1}
            </span>
            {s}
          </motion.span>
        ))}
      </div>
    )
  }

  return (
    <motion.span
      className="material-symbols-outlined text-[9rem] text-[#E8A598]"
      animate={{ scale: [1, 1.05, 1], rotate: [0, 1.5, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      account_tree
    </motion.span>
  )
}

function InfoStep({ step, color }: StepProps<'info'>) {
  const body = (
    <>
      <p className="text-lg leading-relaxed text-[#7D8A96]">{step.body}</p>
      {step.points ? (
        <ul className="mt-6 flex flex-col gap-3">
          {step.points.map((p, i) => (
            <motion.li
              key={p}
              className="flex items-start gap-3 rounded-xl bg-white/70 p-3 text-[15px] text-[#2C3E50]"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.16 + i * 0.09, ease: 'easeOut' }}
            >
              <span className="material-symbols-outlined text-[#8BA888]">check_circle</span>
              {p}
            </motion.li>
          ))}
        </ul>
      ) : null}
    </>
  )

  if (!step.visual) return <div className="mx-auto max-w-2xl">{body}</div>

  return (
    <StepLayout visual={<InfoVisual kind={step.visual} />} accent={color} label="La idea">
      {body}
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   CONDUCTION — impulso y trazo sincronizados
═══════════════════════════════════════════════════════════════════════════ */
const CYCLE_SECONDS = 3.6

function ConductionStep({ step, color }: StepProps<'conduction'>) {
  const gridRef = useRef<HTMLCanvasElement>(null)
  const traceRef = useRef<HTMLCanvasElement>(null)
  const tracerRef = useRef<EcgTracer | null>(null)
  const baseRef = useRef(0)
  const [f, setF] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    const grid = gridRef.current
    const trace = traceRef.current
    if (!grid || !trace) return
    const tracer = new EcgTracer(grid, trace)
    tracerRef.current = tracer
    tracer.resize()
    const observer = new ResizeObserver(() => tracer.resize())
    observer.observe(grid)
    return () => {
      observer.disconnect()
      tracerRef.current = null
    }
  }, [])

  useAnimationLoop((t) => setF((baseRef.current + t / CYCLE_SECONDS) % 1), playing)

  // El trazador es imperativo: se le pide el fotograma tras cada cambio de f.
  useEffect(() => {
    tracerRef.current?.render(f)
  }, [f])

  const phase = phaseAt(f)
  const focusWave = step.focus === 'wave'

  const togglePlay = () => {
    baseRef.current = f
    setPlaying((p) => !p)
  }

  const visual = (
    <div className="flex w-full flex-col items-center gap-4">
      <motion.div
        className="h-52 w-40 lg:h-64 lg:w-52"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: CYCLE_SECONDS, repeat: Infinity, ease: 'easeInOut' }}
      >
        <HeartConduction f={f} />
      </motion.div>
      <div className="relative h-28 w-full overflow-hidden rounded-2xl border-2 border-[#2c3e50] lg:h-32">
        <canvas ref={gridRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={traceRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  )

  return (
    <StepLayout visual={visual} accent={color} label="En directo" stageClass="min-h-[360px] lg:min-h-[480px]">
      <p className="text-lg leading-relaxed text-[#7D8A96]">{step.body}</p>

      {/* Rótulo de la fase: es el hilo que une el corazón con la onda */}
      <motion.div
        key={phase.id}
        className="mt-6 rounded-2xl border-l-4 bg-white p-4 shadow-sm"
        style={{ borderLeftColor: phase.color }}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <p className="text-base font-black" style={{ color: phase.color }}>
          {focusWave && phase.wave !== '—' ? `Onda ${phase.wave}` : phase.title}
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-[#7D8A96]">{phase.text}</p>
      </motion.div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-full bg-[#E8A598] p-3 text-white shadow-md shadow-[#E8A598]/30 transition-transform hover:scale-105 active:scale-95"
          title={playing ? 'Pausa' : 'Reproducir'}
        >
          <span className="material-symbols-outlined">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(f * 1000)}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000
            baseRef.current = v
            setPlaying(false)
            setF(v)
          }}
          aria-label="Avance del ciclo"
          className="h-2.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#EAE4E2] accent-[#E8A598]"
        />
      </div>
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   HOTSPOT
═══════════════════════════════════════════════════════════════════════════ */
function HotspotStep({ step, onSolved, color }: StepProps<'hotspot'>) {
  const [solved, setSolved] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  const handleHit = (id: string) => {
    if (solved) return
    if (id === step.target) {
      setSolved(id)
      setWrong(null)
      onSolved()
    } else {
      setWrong(id)
      setShowHint(true)
      window.setTimeout(() => setWrong(null), 500)
    }
  }

  const visual = (
    <motion.div
      className={step.scene === 'heart' ? 'h-72 w-56 lg:h-96 lg:w-72' : 'w-full max-w-lg'}
      animate={wrong ? { x: [0, -7, 7, -5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {step.scene === 'heart' ? (
        <HeartScene onHit={handleHit} solvedId={solved} wrongId={wrong} />
      ) : (
        <WavesScene onHit={handleHit} solvedId={solved} wrongId={wrong} />
      )}
    </motion.div>
  )

  return (
    <StepLayout visual={visual} accent={color} label="Toca en el esquema">
      <Prompt>{step.prompt}</Prompt>

      {solved ? (
        <Feedback ok>{step.ok}</Feedback>
      ) : showHint ? (
        <motion.p
          className="flex items-start gap-2 rounded-2xl border-2 border-[#C9A24A]/40 bg-[#FDF8EC] p-4 text-[15px] text-[#8a6f2a]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="material-symbols-outlined text-[#C9A24A]">lightbulb</span>
          Pista: {step.hint}
        </motion.p>
      ) : (
        <p className="text-[15px] text-[#7D8A96]/70">Elige una estructura en el esquema para continuar.</p>
      )}
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   CHOICE
═══════════════════════════════════════════════════════════════════════════ */
function ChoiceStep({ step, onSolved }: StepProps<'choice'>) {
  const [solved, setSolved] = useState(false)
  const [failed, setFailed] = useState<string[]>([])

  const pick = (option: { text: string; correct: boolean }) => {
    if (solved) return
    if (option.correct) {
      setSolved(true)
      onSolved()
    } else {
      setFailed((f) => (f.includes(option.text) ? f : [...f, option.text]))
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Prompt>{step.prompt}</Prompt>
      <div className="flex flex-col gap-3">
        {step.options.map((option, i) => {
          const isWrong = failed.includes(option.text)
          const isRight = solved && option.correct
          return (
            <motion.button
              key={option.text}
              type="button"
              disabled={solved || isWrong}
              onClick={() => pick(option)}
              initial={{ opacity: 0, y: 12 }}
              animate={
                isWrong ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 0] } : { opacity: 1, y: 0, x: 0 }
              }
              transition={{ delay: solved || isWrong ? 0 : 0.06 * i, ease: 'easeOut' }}
              className={`flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left text-[15px] transition-colors ${
                isRight
                  ? 'border-[#8BA888] bg-[#F1F5F0] text-[#2C3E50] shadow-[3px_3px_0_0_#8BA888]'
                  : isWrong
                    ? 'border-[#C4655A]/40 bg-[#FDF2F0] text-[#7D8A96] line-through opacity-65'
                    : 'border-[#EAE4E2] bg-white text-[#2C3E50] hover:-translate-y-0.5 hover:border-[#2c3e50] hover:shadow-[3px_3px_0_0_#2c3e50]'
              } disabled:cursor-not-allowed`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isRight ? 'border-[#8BA888] bg-[#8BA888]' : isWrong ? 'border-[#C4655A]' : 'border-[#D9D2CE]'
                }`}
              >
                {isRight ? <span className="material-symbols-outlined text-[11px] text-white">check</span> : null}
              </span>
              {option.text}
            </motion.button>
          )
        })}
      </div>
      {solved ? <Feedback ok>{step.why}</Feedback> : null}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   REVEAL
═══════════════════════════════════════════════════════════════════════════ */
function RevealStep({ step, onSolved }: StepProps<'reveal'>) {
  const [opened, setOpened] = useState<string[]>([])
  // El ref es la fuente de verdad del recuento: si llegan dos aperturas en el
  // mismo tick, leer el estado daría una copia obsoleta y se perdería una.
  const openedRef = useRef<Set<string>>(new Set())

  const open = (key: string) => {
    if (openedRef.current.has(key)) return
    openedRef.current.add(key)
    setOpened(Array.from(openedRef.current))
    if (openedRef.current.size >= step.items.length) onSolved()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Prompt>{step.prompt}</Prompt>
      <div className="grid gap-3 sm:grid-cols-2">
        {step.items.map((item, i) => {
          const isOpen = opened.includes(item.k)
          return (
            <motion.button
              key={item.k}
              type="button"
              onClick={() => open(item.k)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, ease: 'easeOut' }}
              className={`flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all ${
                isOpen
                  ? 'border-[#E8A598] bg-[#FFF9F7] shadow-[3px_3px_0_0_#E8A598] sm:col-span-2'
                  : 'border-[#EAE4E2] bg-white hover:-translate-y-0.5 hover:border-[#2c3e50] hover:shadow-[3px_3px_0_0_#2c3e50]'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8A598] text-sm font-black text-white">
                {item.k}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-base font-bold text-[#2C3E50]">
                  {item.label}
                  {!isOpen ? (
                    <span className="material-symbols-outlined text-lg text-[#7D8A96]/60">expand_more</span>
                  ) : null}
                </span>
                {isOpen ? (
                  <motion.span
                    className="mt-1.5 block text-[15px] leading-relaxed text-[#7D8A96]"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    {item.text}
                  </motion.span>
                ) : null}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   CALIPER — medir la anchura del QRS
═══════════════════════════════════════════════════════════════════════════ */
const MS_PER_SQUARE = 40

function CaliperStep({ step, onSolved, color }: StepProps<'caliper'>) {
  const [squares, setSquares] = useState(1)
  const [solved, setSolved] = useState(false)

  const ms = Math.round(squares * MS_PER_SQUARE)
  const W = 320
  const H = 150
  const sq = 30
  const x0 = 60
  const base = H * 0.62
  const qw = (step.trueMs / MS_PER_SQUARE) * sq
  const left = x0 - qw / 2
  const rightX = left + squares * sq

  // El acierto se comprueba al mover el compás, no en un efecto: así el
  // desbloqueo es consecuencia directa del gesto del alumno.
  const handleChange = (value: number) => {
    setSquares(value)
    if (solved) return
    if (Math.abs(Math.round(value * MS_PER_SQUARE) - step.trueMs) <= step.tolMs) {
      setSolved(true)
      onSolved()
    }
  }

  const visual = (
    <div className="w-full max-w-lg">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <path d={`M10 ${base} L${left} ${base}`} fill="none" stroke="#241c1a" strokeWidth="2.2" />
        <path
          d={`M${left} ${base} L${left + qw * 0.2} ${base + 14} L${x0} ${base - 70} L${x0 + qw * 0.3} ${base + 22} L${left + qw} ${base} L${W - 10} ${base}`}
          fill="none"
          stroke="#241c1a"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <line x1={left} y1="8" x2={left} y2={H - 8} stroke="#B87A6F" strokeWidth="1.8" strokeDasharray="4 3" />
        <motion.line
          x1={rightX}
          y1="8"
          x2={rightX}
          y2={H - 8}
          stroke={solved ? '#8BA888' : '#E8A598'}
          strokeWidth="3"
          animate={{ x: 0 }}
        />
        <motion.rect
          x={left}
          y={base - 84}
          width={Math.max(0, rightX - left)}
          height="7"
          fill={solved ? 'rgba(139,168,136,0.65)' : 'rgba(232,165,152,0.6)'}
          rx="3.5"
        />
      </svg>
    </div>
  )

  return (
    <StepLayout visual={visual} accent={color} label="Compás">
      <Prompt>{step.prompt}</Prompt>

      <Readout
        value={
          <>
            {(ms / 1000).toFixed(2)} s <span className="text-base font-medium text-[#7D8A96]">({ms} ms)</span>
          </>
        }
        tag={solved ? (ms < step.normalMax ? 'QRS normal ✓' : 'QRS ancho') : 'Ajusta el compás'}
        ok={solved}
      />

      <Slider
        label="Compás"
        min={1}
        max={6}
        step={0.5}
        value={squares}
        onChange={(e) => handleChange(Number(e.target.value))}
      />

      {solved ? (
        <Feedback ok>
          Bien medido: el QRS mide ≈ {step.trueMs} ms. Al ser &lt; 0,12 s es un QRS estrecho (normal).
        </Feedback>
      ) : null}
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   RATE — regla del 300
═══════════════════════════════════════════════════════════════════════════ */
function RateStep({ step, onSolved, color }: StepProps<'rate'>) {
  const [bigSquares, setBigSquares] = useState(6)
  const [solved, setSolved] = useState(false)

  const bpm = Math.round(300 / bigSquares)
  const inRange = bpm >= step.targetMin && bpm <= step.targetMax

  const W = 320
  const H = 150
  const big = 30
  const base = H * 0.55
  const x1 = 40
  const x2 = x1 + bigSquares * big
  const spike = (x: number) =>
    `L${x - 6} ${base} L${x - 3} ${base + 10} L${x} ${base - 60} L${x + 3} ${base + 16} L${x + 6} ${base}`

  const handleChange = (value: number) => {
    setBigSquares(value)
    if (solved) return
    const next = Math.round(300 / value)
    if (next >= step.targetMin && next <= step.targetMax) {
      setSolved(true)
      onSolved()
    }
  }

  const visual = (
    <div className="w-full max-w-lg">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <path
          d={`M10 ${base} ${spike(x1)} ${spike(x2)} L${W - 10} ${base}`}
          fill="none"
          stroke="#241c1a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d={`M${x1} ${base + 24} L${x2} ${base + 24}`}
          stroke={inRange ? '#8BA888' : '#E8A598'}
          strokeWidth="2.5"
          fill="none"
        />
        <text
          x={(x1 + x2) / 2}
          y={base + 40}
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill={inRange ? '#6a8a67' : '#B87A6F'}
          fontFamily="inherit"
        >
          {bigSquares} cuadros
        </text>
      </svg>
    </div>
  )

  return (
    <StepLayout visual={visual} accent={color} label="Regla del 300">
      <Prompt>{step.prompt}</Prompt>

      <Readout
        value={
          <>
            300 ÷ {bigSquares} = <span className="text-[#E8A598]">{bpm}</span> lpm
          </>
        }
        tag={inRange ? 'Frecuencia normal ✓' : bpm < step.targetMin ? 'Bradicardia' : 'Taquicardia'}
        ok={inRange}
      />

      <Slider
        label="Distancia R-R"
        min={1.5}
        max={6}
        step={0.5}
        value={bigSquares}
        onChange={(e) => handleChange(Number(e.target.value))}
      />

      {solved ? (
        <Feedback ok>
          {bpm} lpm está en el rango normal (60–100). Recuerda la regla: 300, 150, 100, 75, 60, 50 para 1–6 cuadros.
        </Feedback>
      ) : null}
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   AXIS — rotar el eje eléctrico
═══════════════════════════════════════════════════════════════════════════ */
function quadrant(angle: number): { name: string; color: string } {
  const iPos = Math.cos((angle * Math.PI) / 180) >= 0
  const fPos = Math.sin((angle * Math.PI) / 180) >= 0
  if (iPos && fPos) return { name: 'Eje normal', color: '#8BA888' }
  if (iPos && !fPos) return { name: 'Desviación izquierda', color: '#C9A24A' }
  if (!iPos && fPos) return { name: 'Desviación derecha', color: '#7CA3C9' }
  return { name: 'Eje extremo', color: '#C4655A' }
}

function AxisStep({ step, onSolved, color }: StepProps<'axis'>) {
  const [angle, setAngle] = useState(60)
  const [solved, setSolved] = useState(false)

  const cx = 110
  const cy = 110
  const R = 82
  const rad = (angle * Math.PI) / 180
  const ex = cx + R * Math.cos(rad)
  const ey = cy + R * Math.sin(rad)
  const q = quadrant(angle)
  const iPos = Math.cos(rad) >= 0
  const fPos = Math.sin(rad) >= 0

  const handleChange = (value: number) => {
    setAngle(value)
    if (solved) return
    if (value >= step.targetMin && value <= step.targetMax) {
      setSolved(true)
      onSolved()
    }
  }

  const visual = (
    <div className="h-72 w-72 lg:h-80 lg:w-80">
      <svg viewBox="0 0 220 220" className="h-full w-full">
        <circle cx={cx} cy={cy} r={R} fill="rgba(255,255,255,0.6)" stroke="#EAE4E2" strokeWidth="2" />
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="#D9D2CE" strokeWidth="1.5" />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="#D9D2CE" strokeWidth="1.5" />
        <text x={cx + R - 36} y={cy - 8} fontSize="10" fontWeight="800" fill="#A8988F" fontFamily="inherit">
          I+ (0°)
        </text>
        <text x={cx + 6} y={cy + R - 6} fontSize="10" fontWeight="800" fill="#A8988F" fontFamily="inherit">
          aVF+ (+90°)
        </text>
        <motion.line
          x1={cx}
          y1={cy}
          x2={ex}
          y2={ey}
          stroke={q.color}
          strokeWidth="5"
          strokeLinecap="round"
          animate={{ x2: ex, y2: ey }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        />
        <motion.circle cx={ex} cy={ey} r="8" fill={q.color} animate={{ cx: ex, cy: ey }} />
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fill={q.color}
          fontFamily="inherit"
        >
          {angle}°
        </text>
      </svg>
    </div>
  )

  return (
    <StepLayout visual={visual} accent={color} label="Eje eléctrico">
      <Prompt>{step.prompt}</Prompt>

      <div className="flex flex-wrap items-center gap-2.5">
        {[
          { lead: 'I', pos: iPos },
          { lead: 'aVF', pos: fPos },
        ].map((b) => (
          <span
            key={b.lead}
            className={`rounded-xl px-3.5 py-2 text-sm font-black ${
              b.pos ? 'bg-[#8BA888]/15 text-[#6a8a67]' : 'bg-[#C4655A]/12 text-[#C4655A]'
            }`}
          >
            {b.lead} {b.pos ? '▲' : '▼'}
          </span>
        ))}
        <motion.span key={q.name} className="text-base font-black" style={{ color: q.color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {q.name}
        </motion.span>
      </div>

      <Slider
        label="Eje"
        min={-150}
        max={150}
        step={5}
        value={angle}
        onChange={(e) => handleChange(Number(e.target.value))}
      />

      {solved ? (
        <Feedback ok>
          ¡Eso es {step.targetLabel}! Con I positivo y aVF negativo, el eje apunta arriba-izquierda ({step.targetMin}° a{' '}
          {step.targetMax}°).
        </Feedback>
      ) : null}
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   ALGORITHM — árbol de decisión que se revela nivel a nivel
═══════════════════════════════════════════════════════════════════════════ */
type Unit = { key: string; order: number }

/* Recorre el árbol asignando a cada elemento visible un "orden de aparición"
   por profundidad, para que el algoritmo se revele nivel a nivel. La ruta
   (`/0/1`) codifica la ascendencia, así que luego basta comparar prefijos para
   saber qué ramas iluminar. */
function collectUnits(
  tree: (typeof TREES)[keyof typeof TREES],
  nodeId: string,
  depth: number,
  path: string,
  out: Unit[],
) {
  const node = tree.nodes[nodeId]
  if (!node) return
  if (isLeaf(node)) {
    out.push({ key: `l:${path}`, order: depth })
    return
  }
  out.push({ key: `q:${path}`, order: depth })
  node.options.forEach((option, i) => {
    out.push({ key: `b:${path}/${i}`, order: depth + 0.5 })
    collectUnits(tree, option.go, depth + 1, `${path}/${i}`, out)
  })
}

function AlgorithmStep({ step, onSolved, color }: StepProps<'algorithm'>) {
  const tree = TREES[step.tree]
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [selected, setSelected] = useState<{ path: string; node: LeafNode } | null>(null)
  const baseRef = useRef(0)
  const solvedRef = useRef(false)

  const revealOrder = useMemo(() => {
    const units: Unit[] = []
    collectUnits(tree, tree.root, 0, '', units)
    units.sort((a, b) => a.order - b.order)
    return new Map(units.map((u, i) => [u.key, i]))
  }, [tree])

  const total = revealOrder.size
  const duration = Math.min(6.5, Math.max(2.6, total * 0.17))
  const head = Math.round(progress * total)

  const solve = useCallback(() => {
    if (solvedRef.current) return
    solvedRef.current = true
    onSolved()
  }, [onSolved])

  useAnimationLoop((t) => {
    const next = Math.min(1, baseRef.current + t / duration)
    setProgress(next)
    if (next >= 1) {
      setPlaying(false)
      solve()
    }
  }, playing)

  const isVisible = (key: string) => (revealOrder.get(key) ?? Infinity) < head

  const play = () => {
    baseRef.current = progress >= 1 ? 0 : progress
    if (progress >= 1) setProgress(0)
    setPlaying(true)
  }

  const renderNode = (nodeId: string, path: string): ReactNode => {
    const node = tree.nodes[nodeId]
    if (!node) return null

    if (isLeaf(node)) {
      const key = `l:${path}`
      const visible = isVisible(key)
      const active = selected?.path === path
      return (
        <motion.button
          type="button"
          disabled={!visible}
          onClick={() => {
            setSelected({ path, node })
            solve()
          }}
          animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
            visible ? '' : 'pointer-events-none'
          } ${
            active
              ? 'border-[#2C3E50] bg-white shadow-[3px_3px_0_0_#2c3e50]'
              : 'border-[#EAE4E2] bg-white/90 hover:border-[#E8A598]'
          }`}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SEV_COLOR[node.sev] }} />
          <span className="min-w-0 flex-1 text-[13px] font-bold text-[#2C3E50]">{node.dx}</span>
          <span className="material-symbols-outlined text-base text-[#7D8A96]/60">chevron_right</span>
        </motion.button>
      )
    }

    const qKey = `q:${path}`
    return (
      <div className="flex flex-col gap-2.5">
        <motion.div
          className="flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5"
          style={{ borderColor: `${color}66`, backgroundColor: `${color}14` }}
          animate={isVisible(qKey) ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
            style={{ backgroundColor: color }}
          >
            ?
          </span>
          <span className="text-[13px] font-black text-[#2C3E50]">{node.q.replace(/^\d\)\s*/, '')}</span>
        </motion.div>

        <div className="flex flex-col gap-2.5 border-l-2 border-dashed border-[#D9D2CE] pl-3.5">
          {node.options.map((option, i) => {
            const bKey = `b:${path}/${i}`
            const childPath = `${path}/${i}`
            // Una rama se ilumina si el diagnóstico elegido cuelga de ella.
            const onPath = selected ? selected.path.startsWith(childPath) : false
            return (
              <div key={bKey} className="flex flex-col gap-2">
                <motion.span
                  className={`self-start rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                    onPath ? 'bg-[#2C3E50] text-white' : 'bg-white/80 text-[#7D8A96]'
                  }`}
                  animate={isVisible(bKey) ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  {option.label}
                </motion.span>
                <div className="pl-2">{renderNode(option.go, childPath)}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const visual = <div className="w-full self-start">{renderNode(tree.root, '')}</div>

  return (
    <StepLayout
      visual={visual}
      accent={color}
      label="Árbol de decisión"
      stageClass="min-h-[420px] lg:min-h-[560px]"
    >
      <p className="text-[15px] leading-relaxed text-[#7D8A96]">{tree.intro}</p>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#EAE4E2] bg-white p-3">
        <button
          type="button"
          onClick={() => (playing && progress < 1 ? setPlaying(false) : play())}
          className="rounded-full bg-[#E8A598] p-2 text-white transition-transform hover:scale-105 active:scale-95"
          title={playing && progress < 1 ? 'Pausa' : 'Reproducir'}
        >
          <span className="material-symbols-outlined text-lg">
            {progress >= 1 ? 'replay' : playing ? 'pause' : 'play_arrow'}
          </span>
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000
            baseRef.current = v
            setPlaying(false)
            setProgress(v)
            if (v >= 1) solve()
          }}
          aria-label="Avance del algoritmo"
          className="h-2.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#EAE4E2] accent-[#E8A598]"
        />
      </div>

      {selected ? (
        <motion.div
          key={selected.path}
          className="mt-5 rounded-2xl border-2 border-[#2c3e50] bg-white p-4 shadow-[4px_4px_0_0_#2c3e50]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SEV_COLOR[selected.node.sev] }} />
            <h3 className="text-lg font-black text-[#2C3E50]">{selected.node.dx}</h3>
            <span className="rounded bg-[#F2EFED] px-2 py-0.5 text-[10px] font-bold text-[#7D8A96]">
              {selected.node.badge}
            </span>
          </div>
          <div className="mb-3 aspect-[320/104] w-full overflow-hidden rounded-xl border border-[#EAE4E2]">
            <RhythmStrip kind={selected.node.strip} label={selected.node.badge} />
          </div>
          <p className="mb-2 text-[15px] leading-relaxed text-[#2C3E50]">
            <b>En el ECG:</b> {selected.node.clue}
          </p>
          <p className="text-[15px] leading-relaxed text-[#7D8A96]">{selected.node.why}</p>
        </motion.div>
      ) : (
        <p className="mt-5 flex items-center gap-2 rounded-2xl border border-dashed border-[#D9D2CE] p-4 text-sm text-[#7D8A96]/80">
          <span className="material-symbols-outlined">touch_app</span>
          Toca un diagnóstico del árbol para iluminar su camino y ver el detalle.
        </p>
      )}
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   TERRITORY
═══════════════════════════════════════════════════════════════════════════ */
function TerritoryStep({ step, onSolved, color }: StepProps<'territory'>) {
  const [solved, setSolved] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  const pick = (id: string) => {
    if (solved) return
    if (id === step.target) {
      setSolved(id)
      onSolved()
    } else {
      setWrong(id)
      setShowHint(true)
      window.setTimeout(() => setWrong(null), 450)
    }
  }

  const wall = solved ? WALLS[step.target] : null

  const visual = (
    <motion.div
      className="h-72 w-72 lg:h-96 lg:w-96"
      animate={wrong ? { x: [0, -7, 7, -5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Bullseye onPick={pick} solvedId={solved} wrongId={wrong} />
    </motion.div>
  )

  return (
    <StepLayout visual={visual} accent={color} label="Paredes del VI">
      <Prompt>{step.prompt}</Prompt>

      {wall ? (
        <motion.div
          className="rounded-2xl border-2 border-[#2c3e50] bg-white p-4 shadow-[4px_4px_0_0_#2c3e50]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <b className="text-lg text-[#2C3E50]">Cara {wall.name.toLowerCase()}</b>
          <p className="mt-2 text-[15px] text-[#7D8A96]">
            <i>Derivaciones:</i> <b className="text-[#2C3E50]">{wall.leads}</b>
          </p>
          <p className="text-[15px] text-[#7D8A96]">
            <i>Arteria:</i> <b className="text-[#2C3E50]">{wall.artery}</b>
          </p>
        </motion.div>
      ) : showHint ? (
        <motion.p
          className="flex items-start gap-2 rounded-2xl border-2 border-[#C9A24A]/40 bg-[#FDF8EC] p-4 text-[15px] text-[#8a6f2a]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="material-symbols-outlined text-[#C9A24A]">lightbulb</span>
          Pista: relaciona el grupo de derivaciones con su pared.
        </motion.p>
      ) : (
        <p className="text-[15px] text-[#7D8A96]/70">Toca la pared correspondiente en la diana.</p>
      )}

      {solved ? <Feedback ok>{step.ok}</Feedback> : null}
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   LADDER
═══════════════════════════════════════════════════════════════════════════ */
const LADDER_NAMES: Record<string, string> = {
  normal: 'Normal',
  mobitz1: 'Mobitz I',
  mobitz2: 'Mobitz II',
  av3: 'BAV III',
}

const LADDER_CAPTIONS: Record<string, string> = {
  normal: 'Conducción 1:1: cada P baja por el nodo AV con un PR constante y genera su QRS.',
  mobitz1: 'Wenckebach: la pendiente en el nodo AV (el PR) crece latido a latido hasta que una P se bloquea.',
  mobitz2: 'El PR se mantiene fijo… y de pronto una P no conduce, sin aviso previo.',
  av3: 'Disociación completa: ninguna P conduce; un marcapasos de escape mueve los ventrículos por su cuenta.',
}

function LadderStep({ step, color }: StepProps<'ladder'>) {
  const [kind, setKind] = useState(step.kinds[0])
  const [head, setHead] = useState(0)

  // El cabezal barre en bucle; cambiar de patrón no lo reinicia porque el ciclo
  // se repite continuamente y cortarlo a media pasada se ve peor.
  useAnimationLoop((t) => setHead((t * 82) % 360), true)

  const visual = (
    <div className="w-full max-w-xl">
      <ConductionLadder kind={kind} head={head} />
    </div>
  )

  return (
    <StepLayout visual={visual} accent={color} label="Escalera de Lewis">
      <Prompt>{step.prompt}</Prompt>

      <div className="flex flex-wrap gap-2">
        {step.kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all ${
              kind === k
                ? 'border-[#2c3e50] bg-[#E8A598] text-white shadow-[3px_3px_0_0_#2c3e50]'
                : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#2c3e50]'
            }`}
          >
            {LADDER_NAMES[k]}
          </button>
        ))}
      </div>

      <motion.p
        key={kind}
        className="mt-5 rounded-2xl border-l-4 border-l-[#8BA888] bg-white p-4 text-[15px] leading-relaxed text-[#2C3E50]"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {LADDER_CAPTIONS[kind]}
      </motion.p>
    </StepLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SUMMARY
═══════════════════════════════════════════════════════════════════════════ */
function SummaryStep({ step }: StepProps<'summary'>) {
  return (
    <div className="mx-auto max-w-2xl py-6 text-center">
      <motion.div
        className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#2c3e50] bg-[#E8A598] shadow-[5px_5px_0_0_#2c3e50]"
        initial={{ scale: 0.5, rotate: -18 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 15 }}
      >
        <span className="material-symbols-outlined text-5xl text-white">workspace_premium</span>
      </motion.div>
      <p className="mb-7 text-lg leading-relaxed text-[#7D8A96]">{step.body}</p>
      <Link
        href="/studio/electros/explorador"
        className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-6 py-3.5 text-base font-bold text-white shadow-[4px_4px_0_0_#2c3e50] transition-transform hover:-translate-y-0.5"
      >
        {step.cta}
        <span className="material-symbols-outlined">arrow_forward</span>
      </Link>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   DESPACHADOR
═══════════════════════════════════════════════════════════════════════════ */
/** Pasos que solo hay que mirar: el reproductor los desbloquea al entrar. */
export const AUTO_UNLOCK: ReadonlySet<Step['type']> = new Set<Step['type']>([
  'info',
  'conduction',
  'ladder',
  'summary',
])

export { PAPER_STYLE }

export function StepRenderer({ step, onSolved, color }: { step: Step; onSolved: () => void; color: string }) {
  switch (step.type) {
    case 'info':
      return <InfoStep step={step} onSolved={onSolved} color={color} />
    case 'conduction':
      return <ConductionStep step={step} onSolved={onSolved} color={color} />
    case 'hotspot':
      return <HotspotStep step={step} onSolved={onSolved} color={color} />
    case 'choice':
      return <ChoiceStep step={step} onSolved={onSolved} color={color} />
    case 'reveal':
      return <RevealStep step={step} onSolved={onSolved} color={color} />
    case 'caliper':
      return <CaliperStep step={step} onSolved={onSolved} color={color} />
    case 'rate':
      return <RateStep step={step} onSolved={onSolved} color={color} />
    case 'axis':
      return <AxisStep step={step} onSolved={onSolved} color={color} />
    case 'algorithm':
      return <AlgorithmStep step={step} onSolved={onSolved} color={color} />
    case 'territory':
      return <TerritoryStep step={step} onSolved={onSolved} color={color} />
    case 'ladder':
      return <LadderStep step={step} onSolved={onSolved} color={color} />
    case 'summary':
      return <SummaryStep step={step} onSolved={onSolved} color={color} />
  }
}
