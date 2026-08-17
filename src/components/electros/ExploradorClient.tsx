'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { MonitorCanvas, TwelveLeadCanvas } from '@/components/electros/EcgCanvases'
import { synthesize, type Synth } from '@/lib/electros/ecgCore'
import { LEAD_ORDER, type LeadName } from '@/lib/electros/leads'
import {
  CATEGORIES,
  normalizeAnswer,
  PATTERNS,
  type SearchablePattern,
  type Severity,
} from '@/lib/electros/patterns'

const SEV_COLOR: Record<Severity, string> = {
  normal: '#8BA888',
  warn: '#C9A24A',
  crit: '#C4655A',
}

const SPEEDS = [0.5, 1, 2] as const
const QUIZ_LEN = 10

type Mode = 'explorador' | 'examen'

/** Un pitido corto sincronizado con el QRS, como el de un monitor real. */
function useBeepPlayer(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!enabled) return
    return () => {
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [enabled])

  return useCallback(() => {
    if (!enabled) return
    try {
      // El contexto se crea en el primer beep: para entonces ya ha habido un
      // gesto del usuario (activar el sonido), así que el navegador lo permite.
      const ctx = (ctxRef.current ??= new AudioContext())
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch {
      // Sin audio disponible; el monitor sigue funcionando en silencio.
    }
  }, [enabled])
}

