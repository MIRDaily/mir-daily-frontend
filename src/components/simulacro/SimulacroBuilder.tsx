'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fetchSubjects, fetchTopics } from '@/lib/simulacro/queries'
import SimulacroTopicPicker from '@/components/simulacro/SimulacroTopicPicker'
import { GhostButton, Hero, StepBadge, StickerCard } from '@/components/ui/sticker'
import type {
  SimulacroConfig,
  SimulacroMode,
  Subject,
  Topic,
} from '@/lib/simulacro/types'

type SimulacroBuilderProps = {
  onSubmit: (config: SimulacroConfig) => void
  generating: boolean
  generationError: string | null
}

const MODE_OPTIONS: ReadonlyArray<{
  value: SimulacroMode
  title: string
  description: string
  icon: string
}> = [
  {
    value: 'immediate',
    title: 'Corrección inmediata',
    description: 'Ves si aciertas y la explicación justo al responder.',
    icon: 'bolt',
  },
  {
    value: 'deferred',
    title: 'Corrección al final',
    description: 'Sin pistas durante el test; repasas todo al terminar.',
    icon: 'flag',
  },
] as const

export default function SimulacroBuilder({
  onSubmit,
  generating,
  generationError,
}: SimulacroBuilderProps) {
  const reduceMotion = useReducedMotion()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)

  const [topics, setTopics] = useState<Topic[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([])
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState<SimulacroMode>('immediate')

  useEffect(() => {
    let active = true
    setLoadingSubjects(true)
    fetchSubjects()
      .then((data) => {
        if (!active) return
        setSubjects(data)
        setSubjectsError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setSubjectsError(
          err instanceof Error ? err.message : 'No se pudieron cargar las asignaturas.',
        )
      })
      .finally(() => {
        if (active) setLoadingSubjects(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Cargar temas cada vez que cambian las asignaturas seleccionadas.
  useEffect(() => {
    if (selectedSubjectIds.length === 0) {
      setTopics([])
      setSelectedTopicIds([])
      return
    }

    let active = true
    setLoadingTopics(true)
    fetchTopics(selectedSubjectIds)
      .then((data) => {
        if (!active) return
        setTopics(data)
        // Conservar solo los temas que siguen siendo válidos.
        const validIds = new Set(data.map((t) => t.id))
        setSelectedTopicIds((prev) => prev.filter((id) => validIds.has(id)))
      })
      .catch(() => {
        if (active) setTopics([])
      })
      .finally(() => {
        if (active) setLoadingTopics(false)
      })
    return () => {
      active = false
    }
  }, [selectedSubjectIds])

  const toggleSubject = (id: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const toggleTopic = (id: number) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  // Temas agrupados por asignatura, en el orden en que se eligieron las asignaturas.
  const groupedTopics = useMemo(() => {
    return selectedSubjectIds.map((subjectId) => ({
      subject: subjects.find((s) => s.id === subjectId) ?? null,
      subjectId,
      items: topics.filter((t) => t.subject_id === subjectId),
    }))
  }, [selectedSubjectIds, subjects, topics])

  // Modal de selección de temas.
  const [topicPickerOpen, setTopicPickerOpen] = useState(false)

  // Nombres de los temas seleccionados, para el resumen (chips).
  const selectedTopicChips = useMemo(() => {
    const byId = new Map(topics.map((t) => [t.id, t]))
    return selectedTopicIds
      .map((id) => byId.get(id))
      .filter((t): t is Topic => Boolean(t))
  }, [topics, selectedTopicIds])

  // Marca/desmarca todos los temas de una asignatura de una vez.
  const setAllTopicsForSubject = (items: Topic[], select: boolean) => {
    const ids = items.map((t) => t.id)
    setSelectedTopicIds((prev) => {
      if (select) return Array.from(new Set([...prev, ...ids]))
      const remove = new Set(ids)
      return prev.filter((id) => !remove.has(id))
    })
  }

  const canSubmit = selectedSubjectIds.length > 0 && count >= 1 && !generating

  const fadeIn = useMemo(
    () =>
      reduceMotion
        ? { initial: false as const }
        : {
            initial: { opacity: 0, y: 16, filter: 'blur(4px)' },
            animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
            transition: { duration: 0.5, ease: 'easeOut' as const },
          },
    [reduceMotion],
  )

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      subjectIds: selectedSubjectIds,
      topicIds: selectedTopicIds,
      count,
      mode,
    })
  }

  return (
    <motion.div className="mx-auto w-full max-w-6xl" {...fadeIn}>
      <Hero
        badge="Crear simulacro"
        badgeIcon="quiz"
        title="Diseña tu simulacro"
        subtitle="Elige asignaturas y temas, cuántas preguntas quieres y cómo corregirlo."
        aside={<ExamPadArt />}
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
        {/* Paso 1 — Asignaturas */}
        <StickerCard as="section" className="p-6" depth={4}>
          <div className="mb-4 flex items-center gap-3">
            <StepBadge n={1} active={selectedSubjectIds.length > 0} />
            <h2 className="text-lg font-black text-[#2c3e50]">Asignaturas</h2>
            {selectedSubjectIds.length > 0 ? (
              <span className="ml-auto rounded-full bg-[#E8A598]/15 px-2.5 py-1 text-[11px] font-black text-[#d18d80]">
                {selectedSubjectIds.length}
              </span>
            ) : null}
          </div>

          {loadingSubjects ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`subject-skeleton-${i}`}
                  className="h-10 w-36 animate-pulse rounded-full bg-[#F2EEEB]"
                />
              ))}
            </div>
          ) : subjectsError ? (
            <p className="text-sm font-semibold text-[#C4655A]">{subjectsError}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject, i) => {
                const active = selectedSubjectIds.includes(subject.id)
                return (
                  <motion.button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.3, 0.02 * i), duration: 0.28, ease: 'easeOut' }}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-all ${
                      active
                        ? 'border-[#2c3e50] bg-[#E8A598] text-white'
                        : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:-translate-y-0.5 hover:border-[#2c3e50] hover:text-[#2c3e50]'
                    }`}
                    style={active ? { boxShadow: '3px 3px 0 0 #2c3e50' } : undefined}
                  >
                    {subject.name}
                  </motion.button>
                )
              })}
            </div>
          )}
        </StickerCard>

        {/* Paso 2 — Temas */}
        <StickerCard as="section" className="p-6" depth={4}>
          <div className="mb-1 flex items-center gap-3">
            <StepBadge n={2} active={selectedTopicIds.length > 0} />
            <h2 className="text-lg font-black text-[#2c3e50]">Temas</h2>
            {selectedTopicIds.length > 0 ? (
              <span className="ml-auto rounded-full bg-[#8BA888]/15 px-2.5 py-1 text-[11px] font-black text-[#5f7d5c]">
                {selectedTopicIds.length}
              </span>
            ) : null}
          </div>
          <p className="mb-4 ml-11 text-xs text-[#7D8A96]">
            Opcional. Si no eliges ninguno, se incluyen todos los temas de las
            asignaturas seleccionadas.
          </p>

          {selectedSubjectIds.length === 0 ? (
            <p className="ml-11 text-sm text-[#7D8A96]/70">
              Selecciona una asignatura para ver sus temas.
            </p>
          ) : loadingTopics ? (
            <div className="ml-11 flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={`topic-skeleton-${i}`}
                  className="h-16 w-full animate-pulse rounded-xl bg-[#F2EEEB]"
                />
              ))}
            </div>
          ) : (
            <div className="ml-11 flex flex-col gap-3">
              {selectedTopicChips.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-[#EAE4E2] bg-[#FAF7F4] px-4 py-3 text-sm text-[#7D8A96]">
                  Ahora mismo se incluirán{' '}
                  <span className="font-black text-[#2c3e50]">todos los temas</span> de las
                  asignaturas elegidas.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedTopicChips.slice(0, 8).map((topic) => (
                    <span
                      key={topic.id}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#8BA888]/50 bg-[#8BA888]/10 py-1.5 pl-3 pr-2 text-sm font-bold text-[#5f7d5c]"
                    >
                      {topic.name}
                      <button
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        aria-label={`Quitar ${topic.name}`}
                        className="flex items-center justify-center text-[#5f7d5c]/70 transition-colors hover:text-[#C4655A]"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </span>
                  ))}
                  {selectedTopicChips.length > 8 ? (
                    <span className="inline-flex items-center rounded-full bg-[#F2EFED] px-3 py-1.5 text-sm font-bold text-[#7D8A96]">
                      +{selectedTopicChips.length - 8} más
                    </span>
                  ) : null}
                </div>
              )}

              <GhostButton
                icon="tune"
                onClick={() => setTopicPickerOpen(true)}
                className="w-full sm:w-auto"
              >
                {selectedTopicChips.length > 0 ? 'Editar temas' : 'Elegir temas concretos'}
              </GhostButton>
            </div>
          )}
        </StickerCard>

        <SimulacroTopicPicker
          open={topicPickerOpen}
          groups={groupedTopics}
          selectedTopicIds={selectedTopicIds}
          onToggleTopic={toggleTopic}
          onSetAllForSubject={setAllTopicsForSubject}
          onClearAll={() => setSelectedTopicIds([])}
          onClose={() => setTopicPickerOpen(false)}
        />

        {/* Paso 3 — Nº de preguntas */}
        <StickerCard as="section" className="p-6" depth={4}>
          <div className="mb-4 flex items-center gap-3">
            <StepBadge n={3} active />
            <h2 className="text-lg font-black text-[#2c3e50]">Nº de preguntas</h2>
          </div>

          <div className="ml-11 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#FAF7F4] p-1">
              <button
                type="button"
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#7D8A96] transition-colors hover:bg-white hover:text-[#C4655A]"
                aria-label="Restar una pregunta"
              >
                <span className="material-symbols-outlined text-lg">remove</span>
              </button>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setCount(Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1)
                }}
                className="w-16 bg-transparent text-center text-2xl font-black text-[#2c3e50] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setCount((c) => c + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#7D8A96] transition-colors hover:bg-white hover:text-[#8BA888]"
                aria-label="Sumar una pregunta"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
            </div>
            <div className="flex gap-2">
              {[5, 10, 20, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCount(preset)}
                  className={`rounded-xl border-2 px-3.5 py-2 text-sm font-black transition-all ${
                    count === preset
                      ? 'border-[#2c3e50] bg-[#E8A598] text-white'
                      : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:-translate-y-0.5 hover:border-[#2c3e50]'
                  }`}
                  style={count === preset ? { boxShadow: '3px 3px 0 0 #2c3e50' } : undefined}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <p className="ml-11 mt-3 text-xs text-[#7D8A96]/80">
            Si hay menos preguntas disponibles que las pedidas, se usarán las que haya.
          </p>
        </StickerCard>

        {/* Paso 4 — Modo */}
        <StickerCard as="section" className="p-6" depth={4}>
          <div className="mb-4 flex items-center gap-3">
            <StepBadge n={4} active />
            <h2 className="text-lg font-black text-[#2c3e50]">Modo de corrección</h2>
          </div>

          <div className="ml-11 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MODE_OPTIONS.map((option) => {
              const active = mode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                    active
                      ? 'border-[#2c3e50] bg-[#fff0ec]'
                      : 'border-[#EAE4E2] bg-white hover:-translate-y-0.5 hover:border-[#2c3e50]'
                  }`}
                  style={active ? { boxShadow: '4px 4px 0 0 #2c3e50' } : undefined}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      active ? 'bg-[#E8A598] text-white' : 'bg-[#F2EFED] text-[#7D8A96]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{option.icon}</span>
                  </span>
                  <span>
                    <span className="block text-sm font-black text-[#2c3e50]">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-[#7D8A96]">{option.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </StickerCard>
        </div>

        {/* Resumen: lo que vas a generar, siempre a la vista */}
        <aside className="lg:sticky lg:top-6">
          <StickerCard className="overflow-hidden" depth={6}>
            <div className="border-b-2 border-[#2c3e50] bg-[#FFF5F2] px-5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d18d80]">
                Tu simulacro
              </p>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="text-center">
                <p className="text-5xl font-black leading-none text-[#2c3e50] tabular-nums">{count}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#7D8A96]/70">
                  {count === 1 ? 'pregunta' : 'preguntas'}
                </p>
              </div>

              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[#7D8A96]">Asignaturas</dt>
                  <dd className="font-black text-[#2c3e50]">
                    {selectedSubjectIds.length || <span className="text-[#C4655A]">—</span>}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[#7D8A96]">Temas</dt>
                  <dd className="font-black text-[#2c3e50]">
                    {selectedTopicIds.length > 0 ? selectedTopicIds.length : 'Todos'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[#7D8A96]">Corrección</dt>
                  <dd className="text-right font-black text-[#2c3e50]">
                    {mode === 'immediate' ? 'Inmediata' : 'Al final'}
                  </dd>
                </div>
              </dl>

              {generationError ? (
                <p className="rounded-xl border-2 border-[#E8A598]/40 bg-[#FFF8F6] px-3 py-2.5 text-xs font-semibold text-[#C4655A]">
                  {generationError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-6 py-4 text-base font-black text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
              >
                {generating ? (
                  <>
                    Generando
                    <span className="material-symbols-outlined animate-spin text-xl">
                      progress_activity
                    </span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">play_arrow</span>
                    Generar simulacro
                  </>
                )}
              </button>

              {selectedSubjectIds.length === 0 ? (
                <p className="text-center text-xs text-[#7D8A96]/70">
                  Elige al menos una asignatura para empezar.
                </p>
              ) : null}
            </div>
          </StickerCard>
        </aside>
      </div>
    </motion.div>
  )
}

/** Arte de la portada: un cuadernillo de examen con su lápiz. */
function ExamPadArt() {
  return (
    <motion.svg
      viewBox="0 0 200 150"
      className="h-32 w-40 lg:h-40 lg:w-52"
      aria-hidden
      animate={{ y: [0, -7, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <rect x="30" y="14" width="122" height="120" rx="12" fill="#fff" stroke="#2c3e50" strokeWidth="4" />
      <rect x="66" y="6" width="50" height="16" rx="8" fill="#E8A598" stroke="#2c3e50" strokeWidth="4" />
      {[46, 70, 94].map((y, i) => (
        <g key={y}>
          <circle
            cx="50"
            cy={y}
            r="7"
            fill={i === 1 ? '#8BA888' : '#fff'}
            stroke="#2c3e50"
            strokeWidth="3.5"
          />
          <line
            x1="66"
            y1={y}
            x2={i === 2 ? 118 : 136}
            y2={y}
            stroke="#D9D2CE"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ))}
      <motion.g
        animate={{ rotate: [0, -6, 0], y: [0, -3, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
      >
        <rect
          x="140"
          y="70"
          width="14"
          height="62"
          rx="4"
          fill="#E0B15A"
          stroke="#2c3e50"
          strokeWidth="3.5"
          transform="rotate(18 147 101)"
        />
      </motion.g>
    </motion.svg>
  )
}
