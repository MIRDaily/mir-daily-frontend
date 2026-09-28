'use client'

// Temas de una asignatura, con la misma anatomía de fila que la lista de
// asignaturas. Es la vista por defecto dentro de una asignatura; el mapa radial
// queda detrás del conmutador.

import { motion } from 'framer-motion'
import { STATUS_TONE } from '@/components/studio/deckUi'
import { Count, MasteryBar } from '@/components/flashcards/SubjectList'
import type { Flashcard, FlashcardSummary } from '@/lib/studioFlashcards'
import type { SubjectColor } from '@/lib/flashcardTheme'

export type TopicRow = {
  /** Clave de navegación; `null` para el grupo de tarjetas sin tema. */
  key: string | null
  label: string
  total: number
  dueCards: number
  summary: FlashcardSummary
}

/**
 * Agrupa las tarjetas por tema y cuenta sus cubos.
 *
 * Se deriva de las tarjetas ya cargadas, que desde la fase 1 traen `status` e
 * `isDue` calculados en el servidor: así no hace falta una segunda petición ni
 * volver a decidir aquí qué está vencido (el reloj del cliente puede ir mal).
 */
export function groupTopics(cards: Flashcard[]): TopicRow[] {
  const byTopic = new Map<string, TopicRow>()

  for (const card of cards) {
    const label = card.topic?.trim() || null
    const mapKey = label ?? ''
    let row = byTopic.get(mapKey)
    if (!row) {
      row = {
        key: label,
        label: label ?? 'Sin tema',
        total: 0,
        dueCards: 0,
        summary: { new: 0, failed: 0, learning: 0, mastered: 0 },
      }
      byTopic.set(mapKey, row)
    }
    row.total += 1
    if (card.isDue) row.dueCards += 1
    row.summary[card.status] += 1
  }

  // Las tarjetas sin tema, al final; el resto alfabético con locale para que
  // las tildes no se cuelen por delante de la A.
  return [...byTopic.values()].sort((a, b) => {
    if (a.key === null) return 1
    if (b.key === null) return -1
    return a.label.localeCompare(b.label, 'es')
  })
}

export default function TopicList({
  topics,
  color,
  onOpen,
}: {
  topics: TopicRow[]
  color: SubjectColor
  onOpen: (row: TopicRow) => void
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {topics.map((row, i) => {
        const mastery = row.total > 0 ? Math.round((row.summary.mastered / row.total) * 100) : 0
        const idle = row.dueCards === 0

        return (
          <motion.li
            key={row.key ?? '__sin_tema__'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.2), duration: 0.18 }}
          >
            <div
              className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-3 py-2.5 transition-colors ${
                idle ? 'border-[#EFEAE7]' : 'border-[#E4DCD8] hover:border-[#2c3e50]'
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ background: color.bg, opacity: idle ? 0.4 : 1 }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span
                    className={`truncate text-sm font-black ${
                      idle ? 'text-[#9CA3AF]' : 'text-[#2C3E50]'
                    } ${row.key === null ? 'italic' : ''}`}
                  >
                    {row.label}
                  </span>
                  <MasteryBar percent={mastery} total={row.total} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex shrink-0 items-center gap-1"
                aria-label={`${row.summary.new} nuevas, ${row.dueCards - row.summary.new} pendientes`}
              >
                <Count value={row.summary.new} tone={STATUS_TONE.new} />
                <Count value={Math.max(0, row.dueCards - row.summary.new)} tone={STATUS_TONE.failed} />
              </button>

              <span className="material-symbols-outlined shrink-0 text-lg text-[#C9CFD5]">
                chevron_right
              </span>
            </div>
          </motion.li>
        )
      })}
    </ul>
  )
}
