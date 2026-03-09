type DeckItemCardOption = {
  key: string
  letter: string
  text: string
  isCorrect: boolean
}

type DeckItemCardProps = {
  index: number
  statement: string
  options: DeckItemCardOption[]
  onDelete: () => void
  deleting: boolean
}

function TrashIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export default function DeckItemCard({
  index,
  statement,
  options,
  onDelete,
  deleting,
}: DeckItemCardProps) {
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pregunta {index + 1}
          </p>
          <p className="mt-2 text-sm text-slate-800">{statement}</p>
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Eliminar pregunta del mazo"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <TrashIcon />
        </button>
      </div>

      {options.length > 0 ? (
        <div className="mt-3 space-y-2">
          {options.map((option) => (
            <div
              key={option.key}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="text-xs font-semibold text-slate-500">{option.letter}</span>
              <span className="text-sm text-slate-700">{option.text}</span>
              {option.isCorrect ? (
                <span className="ml-auto text-xs font-semibold text-emerald-700">
                  Correcta
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  )
}
