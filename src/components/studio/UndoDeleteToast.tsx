type UndoDeleteToastProps = {
  message: string
  isVisible: boolean
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
  tone?: 'neutral' | 'success' | 'error'
}

export default function UndoDeleteToast({
  message,
  isVisible,
  actionLabel,
  onAction,
  actionDisabled = false,
  tone = 'neutral',
}: UndoDeleteToastProps) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-[#F2C8BF] bg-[#FDF2EF] text-[#8A4B41]'

  return (
    <div
      className={`fixed bottom-5 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 ${
        isVisible ? '' : 'pointer-events-none'
      }`}
    >
      <div
        className={`transform-gpu rounded-xl border px-4 py-3 shadow-lg transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.2,1.25)] ${
          isVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-6 scale-95 opacity-0'
        } ${toneClass}`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">{message}</p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              className="text-sm font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
