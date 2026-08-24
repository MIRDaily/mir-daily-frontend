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
      ? 'bg-[#EAF2E8] text-[#3F5A3D]'
      : tone === 'error'
        ? 'bg-[#FFF1EE] text-[#8A3F35]'
        : 'bg-[#FDF2EF] text-[#8A4B41]'

  return (
    <div
      className={`fixed bottom-5 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 ${
        isVisible ? '' : 'pointer-events-none'
      }`}
    >
      <div
        className={`transform-gpu rounded-2xl border-2 border-[#2c3e50] px-4 py-3 transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.2,1.25)] ${
          isVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-6 scale-95 opacity-0'
        } ${toneClass}`}
        style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{message}</p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              className="text-sm font-black text-[#2C3E50] underline decoration-2 underline-offset-2 transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
