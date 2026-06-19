'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Subject, Topic } from '@/lib/simulacro/types'

export type TopicGroup = {
  subject: Subject | null
  subjectId: number
  items: Topic[]
}

type SimulacroTopicPickerProps = {
  open: boolean
  groups: TopicGroup[]
  selectedTopicIds: number[]
  onToggleTopic: (id: number) => void
  onSetAllForSubject: (items: Topic[], select: boolean) => void
  onClearAll: () => void
  onClose: () => void
}

export default function SimulacroTopicPicker({
  open,
  groups,
  selectedTopicIds,
  onToggleTopic,
  onSetAllForSubject,
  onClearAll,
  onClose,
}: SimulacroTopicPickerProps) {
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  // Mantener una asignatura activa válida.
  useEffect(() => {
    if (groups.length === 0) {
      setActiveSubjectId(null)
      return
    }
    setActiveSubjectId((prev) =>
      prev != null && groups.some((g) => g.subjectId === prev)
        ? prev
        : groups[0].subjectId,
    )
  }, [groups])

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const selectedSet = useMemo(() => new Set(selectedTopicIds), [selectedTopicIds])

  const queryLower = query.trim().toLowerCase()
  const searching = queryLower.length > 0

  // Resultados de búsqueda global (en todas las asignaturas).
  const searchResults = useMemo(() => {
    if (!searching) return []
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((t) => t.name.toLowerCase().includes(queryLower)),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, queryLower, searching])

  const activeGroup = useMemo(
    () => groups.find((g) => g.subjectId === activeSubjectId) ?? null,
    [groups, activeSubjectId],
  )

  const renderTopicRow = (topic: Topic) => {
    const active = selectedSet.has(topic.id)
    return (
      <button
        key={topic.id}
        type="button"
        onClick={() => onToggleTopic(topic.id)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
          active ? 'bg-[#8BA888]/10 text-[#2c3e50]' : 'text-[#4B5563] hover:bg-[#FAF7F4]'
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
            active
              ? 'border-[#8BA888] bg-[#8BA888] text-white'
              : 'border-[#D8D2CE] bg-white text-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-base">check</span>
        </span>
        <span className="font-medium">{topic.name}</span>
      </button>
    )
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D3748]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-[#F0EBE8] bg-white shadow-xl sm:h-[85vh] sm:rounded-2xl"
            initial={{ opacity: 0, y: 40, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between gap-3 border-b border-[#F0EBE8] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#2c3e50]">Selecciona los temas</h2>
                <p className="text-xs text-[#7D8A96]">
                  {selectedTopicIds.length > 0
                    ? `${selectedTopicIds.length} ${selectedTopicIds.length === 1 ? 'tema seleccionado' : 'temas seleccionados'}`
                    : 'Sin filtrar — se incluirán todos los temas'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#C4655A]"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Buscador global */}
            <div className="border-b border-[#F0EBE8] px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-[#EAE4E2] bg-[#FAF7F4] px-3">
                <span className="material-symbols-outlined text-lg text-[#9CA3AF]">search</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar un tema en todas las asignaturas..."
                  className="h-10 flex-1 bg-transparent text-sm text-[#374151] outline-none placeholder:text-[#9CA3AF]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="text-[#9CA3AF] transition-colors hover:text-[#C4655A]"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Cuerpo */}
            <div className="flex min-h-0 flex-1">
              {searching ? (
                /* Resultados de búsqueda global, agrupados por asignatura */
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  {searchResults.length === 0 ? (
                    <p className="px-2 py-10 text-center text-sm text-[#7D8A96]/70">
                      Ningún tema coincide con “{query}”.
                    </p>
                  ) : (
                    searchResults.map((g) => (
                      <div key={g.subjectId} className="mb-4">
                        <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                          {g.subject?.name ?? 'Asignatura'}
                        </p>
                        <div className="flex flex-col gap-0.5">{g.items.map(renderTopicRow)}</div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Doble panel: asignaturas | temas */
                <>
                  <aside className="w-2/5 shrink-0 overflow-y-auto border-r border-[#F0EBE8] bg-[#FAF7F4] py-2 sm:w-64">
                    {groups.map((g) => {
                      const count = g.items.filter((t) => selectedSet.has(t.id)).length
                      const active = g.subjectId === activeSubjectId
                      return (
                        <button
                          key={g.subjectId}
                          type="button"
                          onClick={() => setActiveSubjectId(g.subjectId)}
                          className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors ${
                            active
                              ? 'bg-white font-bold text-[#2c3e50] shadow-[inset_3px_0_0_0_#E8A598]'
                              : 'font-semibold text-[#7D8A96] hover:bg-white/60 hover:text-[#2c3e50]'
                          }`}
                        >
                          <span className="min-w-0 truncate">{g.subject?.name ?? 'Asignatura'}</span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              count > 0
                                ? 'bg-[#8BA888] text-white'
                                : 'bg-[#E0DAD6] text-[#7D8A96]'
                            }`}
                          >
                            {count > 0 ? count : g.items.length}
                          </span>
                        </button>
                      )
                    })}
                  </aside>

                  <div className="flex min-w-0 flex-1 flex-col">
                    {activeGroup ? (
                      <>
                        <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE8] px-4 py-2.5">
                          <p className="truncate text-sm font-bold text-[#2c3e50]">
                            {activeGroup.subject?.name ?? 'Asignatura'}
                          </p>
                          {activeGroup.items.length > 0 ? (
                            (() => {
                              const selectedInSubject = activeGroup.items.filter((t) =>
                                selectedSet.has(t.id),
                              ).length
                              const allSelected =
                                selectedInSubject === activeGroup.items.length
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetAllForSubject(activeGroup.items, !allSelected)
                                  }
                                  className="shrink-0 rounded-lg border border-[#EAE4E2] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7D8A96] transition-colors hover:border-[#8BA888]/40 hover:text-[#5f7d5c]"
                                >
                                  {allSelected ? 'Ninguno' : 'Todos'}
                                </button>
                              )
                            })()
                          ) : null}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                          {activeGroup.items.length === 0 ? (
                            <p className="px-2 py-10 text-center text-sm text-[#7D8A96]/70">
                              No hay temas registrados para esta asignatura.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {activeGroup.items.map(renderTopicRow)}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {/* Pie */}
            <div className="flex items-center justify-between gap-3 border-t border-[#F0EBE8] px-5 py-3">
              <button
                type="button"
                onClick={onClearAll}
                disabled={selectedTopicIds.length === 0}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#C4655A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Limpiar selección
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 rounded-xl bg-[#E8A598] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
              >
                Hecho
                {selectedTopicIds.length > 0 ? (
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">
                    {selectedTopicIds.length}
                  </span>
                ) : null}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
