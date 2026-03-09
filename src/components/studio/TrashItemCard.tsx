import TrashTimer from '@/components/studio/TrashTimer'
import type { DeckTrashItem } from '@/lib/studio/trash'

type TrashItemCardProps = {
  item: DeckTrashItem
  restoring: boolean
  onRestore: () => void
  onExpire: () => void
}

export default function TrashItemCard({
  item,
  restoring,
  onRestore,
  onExpire,
}: TrashItemCardProps) {
  const statement = item.questions?.statement?.trim() || `Pregunta ${String(item.id)}`
  const subjectLabel = item.questions?.subject?.trim()
    ? item.questions.subject.trim()
    : item.questions?.subject_id
      ? `Asignatura ${String(item.questions.subject_id)}`
      : 'Asignatura no disponible'
  const deletedAtDate = item.deleted_at ? new Date(item.deleted_at) : null
  const deletedAtText =
    deletedAtDate && !Number.isNaN(deletedAtDate.getTime())
      ? deletedAtDate.toLocaleString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '--'

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-800">{statement}</p>
      <p className="mt-1 text-xs text-slate-500">{subjectLabel}</p>
      <p className="mt-1 text-xs text-slate-500">Eliminada: {deletedAtText}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <TrashTimer purgeAt={item.purge_at} onExpire={onExpire} />
        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {restoring ? 'Restaurando...' : 'Restaurar'}
        </button>
      </div>
    </li>
  )
}
