'use client'

// Cabecera de una asignatura: dominio y reparto de las tarjetas por estado.
// Mismo reparto de cuatro cubos que la cabecera de un mazo de preguntas, para
// que las dos partes del Estudio se lean igual.

import { STATUS_TONE, type StatusKey } from '@/components/studio/deckUi'
import { MasteryBar } from '@/components/flashcards/SubjectList'
import type { FlashcardSummary } from '@/lib/studioFlashcards'

const TILES: { key: StatusKey; label: string; icon: string }[] = [
  { key: 'new', label: 'Nuevas', icon: 'fiber_new' },
  { key: 'failed', label: 'Falladas', icon: 'close' },
  { key: 'learning', label: 'En aprendizaje', icon: 'trending_up' },
  { key: 'mastered', label: 'Dominadas', icon: 'verified' },
]

export default function SubjectSummary({
  summary,
  total,
}: {
  summary: FlashcardSummary
  total: number
}) {
  const mastery = total > 0 ? Math.round((summary.mastered / total) * 100) : 0

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-[#E4DCD8] bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7D8A96]/70">
          Dominio
        </span>
        <span className="flex-1">
          <MasteryBar percent={mastery} total={total} />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.map((tile) => {
          const tone = STATUS_TONE[tile.key]
          const value = summary[tile.key]
          return (
            <div
              key={tile.key}
              className="flex items-center gap-2 rounded-2xl border px-3 py-2"
              style={{ background: tone.bg, borderColor: tone.border }}
            >
              <span className="material-symbols-outlined text-lg" style={{ color: tone.fg }}>
                {tile.icon}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-base font-black tabular-nums" style={{ color: tone.fg }}>
                  {value}
                </span>
                <span className="truncate text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]/80">
                  {tile.label}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
