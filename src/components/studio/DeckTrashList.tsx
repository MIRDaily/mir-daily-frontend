import TrashItemCard from '@/components/studio/TrashItemCard'
import { INK } from '@/components/studio/deckUi'
import type { DeckTrashItem } from '@/lib/studio/trash'

type DeckTrashListProps = {
  items: DeckTrashItem[]
  restoringItemIds: Set<string>
  onRestore: (itemId: number) => void
  onExpire: (itemId: string) => void
}

export default function DeckTrashList({
  items,
  restoringItemIds,
  onRestore,
  onExpire,
}: DeckTrashListProps) {
  if (items.length === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-2xl border-2 border-dashed bg-[#FAF7F4] p-5 text-sm font-semibold text-[#7D8A96]"
        style={{ borderColor: INK }}
      >
        <span className="material-symbols-outlined text-base">delete</span>
        No hay preguntas en la papelera.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const itemKey = String(item.id)
        const itemId = Number(item.id)

        return (
          <TrashItemCard
            key={itemKey}
            item={item}
            restoring={restoringItemIds.has(itemKey)}
            onRestore={() => {
              if (!Number.isFinite(itemId) || itemId <= 0) return
              onRestore(Math.trunc(itemId))
            }}
            onExpire={() => {
              onExpire(itemKey)
            }}
          />
        )
      })}
    </ul>
  )
}
