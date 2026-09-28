'use client'

// Índice lateral: todas las asignaturas siempre a mano, desplegables por temas.
//
// Sin esto, cambiar de asignatura obliga a volver a la raíz y buscarla otra vez.
// Solo aparece dentro de una asignatura o de un tema: en la raíz sería repetir
// la lista principal que ya se está viendo.
//
// Los temas de una asignatura salen de sus tarjetas, que se cargan bajo demanda
// al desplegarla. Por eso desplegar una asignatura que aún no se ha visitado
// tarda un momento la primera vez.

import { useMemo } from 'react'
import { STATUS_TONE, domainColorClass } from '@/components/studio/deckUi'
import { groupTopics } from '@/components/flashcards/TopicList'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  subjectVisual,
  type SubjectCategory,
} from '@/lib/subjectVisuals'
import type { Flashcard, FlashcardDeck } from '@/lib/studioFlashcards'

export default function SubjectIndex({
  decks,
  cardsBySubject,
  activeSubjectId,
  activeTopicKey,
  expandedId,
  onToggleExpand,
  onOpenSubject,
  onOpenTopic,
}: {
  decks: FlashcardDeck[]
  cardsBySubject: Record<string, Flashcard[]>
  activeSubjectId: string | null
  /** Clave del tema activo, `null` si se está en el nivel de asignatura. */
  activeTopicKey: string | null
  expandedId: string | null
  onToggleExpand: (deckId: string) => void
  onOpenSubject: (deck: FlashcardDeck) => void
  onOpenTopic: (deck: FlashcardDeck, topicKey: string | null) => void
}) {
  const secciones = useMemo(() => {
    const filas = decks.map((deck) => ({ deck, visual: subjectVisual(deck.name, deck.color, deck.icon) }))
    return CATEGORY_ORDER.map((category) => ({
      category,
      filas: filas
        .filter((f) => f.visual.category === category)
        .sort((a, b) => a.deck.name.localeCompare(b.deck.name, 'es')),
    })).filter((s) => s.filas.length > 0)
  }, [decks])

  return (
    <nav
      aria-label="Índice de asignaturas"
      className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border-2 border-[#E4DCD8] bg-white/80 p-2 backdrop-blur"
    >
      {secciones.map((seccion) => (
        <div key={seccion.category} className="mb-2 last:mb-0">
          <p className="px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#B0B8BF]">
            {CATEGORY_LABEL[seccion.category as SubjectCategory]}
          </p>

          <ul>
            {seccion.filas.map(({ deck, visual }) => {
              const activa = deck.id === activeSubjectId
              const desplegada = deck.id === expandedId
              const cards = cardsBySubject[deck.id]
              const temas = cards ? groupTopics(cards) : null
              const dominio =
                deck.totalCards > 0
                  ? Math.round((deck.summary.mastered / deck.totalCards) * 100)
                  : 0

              return (
                <li key={deck.id}>
                  <div
                    className={`flex items-center gap-1 rounded-xl pr-1 transition-colors ${
                      activa ? 'bg-[#F4EFEC]' : 'hover:bg-[#FAF7F4]'
                    }`}
                    style={activa ? { boxShadow: `inset 3px 0 0 0 ${visual.color.bg}` } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenSubject(deck)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[8px] font-black text-white"
                        style={{ background: visual.color.bg }}
                      >
                        {visual.sigla}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`truncate text-xs font-black ${
                            activa ? 'text-[#2C3E50]' : 'text-[#5C6B78]'
                          }`}
                        >
                          {deck.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span className="h-[2px] w-10 overflow-hidden rounded-full bg-[#EFEAE7]">
                            <span
                              className={`block h-full ${domainColorClass(dominio)}`}
                              style={{ width: `${dominio}%` }}
                            />
                          </span>
                          <span className="text-[9px] font-bold tabular-nums text-[#B0B8BF]">
                            {deck.totalCards}
                          </span>
                        </span>
                      </span>
                      {deck.dueCards > 0 ? (
                        <span
                          className="shrink-0 rounded-md px-1.5 text-[10px] font-black tabular-nums"
                          style={{ color: STATUS_TONE.failed.fg, background: STATUS_TONE.failed.bg }}
                        >
                          {deck.dueCards}
                        </span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleExpand(deck.id)}
                      aria-label={`${desplegada ? 'Plegar' : 'Desplegar'} los temas de ${deck.name}`}
                      aria-expanded={desplegada}
                      disabled={deck.totalCards === 0}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[#B0B8BF] transition-colors hover:bg-[#EFEAE7] hover:text-[#2C3E50] disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <span
                        className={`material-symbols-outlined text-base transition-transform ${
                          desplegada ? 'rotate-90' : ''
                        }`}
                      >
                        chevron_right
                      </span>
                    </button>
                  </div>

                  {desplegada ? (
                    <ul className="mb-1 ml-4 border-l-2 border-[#EFEAE7] pl-2">
                      {temas === null ? (
                        <li className="px-2 py-1 text-[10px] font-bold text-[#C9CFD5]">Cargando…</li>
                      ) : temas.length === 0 ? (
                        <li className="px-2 py-1 text-[10px] font-bold text-[#C9CFD5]">Sin temas</li>
                      ) : (
                        temas.map((t) => {
                          const activoTema = activa && activeTopicKey === (t.key ?? '__none__')
                          return (
                            <li key={t.key ?? '__none__'}>
                              <button
                                type="button"
                                onClick={() => onOpenTopic(deck, t.key)}
                                className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors ${
                                  activoTema ? 'bg-[#F4EFEC]' : 'hover:bg-[#FAF7F4]'
                                }`}
                              >
                                <span
                                  className={`min-w-0 flex-1 truncate text-[11px] font-bold ${
                                    activoTema ? 'text-[#2C3E50]' : 'text-[#7D8A96]'
                                  } ${t.key === null ? 'italic' : ''}`}
                                >
                                  {t.label}
                                </span>
                                <span className="shrink-0 text-[9px] font-bold tabular-nums text-[#B0B8BF]">
                                  {t.total}
                                </span>
                                {t.dueCards > 0 ? (
                                  <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ background: STATUS_TONE.failed.fg }}
                                    title={`${t.dueCards} pendientes`}
                                  />
                                ) : null}
                              </button>
                            </li>
                          )
                        })
                      )}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
