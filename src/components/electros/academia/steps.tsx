'use client'

/* ════════════════════════════════════════════════════════════════════════
   Un componente por tipo de paso. Todos reciben su `step` ya tipado por la
   unión discriminada del currículo y avisan con `onSolved()` cuando el alumno
   completa la interacción (el reproductor habilita entonces "Continuar").

   Los pasos que solo hay que mirar (info, conduction, ladder, summary) los
   desbloquea el reproductor directamente, así que aquí no llaman a onSolved.
═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  RhythmStrip,
  SEV_COLOR,
  useAnimationLoop,
  WavesScene,
} from './scenes'

type StepProps<T extends Step['type']> = {
  step: Extract<Step, { type: T }>
  onSolved: () => void
  color: string
}

/* ─── Piezas compartidas ────────────────────────────────────────────────── */
function Feedback({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3.5 ${
        ok ? 'border-[#8BA888]/30 bg-[#F1F5F0]' : 'border-[#C9A24A]/30 bg-[#FDF8EC]'
      }`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <span className={`material-symbols-outlined text-lg ${ok ? 'text-[#8BA888]' : 'text-[#C9A24A]'}`}>
        {ok ? 'check_circle' : 'info'}
      </span>
      <p className="text-sm text-[#2C3E50]">{children}</p>
    </motion.div>
  )
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-base font-medium text-[#2C3E50]">{children}</p>
}

function Slider(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/60">{label}</span>
      <input
        type="range"
        {...rest}
        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#EAE4E2] accent-[#E8A598]"
      />
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
      <div className="mx-auto mb-5 h-44 w-36">
        <HeartConduction f={f} />
      </div>
    )
  }

  if (kind === 'wave-labeled') {
    return (
      <div className="mb-5 h-32 w-full overflow-hidden rounded-xl border border-[#EAE4E2]">
        <WavesScene labelled />
      </div>
    )
  }

  if (kind === 'grid') {
    return (
      <div className="mb-5 overflow-hidden rounded-xl border border-[#EAE4E2]">
        <svg viewBox="0 0 320 120" className="h-full w-full">
          <defs>
            <pattern id="ig-fine" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M12 0 L0 0 0 12" fill="none" stroke="rgba(212,151,140,0.25)" strokeWidth="1" />
            </pattern>
            <pattern id="ig-bold" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect width="60" height="60" fill="url(#ig-fine)" />
              <path d="M60 0 L0 0 0 60" fill="none" stroke="rgba(212,151,140,0.55)" strokeWidth="1.3" />
            </pattern>
          </defs>
          <rect width="320" height="120" fill="#FFF7F4" />
          <rect width="320" height="120" fill="url(#ig-bold)" />
          <rect x="0" y="30" width="60" height="60" fill="rgba(212,151,140,0.16)" />
          <text x="8" y="108" fontSize="11" fontWeight="700" fill="#B87A6F" fontFamily="inherit">
            1 grande = 0,20 s
          </text>
          <text x="200" y="108" fontSize="11" fontWeight="700" fill="#B87A6F" fontFamily="inherit">
            y 0,5 mV
          </text>
        </svg>
      </div>
    )
  }

  if (kind === 'leads') {
    return (
      <div className="mb-5 flex flex-wrap justify-center gap-1.5">
        {LEAD_ORDER.map((name) => (
          <span
            key={name}
            className="rounded-lg border border-[#EAE4E2] bg-white px-2.5 py-1 text-xs font-bold text-[#7D8A96]"
          >
            {name}
          </span>
        ))}
      </div>
    )
  }

  if (kind === 'order') {
    return (
      <div className="mb-5 flex flex-wrap justify-center gap-1.5">
        {['Ritmo', 'Frecuencia', 'Eje', 'Intervalos', 'Morfología'].map((s, i) => (
          <span
            key={s}
            className="flex items-center gap-1.5 rounded-full bg-[#FFF5F3] px-3 py-1.5 text-xs font-semibold text-[#d18d80]"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E8A598] text-[9px] font-bold text-white">
              {i + 1}
            </span>
            {s}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="mb-5 flex justify-center">
      <span className="material-symbols-outlined text-6xl text-[#E8A598]/60">account_tree</span>
    </div>
  )
}

function InfoStep({ step }: StepProps<'info'>) {
  return (
    <div>
      {step.visual ? <InfoVisual kind={step.visual} /> : null}
      <p className="text-base leading-relaxed text-[#7D8A96]">{step.body}</p>
      {step.points ? (
        <ul className="mt-4 flex flex-col gap-2">
          {step.points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-[#2C3E50]">
              <span className="material-symbols-outlined text-base text-[#8BA888]">check</span>
              {p}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   CONDUCTION — impulso y trazo sincronizados
═══════════════════════════════════════════════════════════════════════════ */
const CYCLE_SECONDS = 3.6

function ConductionStep({ step }: StepProps<'conduction'>) {
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
    if (playing) {
      baseRef.current = f
      setPlaying(false)
    } else {
      baseRef.current = f
      setPlaying(true)
    }
  }

  return (
    <div>
      <p className="mb-4 text-base leading-relaxed text-[#7D8A96]">{step.body}</p>

      <div className="mb-3 flex items-center gap-4 rounded-xl border border-[#EAE4E2] bg-white p-3">
        <div className="h-36 w-28 shrink-0">
          <HeartConduction f={f} />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          {focusWave && phase.wave !== '—' ? (
            <b style={{ color: phase.color }}>Onda {phase.wave} · </b>
          ) : (
            <b style={{ color: phase.color }}>{phase.title} · </b>
          )}
          <span className="text-[#7D8A96]">{phase.text}</span>
        </div>
      </div>

      <div className="relative h-28 overflow-hidden rounded-xl border border-[#EAE4E2]">
        <canvas ref={gridRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={traceRef} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-full bg-[#E8A598] p-2 text-white transition-colors hover:bg-[#d18d80]"
          title={playing ? 'Pausa' : 'Reproducir'}
        >
          <span className="material-symbols-outlined text-lg">{playing ? 'pause' : 'play_arrow'}</span>
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
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#EAE4E2] accent-[#E8A598]"
        />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   HOTSPOT
═══════════════════════════════════════════════════════════════════════════ */
function HotspotStep({ step, onSolved }: StepProps<'hotspot'>) {
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

  return (
    <div>
      <Prompt>{step.prompt}</Prompt>
      <div
        className={`mx-auto overflow-hidden rounded-xl border border-[#EAE4E2] ${
          step.scene === 'heart' ? 'h-56 w-44' : 'h-40 w-full'
        }`}
      >
        {step.scene === 'heart' ? (
          <HeartScene onHit={handleHit} solvedId={solved} wrongId={wrong} />
        ) : (
          <WavesScene onHit={handleHit} solvedId={solved} wrongId={wrong} />
        )}
      </div>

      {solved ? (
        <Feedback ok>{step.ok}</Feedback>
      ) : showHint ? (
        <p className="mt-3 text-center text-sm text-[#C9A24A]">Pista: {step.hint}</p>
      ) : null}
    </div>
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
    <div>
      <Prompt>{step.prompt}</Prompt>
      <div className="flex flex-col gap-2">
        {step.options.map((option) => {
          const isWrong = failed.includes(option.text)
          const isRight = solved && option.correct
          return (
            <button
              key={option.text}
              type="button"
              disabled={solved || isWrong}
              onClick={() => pick(option)}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors ${
                isRight
                  ? 'border-[#8BA888] bg-[#F1F5F0] text-[#2C3E50]'
                  : isWrong
                    ? 'border-[#C4655A]/40 bg-[#FDF2F0] text-[#7D8A96] line-through opacity-70'
                    : 'border-[#EAE4E2] bg-white text-[#2C3E50] hover:border-[#E8A598] hover:bg-[#FFF9F7]'
              } disabled:cursor-not-allowed`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  isRight ? 'border-[#8BA888] bg-[#8BA888]' : isWrong ? 'border-[#C4655A]' : 'border-[#D9D2CE]'
                }`}
              >
                {isRight ? <span className="material-symbols-outlined text-[10px] text-white">check</span> : null}
              </span>
              {option.text}
            </button>
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
    <div>
      <Prompt>{step.prompt}</Prompt>
      <div className="flex flex-col gap-2">
        {step.items.map((item) => {
          const isOpen = opened.includes(item.k)
          return (
            <button
              key={item.k}
              type="button"
              onClick={() => open(item.k)}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                isOpen ? 'border-[#E8A598]/40 bg-[#FFF9F7]' : 'border-[#EAE4E2] bg-white hover:border-[#E8A598]'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E8A598] text-xs font-bold text-white">
                {item.k}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-bold text-[#2C3E50]">
                  {item.label}
                  {!isOpen ? (
                    <span className="material-symbols-outlined text-base text-[#7D8A96]/60">expand_more</span>
                  ) : null}
                </span>
                {isOpen ? (
                  <motion.span
                    className="mt-1 block text-sm text-[#7D8A96]"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    {item.text}
                  </motion.span>
                ) : null}
              </span>
            </button>
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

function CaliperStep({ step, onSolved }: StepProps<'caliper'>) {
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

  return (
    <div>
      <Prompt>{step.prompt}</Prompt>

      <div className="overflow-hidden rounded-xl border border-[#EAE4E2]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          <defs>
            <pattern id="cal-grid" width={sq} height={sq} patternUnits="userSpaceOnUse">
              <path d={`M${sq} 0 L0 0 0 ${sq}`} fill="none" stroke="rgba(212,151,140,0.28)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="#FFF7F4" />
          <rect width={W} height={H} fill="url(#cal-grid)" />
          <path d={`M10 ${base} L${left} ${base}`} fill="none" stroke="#241c1a" strokeWidth="2.2" />
          <path
            d={`M${left} ${base} L${left + qw * 0.2} ${base + 14} L${x0} ${base - 70} L${x0 + qw * 0.3} ${base + 22} L${left + qw} ${base} L${W - 10} ${base}`}
            fill="none"
            stroke="#241c1a"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <line x1={left} y1="8" x2={left} y2={H - 8} stroke="#B87A6F" strokeWidth="1.6" strokeDasharray="4 3" />
          <line x1={rightX} y1="8" x2={rightX} y2={H - 8} stroke="#E8A598" strokeWidth="2.4" />
          <rect
            x={left}
            y={base - 82}
            width={Math.max(0, rightX - left)}
            height="6"
            fill="rgba(232,165,152,0.55)"
            rx="3"
          />
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold text-[#2C3E50] tabular-nums">
          {(ms / 1000).toFixed(2)} s <span className="text-sm font-medium text-[#7D8A96]">({ms} ms)</span>
        </span>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
            solved ? 'bg-[#8BA888]/15 text-[#6a8a67]' : 'bg-[#F2EFED] text-[#7D8A96]'
          }`}
        >
          {solved
            ? ms < step.normalMax
              ? 'QRS normal (< 0,12 s) ✓'
              : 'QRS ancho'
            : 'Ajusta el compás al final del QRS'}
        </span>
      </div>

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
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   RATE — regla del 300
═══════════════════════════════════════════════════════════════════════════ */
function RateStep({ step, onSolved }: StepProps<'rate'>) {
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
  const spike = (x: number) => `L${x - 6} ${base} L${x - 3} ${base + 10} L${x} ${base - 60} L${x + 3} ${base + 16} L${x + 6} ${base}`

  const handleChange = (value: number) => {
    setBigSquares(value)
    if (solved) return
    const next = Math.round(300 / value)
    if (next >= step.targetMin && next <= step.targetMax) {
      setSolved(true)
      onSolved()
    }
  }

  return (
    <div>
      <Prompt>{step.prompt}</Prompt>

      <div className="overflow-hidden rounded-xl border border-[#EAE4E2]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          <defs>
            <pattern id="rate-grid" width={big} height={big} patternUnits="userSpaceOnUse">
              <path d={`M${big} 0 L0 0 0 ${big}`} fill="none" stroke="rgba(212,151,140,0.4)" strokeWidth="1.1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="#FFF7F4" />
          <rect width={W} height={H} fill="url(#rate-grid)" />
          <path
            d={`M10 ${base} ${spike(x1)} ${spike(x2)} L${W - 10} ${base}`}
            fill="none"
            stroke="#241c1a"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path d={`M${x1} ${base + 22} L${x2} ${base + 22}`} stroke="#E8A598" strokeWidth="2" fill="none" />
          <text
            x={(x1 + x2) / 2}
            y={base + 38}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#B87A6F"
            fontFamily="inherit"
          >
            {bigSquares} cuadros
          </text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg text-[#7D8A96]">
          300 ÷ {bigSquares} = <b className="text-[#2C3E50]">{bpm}</b> lpm
        </span>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
            inRange ? 'bg-[#8BA888]/15 text-[#6a8a67]' : 'bg-[#F2EFED] text-[#7D8A96]'
          }`}
        >
          {inRange ? 'Frecuencia normal ✓' : bpm < step.targetMin ? 'Bradicardia' : 'Taquicardia'}
        </span>
      </div>

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
    </div>
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

function AxisStep({ step, onSolved }: StepProps<'axis'>) {
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

  return (
    <div>
      <Prompt>{step.prompt}</Prompt>

      <div className="mx-auto h-56 w-56">
        <svg viewBox="0 0 220 220" className="h-full w-full">
          <circle cx={cx} cy={cy} r={R} fill="#FFF7F4" stroke="#EAE4E2" strokeWidth="2" />
          <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="#D9D2CE" strokeWidth="1.5" />
          <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="#D9D2CE" strokeWidth="1.5" />
          <text x={cx + R - 34} y={cy - 8} fontSize="9" fontWeight="700" fill="#A8988F" fontFamily="inherit">
            I+ (0°)
          </text>
          <text x={cx + 6} y={cy + R - 6} fontSize="9" fontWeight="700" fill="#A8988F" fontFamily="inherit">
            aVF+ (+90°)
          </text>
          <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={q.color} strokeWidth="4" strokeLinecap="round" />
          <circle cx={ex} cy={ey} r="6" fill={q.color} />
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="18" fontWeight="800" fill={q.color} fontFamily="inherit">
            {angle}°
          </text>
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
            iPos ? 'bg-[#8BA888]/15 text-[#6a8a67]' : 'bg-[#C4655A]/12 text-[#C4655A]'
          }`}
        >
          I {iPos ? '▲' : '▼'}
        </span>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
            fPos ? 'bg-[#8BA888]/15 text-[#6a8a67]' : 'bg-[#C4655A]/12 text-[#C4655A]'
          }`}
        >
          aVF {fPos ? '▲' : '▼'}
        </span>
        <span className="text-sm font-bold" style={{ color: q.color }}>
          {q.name}
        </span>
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
    </div>
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

  const renderNode = (nodeId: string, path: string): React.ReactNode => {
    const node = tree.nodes[nodeId]
    if (!node) return null

    if (isLeaf(node)) {
      const key = `l:${path}`
      const visible = isVisible(key)
      const active = selected?.path === path
      return (
        <button
          type="button"
          disabled={!visible}
          onClick={() => {
            setSelected({ path, node })
            solve()
          }}
          className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
            visible ? 'opacity-100' : 'pointer-events-none opacity-0'
          } ${
            active
              ? 'border-[#2C3E50] bg-[#FFF5F3] shadow-sm'
              : 'border-[#EAE4E2] bg-white hover:border-[#E8A598]'
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SEV_COLOR[node.sev] }} />
          <span className="min-w-0 flex-1 text-xs font-semibold text-[#2C3E50]">{node.dx}</span>
          <span className="material-symbols-outlined text-sm text-[#7D8A96]/60">chevron_right</span>
        </button>
      )
    }

    const qKey = `q:${path}`
    return (
      <div className="flex flex-col gap-2">
        <div
          className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-opacity ${
            isVisible(qKey) ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            ?
          </span>
          <span className="text-xs font-bold text-[#2C3E50]">{node.q.replace(/^\d\)\s*/, '')}</span>
        </div>

        <div className="flex flex-col gap-2 border-l-2 border-dashed border-[#EAE4E2] pl-3">
          {node.options.map((option, i) => {
            const bKey = `b:${path}/${i}`
            const childPath = `${path}/${i}`
            // Una rama se ilumina si el diagnóstico elegido cuelga de ella.
            const onPath = selected ? selected.path.startsWith(childPath) : false
            return (
              <div key={bKey} className="flex flex-col gap-1.5">
                <span
                  className={`self-start rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    isVisible(bKey) ? 'opacity-100' : 'opacity-0'
                  } ${onPath ? 'bg-[#2C3E50] text-white' : 'bg-[#F2EFED] text-[#7D8A96]'}`}
                >
                  {option.label}
                </span>
                <div className="pl-2">{renderNode(option.go, childPath)}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-3 text-sm leading-relaxed text-[#7D8A96]">{tree.intro}</p>

      <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#EAE4E2] bg-white p-2.5">
        <button
          type="button"
          onClick={() => (playing && progress < 1 ? setPlaying(false) : play())}
          className="rounded-full bg-[#E8A598] p-1.5 text-white transition-colors hover:bg-[#d18d80]"
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
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#EAE4E2] accent-[#E8A598]"
        />
      </div>

      <div className="rounded-xl border border-[#EAE4E2] bg-[#FCFAF9] p-3">{renderNode(tree.root, '')}</div>

      {selected ? (
        <motion.div
          className="mt-3 rounded-xl border border-[#EAE4E2] bg-white p-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SEV_COLOR[selected.node.sev] }}
            />
            <h3 className="text-base font-bold text-[#2C3E50]">{selected.node.dx}</h3>
            <span className="rounded bg-[#F2EFED] px-2 py-0.5 text-[10px] font-bold text-[#7D8A96]">
              {selected.node.badge}
            </span>
          </div>
          {/* La caja copia la proporción del viewBox para que el papel llegue
              a los bordes en vez de dejar márgenes blancos a los lados. */}
          <div className="mb-3 aspect-[320/104] w-full overflow-hidden rounded-lg border border-[#EAE4E2]">
            <RhythmStrip kind={selected.node.strip} label={selected.node.badge} />
          </div>
          <p className="mb-1.5 text-sm text-[#2C3E50]">
            <b>En el ECG:</b> {selected.node.clue}
          </p>
          <p className="text-sm text-[#7D8A96]">{selected.node.why}</p>
        </motion.div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#7D8A96]/70">
          <span className="material-symbols-outlined text-sm">touch_app</span>
          Toca un diagnóstico para iluminar su camino y ver el detalle.
        </p>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   TERRITORY
═══════════════════════════════════════════════════════════════════════════ */
function TerritoryStep({ step, onSolved }: StepProps<'territory'>) {
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

  return (
    <div>
      <Prompt>{step.prompt}</Prompt>
      <div className="mx-auto h-56 w-56">
        <Bullseye onPick={pick} solvedId={solved} wrongId={wrong} />
      </div>

      {wall ? (
        <div className="mt-3 rounded-xl border border-[#EAE4E2] bg-white p-3.5 text-sm">
          <b className="text-[#2C3E50]">Cara {wall.name.toLowerCase()}</b>
          <p className="mt-1 text-[#7D8A96]">
            <i>Derivaciones:</i> {wall.leads}
          </p>
          <p className="text-[#7D8A96]">
            <i>Arteria:</i> {wall.artery}
          </p>
        </div>
      ) : showHint ? (
        <p className="mt-3 text-center text-sm text-[#C9A24A]">
          Pista: relaciona el grupo de derivaciones con su pared.
        </p>
      ) : null}

      {solved ? <Feedback ok>{step.ok}</Feedback> : null}
    </div>
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

function LadderStep({ step }: StepProps<'ladder'>) {
  const [kind, setKind] = useState(step.kinds[0])
  const [head, setHead] = useState(0)

  // El cabezal barre en bucle; cambiar de patrón no lo reinicia porque el ciclo
  // se repite continuamente y cortarlo a media pasada se ve peor.
  useAnimationLoop((t) => setHead((t * 82) % 360), true)

  return (
    <div>
      <Prompt>{step.prompt}</Prompt>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {step.kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              kind === k ? 'bg-[#E8A598] text-white' : 'bg-[#F2EFED] text-[#7D8A96] hover:bg-[#EAE4E2]'
            }`}
          >
            {LADDER_NAMES[k]}
          </button>
        ))}
      </div>

      <div className="h-40 overflow-hidden rounded-xl border border-[#EAE4E2]">
        <ConductionLadder kind={kind} head={head} />
      </div>

      <p className="mt-3 text-sm text-[#7D8A96]">{LADDER_CAPTIONS[kind]}</p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SUMMARY
═══════════════════════════════════════════════════════════════════════════ */
function SummaryStep({ step }: StepProps<'summary'>) {
  return (
    <div className="text-center">
      <span className="material-symbols-outlined mb-3 text-6xl text-[#E8A598]">workspace_premium</span>
      <p className="mb-5 text-base leading-relaxed text-[#7D8A96]">{step.body}</p>
      <Link
        href="/studio/electros/explorador"
        className="inline-flex items-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80]"
      >
        {step.cta}
        <span className="material-symbols-outlined text-lg">arrow_forward</span>
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
