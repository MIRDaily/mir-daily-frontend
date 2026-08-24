import TrashTimer from '@/components/studio/TrashTimer'
import { INK } from '@/components/studio/deckUi'
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
    <li
      className="rounded-2xl border-2 bg-white p-4 opacity-90 transition-opacity hover:opacity-100"
      style={{ borderColor: INK, borderStyle: 'dashed' }}
    >
      <p className="text-sm font-semibold leading-snug text-[#2C3E50]">{statement}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#C99A8D]">{subjectLabel}</p>
      <p className="mt-1 text-xs text-[#7D8A96]">Eliminada: {deletedAtText}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <TrashTimer purgeAt={item.purge_at} onExpire={onExpire} />
        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          className="inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ borderColor: INK, backgroundColor: '#5C7A59', boxShadow: '2px 2px 0 0 #2c3e50' }}
        >
          <span className="material-symbols-outlined text-sm">restart_alt</span>
          {/* "Restaurando..." es más ancho que "Restaurar": reservamos su
              hueco con un span invisible y superponemos el texto real, igual
              que en el botón "Contraer/Desplegar" del propio mazo — si no,
              el botón cambiaba de ancho justo al pulsarlo. */}
          <span className="relative inline-block text-left">
            <span className="invisible">Restaurando...</span>
            <span className="absolute inset-0">{restoring ? 'Restaurando...' : 'Restaurar'}</span>
          </span>
        </button>
      </div>
    </li>
  )
}
