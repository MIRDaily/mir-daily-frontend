import DeckItemCard from '@/components/studio/DeckItemCard'
import { INK } from '@/components/studio/deckUi'

type DeckItemListOption = {
  key: string
  letter: string
  text: string
  isCorrect: boolean
}

type DeckItemListEntry = {
  id: string
  index: number
  statement: string
  options: DeckItemListOption[]
  deleting: boolean
  subject?: string | null
  year?: number | string | null
}

type DeckItemsListProps = {
  entries: DeckItemListEntry[]
  onDelete: (entryId: string) => void
  searchActive?: boolean
  highlightQuery?: string
  showCorrectAnswers?: boolean
  showMeta?: boolean
  /** Estado de despliegue por defecto para las tarjetas sin override propio. */
  defaultExpanded?: boolean
  /** Overrides individuales, clave = id de la tarjeta, puestos al hacer click en una. */
  expandOverrides?: Record<string, boolean>
  onToggleExpand?: (entryId: string) => void
  /** Se incrementa solo al ACTIVAR "Respuestas": dispara la animación de entrada. */
  answerRevealKey?: number
}

export default function DeckItemsList({
  entries,
  onDelete,
  searchActive = false,
  highlightQuery = '',
  showCorrectAnswers = false,
  showMeta = true,
  defaultExpanded = false,
  expandOverrides = {},
  onToggleExpand,
  answerRevealKey = 0,
}: DeckItemsListProps) {
  if (entries.length === 0) {
    if (searchActive) {
      return (
        <div className="flex items-center gap-2 text-sm font-semibold text-[#7D8A96]">
          <span className="material-symbols-outlined text-base">search_off</span>
          No hay preguntas que coincidan con tu búsqueda.
        </div>
      )
    }

    return (
      <div
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-[#FAF7F4] px-6 py-9 text-center"
        style={{ borderColor: INK }}
      >
        <span className="material-symbols-outlined text-3xl text-[#B9B2AD]">quiz</span>
        <p className="text-sm font-black text-[#2C3E50]">Este mazo todavía no tiene preguntas</p>
        <p className="max-w-sm text-sm leading-relaxed text-[#7D8A96]">
          Se añaden desde donde las estudias: en el Daily o en un Simulacro, pulsa el icono{' '}
          <span
            aria-hidden
            className="material-symbols-outlined relative top-[3px] mx-0.5 inline-block text-base text-[#C4655A]"
          >
            bookmark
          </span>{' '}
          junto a una pregunta y elige este mazo.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <DeckItemCard
          key={entry.id}
          index={entry.index}
          statement={entry.statement}
          options={entry.options}
          deleting={entry.deleting}
          highlightQuery={highlightQuery}
          showCorrectAnswer={showCorrectAnswers}
          showMeta={showMeta}
          subject={entry.subject}
          year={entry.year}
          expanded={expandOverrides[entry.id] ?? defaultExpanded}
          onToggleExpand={onToggleExpand ? () => onToggleExpand(entry.id) : undefined}
          revealKey={answerRevealKey}
          onDelete={() => {
            onDelete(entry.id)
          }}
        />
      ))}
    </ul>
  )
}
