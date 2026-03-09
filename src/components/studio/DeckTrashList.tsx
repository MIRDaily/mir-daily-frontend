import TrashItemCard from '@/components/studio/TrashItemCard'
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
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
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
