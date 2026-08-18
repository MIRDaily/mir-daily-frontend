'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { fetchSubjects, fetchTopics } from '@/lib/simulacro/queries'
import SimulacroTopicPicker from '@/components/simulacro/SimulacroTopicPicker'
import { GhostButton, Hero, StepBadge, StickerCard } from '@/components/ui/sticker'
import { allocateByWeight } from '@/lib/simulacro/mirWeights'
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

// El orden importa: primero la que imita al examen real, que es la opción por
// defecto y la que conviene la mayoría de las veces.
const MODE_OPTIONS: ReadonlyArray<{
  value: SimulacroMode
  title: string
  description: string
  icon: string
}> = [
  {
    value: 'deferred',
    title: 'Corrección al final',
    description: 'Sin pistas durante el test; repasas todo al terminar.',
    icon: 'flag',
  },
  {
    value: 'immediate',
    title: 'Corrección inmediata',
    description: 'Ves si aciertas y la explicación justo al responder.',
    icon: 'bolt',
  },
] as const

/** Atajos de tamaño; 210 son las preguntas de un MIR real. */
const COUNT_PRESETS = [10, 25, 50, 100, 210] as const
const MAX_COUNT = 210

export default function SimulacroBuilder({
  onSubmit,
  generating,
  generationError,
}: SimulacroBuilderProps) {
  const reduceMotion = useReducedMotion()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)

  // Temas cacheados por asignatura. Antes se pedían TODOS cada vez que se
  // tocaba una asignatura y, mientras llegaban, la sección se sustituía por
  // esqueletos: de ahí el parpadeo en cada clic. Ahora solo se piden los que
  // faltan y lo ya cargado no se vuelve a pedir ni se desmonta.
  const [topicsBySubject, setTopicsBySubject] = useState<Record<number, Topic[]>>({})

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([])
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])
  const [count, setCount] = useState(10)
  // Por defecto, corrección al final: es como se hace un simulacro de verdad.
  const [mode, setMode] = useState<SimulacroMode>('deferred')
  // Reparto ponderado por peso en el MIR (botón "MIR").
  const [weighted, setWeighted] = useState(false)

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

  // Pide solo los temas de las asignaturas que aún no se han cargado nunca.
  useEffect(() => {
    const missing = selectedSubjectIds.filter((id) => !(id in topicsBySubject))
    if (missing.length === 0) return

    let active = true
    fetchTopics(missing)
      .then((data) => {
        if (!active) return
        setTopicsBySubject((prev) => {
          const next = { ...prev }
          // Se registran todas las pedidas, incluso las que no traen temas:
          // así una asignatura sin temas no se vuelve a consultar en bucle.
          for (const id of missing) next[id] = []
          for (const topic of data) next[topic.subject_id] = [...(next[topic.subject_id] ?? []), topic]
          return next
        })
      })
      .catch(() => {
        if (!active) return
        setTopicsBySubject((prev) => {
          const next = { ...prev }
          for (const id of missing) next[id] = []
          return next
        })
      })
    return () => {
      active = false
    }
  }, [selectedSubjectIds, topicsBySubject])

  /** Temas de las asignaturas seleccionadas, ya cacheados. */
  const topics = useMemo(
    () => selectedSubjectIds.flatMap((id) => topicsBySubject[id] ?? []),
    [selectedSubjectIds, topicsBySubject],
  )

  // Al quitar una asignatura sus temas dejan de contar. Se filtra al leer en
  // vez de sincronizar el estado con un efecto: así no hay un render con la
  // selección inconsistente ni una cascada de actualizaciones.
  const effectiveTopicIds = useMemo(() => {
    const valid = new Set(topics.map((t) => t.id))
    return selectedTopicIds.filter((id) => valid.has(id))
  }, [topics, selectedTopicIds])

  // Solo hay "cargando" si no se puede enseñar nada todavía; si ya hay temas
  // de otra asignatura, los nuevos se suman sin desmontar lo que se ve.
  const loadingTopics =
    selectedSubjectIds.some((id) => !(id in topicsBySubject)) && topics.length === 0

  const toggleSubject = (id: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const selectAllSubjects = () => {
    setSelectedSubjectIds(subjects.map((s) => s.id))
    setWeighted(false)
  }

  const clearSubjects = () => {
    setSelectedSubjectIds([])
    setWeighted(false)
  }

  /**
   * Simulacro tipo MIR: todas las asignaturas, pero repartiendo las preguntas
   * según su peso en el examen real en vez de a partes iguales. Los temas se
   * limpian porque aquí manda el reparto por asignatura.
   */
  const useMirDistribution = () => {
    setSelectedSubjectIds(subjects.map((s) => s.id))
    setSelectedTopicIds([])
    setWeighted(true)
  }

  /** Un puñado de asignaturas al azar, para salir del bloqueo de elegir. */
  const pickRandomSubjects = () => {
    if (subjects.length === 0) return
    const shuffled = [...subjects]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    // Entre 2 y 7, pero nunca más de las que hay.
    const howMany = Math.min(subjects.length, 2 + Math.floor(Math.random() * 6))
    setSelectedSubjectIds(shuffled.slice(0, howMany).map((s) => s.id))
    setWeighted(false)
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
    return effectiveTopicIds
      .map((id) => byId.get(id))
      .filter((t): t is Topic => Boolean(t))
  }, [topics, effectiveTopicIds])

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
    const chosen = subjects.filter((s) => selectedSubjectIds.includes(s.id))
    onSubmit({
      subjectIds: selectedSubjectIds,
      topicIds: weighted ? [] : effectiveTopicIds,
      count,
      mode,
      weights: weighted ? allocateByWeight(count, chosen) : undefined,
    })
  }

  return (
    <motion.div className="mx-auto w-full max-w-6xl" {...fadeIn}>
      <Hero
        title="Diseña tu simulacro"
        subtitle="Elige asignaturas y temas, cuántas preguntas quieres y cómo corregirlo."
        aside={<ExamPadArt />}
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
        {/* Paso 1 — Asignaturas */}
        <StickerCard as="section" className="p-6" depth={4}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <StepBadge n={1} active={selectedSubjectIds.length > 0} />
            <h2 className="text-lg font-black text-[#2c3e50]">Asignaturas</h2>
            {selectedSubjectIds.length > 0 ? (
              <span className="rounded-full bg-[#E8A598]/15 px-2.5 py-1 text-[11px] font-black text-[#d18d80]">
                {selectedSubjectIds.length}
              </span>
            ) : null}

            {/* Atajos de selección */}
            <div className="ml-auto flex flex-wrap gap-2">
              <QuickPick
                icon="done_all"
                onClick={selectAllSubjects}
                disabled={subjects.length === 0 || selectedSubjectIds.length === subjects.length}
              >
                Todas
              </QuickPick>
              <QuickPick icon="casino" onClick={pickRandomSubjects} disabled={subjects.length === 0}>
                Aleatorias
              </QuickPick>
              <QuickPick
                icon="balance"
                onClick={useMirDistribution}
                disabled={subjects.length === 0}
                active={weighted}
              >
                MIR
              </QuickPick>
              {selectedSubjectIds.length > 0 ? (
                <QuickPick icon="close" onClick={clearSubjects}>
                  Ninguna
                </QuickPick>
              ) : null}
            </div>
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
            {effectiveTopicIds.length > 0 ? (
              <span className="ml-auto rounded-full bg-[#8BA888]/15 px-2.5 py-1 text-[11px] font-black text-[#5f7d5c]">
                {effectiveTopicIds.length}
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

          <div className="ml-11">
            <div className="flex flex-wrap items-center gap-4">
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
                  max={MAX_COUNT}
                  value={count}
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    setCount(
                      Number.isFinite(value) ? Math.min(MAX_COUNT, Math.max(1, Math.floor(value))) : 1,
                    )
                  }}
                  className="w-20 bg-transparent text-center text-2xl font-black text-[#2c3e50] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setCount((c) => Math.min(MAX_COUNT, c + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#7D8A96] transition-colors hover:bg-white hover:text-[#8BA888]"
                  aria-label="Sumar una pregunta"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {COUNT_PRESETS.map((preset) => (
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
                    {preset === MAX_COUNT ? (
                      <span className="ml-1 text-[10px] font-bold opacity-70">MIR</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <CountSlider value={count} onChange={setCount} />

            <p className="mt-3 text-xs text-[#7D8A96]/80">
              Si hay menos preguntas disponibles que las pedidas, se usarán las que haya.
            </p>
          </div>
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
                    {weighted ? 'Todos' : effectiveTopicIds.length > 0 ? effectiveTopicIds.length : 'Todos'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[#7D8A96]">Reparto</dt>
                  <dd className="text-right font-black text-[#2c3e50]">
                    {weighted ? (
                      <span className="text-[#5f7d5c]">Peso MIR</span>
                    ) : (
                      'Equilibrado'
                    )}
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

/** Atajo pequeño de la cabecera de un paso ("Todas", "Aleatorias"…). */
function QuickPick({
  children,
  onClick,
  icon,
  disabled,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  icon: string
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${
        active
          ? 'border-[#2c3e50] bg-[#8BA888] text-white'
          : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:-translate-y-0.5 hover:border-[#2c3e50] hover:text-[#2c3e50] disabled:hover:border-[#EAE4E2] disabled:hover:text-[#7D8A96]'
      }`}
      style={active ? { boxShadow: '3px 3px 0 0 #2c3e50' } : undefined}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {children}
    </button>
  )
}

/**
 * Deslizador del número de preguntas.
 *
 * La barra que se ve NO es la del `input`: es una capa propia movida por un
 * muelle, de modo que al hacer clic en cualquier punto el relleno viaja hasta
 * ahí con rebote en vez de aparecer de golpe. El `input` nativo se queda
 * encima, invisible, solo para recoger el gesto: así no se pierden el teclado
 * ni la accesibilidad, que es lo que se suele romper al hacer esto a mano.
 */
function CountSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const progress = useSpring(value, { stiffness: 210, damping: 18, mass: 0.85 })

  useEffect(() => {
    progress.set(value)
  }, [value, progress])

  const width = useTransform(progress, (v) => `${((v - 1) / (MAX_COUNT - 1)) * 100}%`)

  return (
    <div className="relative mt-6 h-6 select-none">
      {/* Pista */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full border-2 border-[#2c3e50] bg-[#F2EFED]">
        <motion.div className="h-full rounded-full bg-[#E8A598]" style={{ width }} />
      </div>

      {/* Mando: viaja con el mismo muelle que el relleno */}
      <motion.div
        className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2c3e50] bg-white"
        style={{ left: width, boxShadow: '2px 2px 0 0 #2c3e50' }}
      />

      <input
        type="range"
        min={1}
        max={MAX_COUNT}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Número de preguntas"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
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