export default function ExploradorClient() {
  const [mode, setMode] = useState<Mode>('explorador')

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2C3E50] sm:text-4xl">
            Explorador de 12 derivaciones
          </h1>
          <p className="mt-1 max-w-2xl text-base font-light text-[#7D8A96]">
            {PATTERNS.length} diagnósticos sintetizados en tiempo real · 25 mm/s · 10 mm/mV
          </p>
        </div>

        <div
          className="flex shrink-0 rounded-xl border border-[#EAE4E2] bg-white p-1 shadow-sm"
          role="tablist"
          aria-label="Modo del explorador"
        >
          {(
            [
              { id: 'explorador', label: 'Explorador clínico', icon: 'monitor_heart' },
              { id: 'examen', label: 'Modo examen', icon: 'quiz' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                mode === tab.id ? 'bg-[#E8A598] text-white shadow-sm' : 'text-[#7D8A96] hover:bg-[#F2EFED]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {mode === 'explorador' ? <ExplorerMode /> : <QuizMode />}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   MODO EXPLORADOR
═══════════════════════════════════════════════════════════════════════════ */
function ExplorerMode() {
  const [activeId, setActiveId] = useState(PATTERNS[0].id)
  const [lead, setLead] = useState<LeadName>('II')
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState<number>(1)
  const [soundOn, setSoundOn] = useState(false)
  const [beatTick, setBeatTick] = useState(0)

  const pattern = useMemo(() => PATTERNS.find((p) => p.id === activeId) ?? PATTERNS[0], [activeId])
  // La síntesis de 10 s a 500 Hz sobre 12 derivaciones no es gratis: solo se
  // recalcula al cambiar de patrón, nunca en cada render.
  const synth = useMemo<Synth>(() => synthesize(pattern), [pattern])

  const beep = useBeepPlayer(soundOn)
  const handleBeat = useCallback(() => {
    beep()
    setBeatTick((n) => n + 1)
  }, [beep])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
      <PatternRail activeId={activeId} onSelect={setActiveId} />

      <div className="flex min-w-0 flex-col gap-5">
        {/* ── Monitor de cabecera ─────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border-2 border-[#2c3e50] bg-[#241c1a] shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Derivación del monitor">
              {LEAD_ORDER.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setLead(name)}
                  aria-pressed={lead === name}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                    lead === name
                      ? 'bg-[#E8A598] text-[#241c1a]'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <motion.span
                  key={beatTick}
                  className="material-symbols-outlined text-xl text-[#E8A598]"
                  initial={{ scale: 1 }}
                  animate={{ scale: [1.35, 1] }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  favorite
                </motion.span>
                <span className="text-2xl font-black text-white tabular-nums">
                  {pattern.hr > 0 ? pattern.hr : '--'}
                </span>
                <span className="text-xs font-medium text-white/50">lpm</span>
              </div>
              <button
                type="button"
                onClick={() => setSoundOn((s) => !s)}
                aria-pressed={soundOn}
                title={soundOn ? 'Silenciar' : 'Activar sonido'}
                className={`rounded-lg p-1.5 transition-colors ${
                  soundOn ? 'bg-[#E8A598] text-[#241c1a]' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{soundOn ? 'volume_up' : 'volume_off'}</span>
              </button>
            </div>
          </div>

          <MonitorCanvas
            synth={synth}
            lead={lead}
            running={running}
            speed={speed}
            onBeat={handleBeat}
            className="h-[210px] w-full sm:h-[250px]"
          />

          <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="rounded-lg bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
              title={running ? 'Pausa' : 'Reanudar'}
            >
              <span className="material-symbols-outlined text-lg">{running ? 'pause' : 'play_arrow'}</span>
            </button>

            <div className="flex rounded-lg bg-white/10 p-0.5" role="group" aria-label="Velocidad">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    speed === s ? 'bg-[#E8A598] text-[#241c1a]' : 'text-white/70 hover:text-white'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap gap-1.5">
              {Object.entries(pattern.intervals).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-md bg-white/[0.07] px-2 py-1 text-[10px] font-medium uppercase text-white/50"
                >
                  {key} <b className="text-white/90">{value}</b>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── ECG de 12 derivaciones ──────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#EAE4E2] px-4 py-2.5">
            <span className="material-symbols-outlined text-lg text-[#E8A598]">grid_on</span>
            <h2 className="text-sm font-bold text-[#2C3E50]">ECG de 12 derivaciones</h2>
            <span className="ml-auto text-[11px] text-[#7D8A96]/70">
              4×3 + tira de ritmo · 25 mm/s · 10 mm/mV
            </span>
          </div>
          <TwelveLeadCanvas synth={synth} rhythmLead={lead} className="h-[380px] sm:h-[480px]" />
        </section>

        {/* ── Ficha clínica ───────────────────────────────────────────── */}
        <PatternInfo pattern={pattern} />
      </div>
    </div>
  )
}

function PatternRail({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  return (
    <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
      <nav className="flex max-h-[320px] flex-col gap-4 overflow-y-auto rounded-2xl border border-[#EAE4E2] bg-white p-3 shadow-sm lg:max-h-none">
        {CATEGORIES.map((category) => {
          const items = PATTERNS.filter((p) => p.category === category)
          if (!items.length) return null
          return (
            <div key={category}>
              <h3 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/60">
                {category}
              </h3>
              <div className="flex flex-col gap-0.5">
                {items.map((p) => {
                  const active = p.id === activeId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelect(p.id)}
                      aria-current={active}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        active ? 'bg-[#FFF5F3] ring-1 ring-[#E8A598]/40' : 'hover:bg-[#F7F4F2]'
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SEV_COLOR[p.severity] }}
                        aria-hidden="true"
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${
                          active ? 'font-bold text-[#2C3E50]' : 'font-medium text-[#7D8A96]'
                        }`}
                      >
                        {p.name}
                      </span>
                      <span className="shrink-0 rounded bg-[#F2EFED] px-1.5 py-0.5 text-[9px] font-bold text-[#7D8A96]/80">
                        {p.badge}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function PatternInfo({ pattern }: { pattern: SearchablePattern }) {
  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={pattern.id}
        className="rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: SEV_COLOR[pattern.severity] }}
            aria-hidden="true"
          />
          <h2 className="text-xl font-bold text-[#2C3E50]">{pattern.name}</h2>
          <span className="rounded border border-[#E8A598]/25 bg-[#E8A598]/10 px-2 py-0.5 text-[10px] font-bold text-[#d18d80]">
            {pattern.badge}
          </span>
        </div>

        <p className="mb-4 text-sm text-[#7D8A96]">{pattern.summary}</p>

        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/60">Claves en el ECG</h3>
        <ul className="mb-4 flex flex-col gap-1.5">
          {pattern.findings.map((finding) => (
            <li key={finding} className="flex items-start gap-2 text-sm text-[#7D8A96]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8A598]" aria-hidden="true" />
              {finding}
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-2.5 rounded-xl border border-[#E8A598]/20 bg-[#FFF5F3] p-3.5">
          <span className="material-symbols-outlined text-lg text-[#E8A598]">lightbulb</span>
          <p className="text-sm text-[#2C3E50]">{pattern.pearl}</p>
        </div>
      </motion.article>
    </AnimatePresence>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   MODO EXAMEN
   Entrenamiento visual: NO registra nada en las estadísticas de rendimiento
   (esas se alimentan solo de preguntas del banco MIR, con asignatura y tema).
═══════════════════════════════════════════════════════════════════════════ */
function shuffle<T>(input: readonly T[]): T[] {
  const a = [...input]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function searchPatterns(query: string): SearchablePattern[] {
  const nq = normalizeAnswer(query)
  if (!nq) return []
  const scored: { p: SearchablePattern; best: number }[] = []
  for (const p of PATTERNS) {
    let best = Infinity
    for (const term of p.search) {
      const nt = normalizeAnswer(term)
      const idx = nt.indexOf(nq)
      // Coincidencia exacta primero, luego cuanto antes empiece el término.
      if (idx >= 0) best = Math.min(best, idx + (nt === nq ? -100 : 0))
    }
    if (best !== Infinity) scored.push({ p, best })
  }
  scored.sort((a, b) => a.best - b.best || a.p.name.localeCompare(b.p.name))
  return scored.slice(0, 6).map((s) => s.p)
}

type QuizPhase = 'playing' | 'results'

function QuizMode() {
  const [deck, setDeck] = useState<SearchablePattern[]>(() => shuffle(PATTERNS).slice(0, QUIZ_LEN))
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answer, setAnswer] = useState<SearchablePattern | null>(null)
  const [phase, setPhase] = useState<QuizPhase>('playing')

  const current = deck[index]
  const synth = useMemo<Synth>(() => synthesize(current), [current])

  const restart = useCallback(() => {
    setDeck(shuffle(PATTERNS).slice(0, QUIZ_LEN))
    setIndex(0)
    setScore(0)
    setAnswer(null)
    setPhase('playing')
  }, [])

  const submit = useCallback(
    (chosen: SearchablePattern) => {
      if (answer) return
      setAnswer(chosen)
      if (chosen.id === current.id) setScore((s) => s + 1)
    },
    [answer, current.id],
  )

  const next = useCallback(() => {
    if (index >= QUIZ_LEN - 1) {
      setPhase('results')
      return
    }
    setIndex((i) => i + 1)
    setAnswer(null)
  }, [index])

  if (phase === 'results') return <QuizResults score={score} onRetry={restart} />

  const correct = answer?.id === current.id

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EAE4E2]">
          <motion.div
            className="h-full rounded-full bg-[#E8A598]"
            initial={false}
            animate={{ width: `${((index + (answer ? 1 : 0)) / QUIZ_LEN) * 100}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs font-bold text-[#7D8A96] tabular-nums">
          {index + 1} / {QUIZ_LEN}
        </span>
        <span className="flex items-center gap-1 rounded-lg bg-[#FFF5F3] px-2 py-1 text-xs font-bold text-[#d18d80]">
          <span className="material-symbols-outlined text-sm">star</span>
          {score}
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EAE4E2] px-4 py-2.5">
          <span className="material-symbols-outlined text-lg text-[#E8A598]">ecg_heart</span>
          <h2 className="text-sm font-bold text-[#2C3E50]">¿Qué diagnóstico ves?</h2>
          <span className="ml-auto text-[11px] text-[#7D8A96]/70">
            {current.hr > 0 ? `FC ${current.hr} lpm` : 'FC —'}
          </span>
        </div>
        <TwelveLeadCanvas synth={synth} className="h-[380px] sm:h-[480px]" />
      </section>

      {answer ? (
        <motion.div
          className={`rounded-2xl border p-5 ${
            correct ? 'border-[#8BA888]/30 bg-[#F1F5F0]' : 'border-[#C4655A]/30 bg-[#FDF2F0]'
          }`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <div
            className={`mb-2 flex items-center gap-2 text-base font-bold ${
              correct ? 'text-[#6a8a67]' : 'text-[#C4655A]'
            }`}
          >
            <span className="material-symbols-outlined">{correct ? 'check_circle' : 'cancel'}</span>
            {correct ? '¡Correcto!' : 'Incorrecto'}
          </div>
          {!correct ? (
            <p className="mb-1.5 text-sm text-[#7D8A96]">
              Tu respuesta: <b>{answer.name}</b>
            </p>
          ) : null}
          <p className="text-sm text-[#2C3E50]">
            <b>{current.name}.</b> {current.pearl}
          </p>
          <button
            type="button"
            onClick={next}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80]"
          >
            {index >= QUIZ_LEN - 1 ? 'Ver resultados' : 'Siguiente'}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </motion.div>
      ) : (
        <DiagnosisTypeahead onSubmit={submit} />
      )}
    </div>
  )
}

function DiagnosisTypeahead({ onSubmit }: { onSubmit: (p: SearchablePattern) => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SearchablePattern | null>(null)
  const [highlight, setHighlight] = useState(-1)
  const [open, setOpen] = useState(false)

  const suggestions = useMemo(() => (selected ? [] : searchPatterns(query)), [query, selected])

  const choose = useCallback((p: SearchablePattern) => {
    setSelected(p)
    setQuery(p.name)
    setOpen(false)
    setHighlight(-1)
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    setHighlight(-1)
    setOpen(true)
    // Escribir el nombre completo a mano también vale como selección.
    const exact = PATTERNS.find((p) => normalizeAnswer(p.name) === normalizeAnswer(value))
    setSelected(exact ?? null)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (highlight >= 0 && suggestions[highlight]) choose(suggestions[highlight])
      else if (selected) onSubmit(selected)
      else if (suggestions.length === 1) choose(suggestions[0])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm">
      <label htmlFor="dx-input" className="mb-2 block text-sm font-bold text-[#2C3E50]">
        Escribe tu diagnóstico
      </label>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2.5 focus-within:border-[#E8A598]">
          <span className="material-symbols-outlined text-lg text-[#E8A598]">stylus_note</span>
          <input
            id="dx-input"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder="p. ej. STEMI inferior, BRD, FA…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#2C3E50] outline-none placeholder:text-[#7D8A96]/50"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setSelected(null)
                setHighlight(-1)
              }}
              title="Borrar"
              className="rounded p-0.5 text-[#7D8A96] transition-colors hover:text-[#2C3E50]"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          ) : null}
        </div>

        {open && suggestions.length ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#EAE4E2] bg-white py-1 shadow-lg">
            {suggestions.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  // mousedown, no click: el blur del input cerraría la lista antes.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(p)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    i === highlight ? 'bg-[#FFF5F3]' : 'hover:bg-[#F7F4F2]'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: SEV_COLOR[p.severity] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-[#2C3E50]">{p.name}</span>
                  <span className="shrink-0 rounded bg-[#F2EFED] px-1.5 py-0.5 text-[9px] font-bold text-[#7D8A96]/80">
                    {p.badge}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && onSubmit(selected)}
        className="mt-4 w-full rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80] disabled:cursor-not-allowed disabled:bg-[#E8A598]/40"
      >
        Confirmar diagnóstico
      </button>
    </div>
  )
}

function QuizResults({ score, onRetry }: { score: number; onRetry: () => void }) {
  const pct = Math.round((score / QUIZ_LEN) * 100)
  const circumference = 2 * Math.PI * 44

  const { emoji, message, color } =
    pct === 100
      ? { emoji: '🏆', message: '¡Perfecto! Dominas los patrones del MIR.', color: '#8BA888' }
      : pct >= 70
        ? {
            emoji: '🫀',
            message: `${score} de ${QUIZ_LEN} aciertos. Muy buen nivel, repasa los fallos.`,
            color: '#8BA888',
          }
        : pct >= 40
          ? {
              emoji: '📈',
              message: `${score} de ${QUIZ_LEN}. Vas por buen camino; vuelve al explorador para afianzar.`,
              color: '#C9A24A',
            }
          : {
              emoji: '📖',
              message: `${score} de ${QUIZ_LEN}. Repasa los patrones en el explorador y vuelve a intentarlo.`,
              color: '#C4655A',
            }

  return (
    <section className="flex flex-col items-center gap-5 rounded-2xl border border-[#EAE4E2] bg-white px-6 py-10 text-center shadow-sm">
      <span className="text-5xl" aria-hidden="true">
        {emoji}
      </span>
      <h2 className="text-2xl font-bold text-[#2C3E50]">Examen completado</h2>

      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#EDE9E4" strokeWidth="8" />
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-[#2C3E50]">
          {pct}%
        </div>
      </div>

      <p className="max-w-sm text-sm text-[#7D8A96]">{message}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-[#E8A598] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80]"
        >
          Repetir examen
        </button>
        <Link
          href="/studio/electros"
          className="rounded-xl border border-[#7D8A96]/30 bg-white px-6 py-3 text-sm font-semibold text-[#7D8A96] transition-colors hover:bg-[#F2EFED]"
        >
          Volver a Electros
        </Link>
      </div>
    </section>
  )
}
