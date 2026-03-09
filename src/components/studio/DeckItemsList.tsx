import DeckItemCard from '@/components/studio/DeckItemCard'

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
}

type DeckItemsListProps = {
  entries: DeckItemListEntry[]
  onDelete: (entryId: string) => void
}

export default function DeckItemsList({ entries, onDelete }: DeckItemsListProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">Este mazo no tiene items.</p>
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
          onDelete={() => {
            onDelete(entry.id)
          }}
        />
      ))}
    </ul>
  )
}
