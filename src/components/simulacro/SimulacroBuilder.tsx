'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fetchSubjects, fetchTopics } from '@/lib/simulacro/queries'
import SimulacroTopicPicker from '@/components/simulacro/SimulacroTopicPicker'
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
    <motion.div className="mx-auto w-full max-w-3xl" {...fadeIn}>
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E8A598]/30 bg-[#E8A598]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d18d80]">
          <span className="material-symbols-outlined text-base">quiz</span>
          Crear Simulacro
        </span>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-[#2c3e50]">
          Diseña tu simulacro
        </h1>
        <p className="mt-2 text-base font-light text-[#7D8A96]">
          Elige asignaturas y temas, cuántas preguntas quieres y cómo corregirlo.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {/* Paso 1 — Asignaturas */}
        <section className="rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2EFED] text-sm font-black text-[#2c3e50]">
              1
            </span>
            <h2 className="text-lg font-bold text-[#2c3e50]">Asignaturas</h2>
          </div>

          {loadingSubjects ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`subject-skeleton-${i}`}
                  className="h-9 w-36 animate-pulse rounded-full bg-[#F2EEEB]"
                />
              ))}
            </div>
          ) : subjectsError ? (
            <p className="text-sm text-[#C4655A]">{subjectsError}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const active = selectedSubjectIds.includes(subject.id)
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                      active
                        ? 'border-[#E8A598] bg-[#E8A598] text-white shadow-sm'
                        : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#E8A598]/40 hover:text-[#2c3e50]'
                    }`}
                  >
                    {subject.name}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Paso 2 — Temas */}
        <section className="rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2EFED] text-sm font-black text-[#2c3e50]">
              2
            </span>
            <h2 className="text-lg font-bold text-[#2c3e50]">Temas</h2>
          </div>
          <p className="mb-4 ml-9 text-xs text-[#7D8A96]">
            Opcional. Si no eliges ninguno, se incluyen todos los temas de las
            asignaturas seleccionadas.
          </p>

          {selectedSubjectIds.length === 0 ? (
            <p className="ml-9 text-sm text-[#7D8A96]/70">
              Selecciona una asignatura para ver sus temas.
            </p>
          ) : loadingTopics ? (
            <div className="ml-9 flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={`topic-skeleton-${i}`}
                  className="h-16 w-full animate-pulse rounded-xl bg-[#F2EEEB]"
                />
              ))}
            </div>
          ) : (
            <div className="ml-9 flex flex-col gap-3">
              {selectedTopicChips.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#EAE4E2] bg-[#FAF7F4] px-4 py-3 text-sm text-[#7D8A96]">
                  Ahora mismo se incluirán{' '}
                  <span className="font-semibold text-[#2c3e50]">todos los temas</span> de las
                  asignaturas elegidas.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedTopicChips.slice(0, 8).map((topic) => (
                    <span
                      key={topic.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#8BA888]/40 bg-[#8BA888]/10 py-1.5 pl-3 pr-2 text-sm font-medium text-[#5f7d5c]"
                    >
                      {topic.name}
                      <button
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        aria-label={`Quitar ${topic.name}`}
                        className="text-[#5f7d5c]/70 transition-colors hover:text-[#C4655A]"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </span>
                  ))}
                  {selectedTopicChips.length > 8 ? (
                    <span className="inline-flex items-center rounded-full bg-[#F2EFED] px-3 py-1.5 text-sm font-semibold text-[#7D8A96]">
                      +{selectedTopicChips.length - 8} más
                    </span>
                  ) : null}
                </div>
              )}

              <button
                type="button"
                onClick={() => setTopicPickerOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E8A598]/40 bg-white px-4 py-3 text-sm font-bold text-[#d18d80] transition-colors hover:bg-[#fff0ec] sm:w-auto"
              >
                <span className="material-symbols-outlined text-lg">tune</span>
                {selectedTopicChips.length > 0 ? 'Editar temas' : 'Elegir temas concretos'}
              </button>
            </div>
          )}
        </section>

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
        <section className="rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2EFED] text-sm font-black text-[#2c3e50]">
              3
            </span>
            <h2 className="text-lg font-bold text-[#2c3e50]">Nº de preguntas</h2>
          </div>

          <div className="ml-9 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] p-1">
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
                className="w-16 bg-transparent text-center text-xl font-black text-[#2c3e50] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                    count === preset
                      ? 'border-[#E8A598] bg-[#E8A598]/10 text-[#d18d80]'
                      : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#E8A598]/40'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <p className="ml-9 mt-3 text-xs text-[#7D8A96]/80">
            Si hay menos preguntas disponibles que las pedidas, se usarán las que haya.
          </p>
        </section>

        {/* Paso 4 — Modo */}
        <section className="rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2EFED] text-sm font-black text-[#2c3e50]">
              4
            </span>
            <h2 className="text-lg font-bold text-[#2c3e50]">Modo de corrección</h2>
          </div>

          <div className="ml-9 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MODE_OPTIONS.map((option) => {
              const active = mode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-[#E8A598] bg-[#fff0ec] shadow-sm'
                      : 'border-[#EAE4E2] bg-white hover:border-[#E8A598]/40'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-[#E8A598] text-white' : 'bg-[#F2EFED] text-[#7D8A96]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{option.icon}</span>
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-[#2c3e50]">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#7D8A96]">
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {generationError ? (
          <p className="rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
            {generationError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-6 py-4 text-base font-bold text-white shadow-md shadow-[#E8A598]/20 transition-all hover:bg-[#d18d80] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? (
            <>
              Generando simulacro
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
      </div>
    </motion.div>
  )
}
