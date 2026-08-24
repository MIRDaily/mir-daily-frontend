import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { HighlightedText, INK, STATUS_TONE } from '@/components/studio/deckUi'

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
  highlightQuery?: string
  showCorrectAnswer?: boolean
  showMeta?: boolean
  subject?: string | null
  year?: number | string | null
  expanded?: boolean
  onToggleExpand?: () => void
  /** Se incrementa solo al ACTIVAR "Respuestas" — dispara el "pop" de entrada
   * de la opción correcta. En el montaje inicial (revealKey en 0) o al
   * desactivar, no anima nada: la respuesta ya viene marcada o se oculta. */
  revealKey?: number
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

function MetaPill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#EAE4E2] bg-[#FAF7F4] px-2 py-0.5 text-[10px] font-bold text-[#7D8A96]">
      <span className="material-symbols-outlined text-xs">{icon}</span>
      {children}
    </span>
  )
}

/**
 * Una fila de opción. El "pop" de entrada de la correcta usa `scale` (un
 * transform, no reflow) así que nunca cambia el tamaño de la tarjeta — solo
 * se dispara al pasar de "no marcada" a "marcada" por una revelación real
 * (`revealKey` mayor que 0 en ese instante), nunca en el montaje inicial.
 */
function DeckOptionRow({
  option,
  highlightCorrect,
  highlightQuery,
  revealKey,
}: {
  option: DeckItemCardOption
  highlightCorrect: boolean
  highlightQuery: string
  revealKey: number
}) {
  const controls = useAnimationControls()
  const wasCorrectRef = useRef(highlightCorrect)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current && highlightCorrect && !wasCorrectRef.current && revealKey > 0) {
      void controls.start({
        scale: [0.96, 1.025, 1],
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      })
    }
    wasCorrectRef.current = highlightCorrect
    mountedRef.current = true
  }, [highlightCorrect, revealKey, controls])

  const justRevealed = highlightCorrect && revealKey > 0

  return (
    <motion.div
      animate={controls}
      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors duration-200 ${
        highlightCorrect ? '' : 'border-[#EAE4E2] bg-[#FAF7F4]'
      }`}
      style={{
        borderColor: highlightCorrect ? STATUS_TONE.mastered.border : undefined,
        backgroundColor: highlightCorrect ? STATUS_TONE.mastered.bg : undefined,
      }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-[#7D8A96] transition-colors duration-200"
        style={{ color: highlightCorrect ? STATUS_TONE.mastered.fg : undefined }}
      >
        {option.letter}
      </span>
      <span className="text-sm font-medium text-[#2C3E50]">
        <HighlightedText text={option.text} query={highlightQuery} />
      </span>
      {/* Reservamos el hueco de "Correcta" siempre, aunque esté invisible: si el
          span solo se montaba al activar la preferencia, el texto de la opción
          podía verse forzado a envolver y la tarjeta "saltaba" de tamaño. Con
          `invisible` el layout no se mueve, solo cambia lo que se ve. */}
      <span
        aria-hidden={!highlightCorrect}
        className={`ml-auto flex shrink-0 items-center gap-1 text-xs font-black transition-opacity duration-200 ${
          highlightCorrect ? 'opacity-100' : 'invisible opacity-0'
        }`}
        style={{ color: STATUS_TONE.mastered.fg }}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          {justRevealed ? (
            <motion.span
              key={`glow-${revealKey}`}
              aria-hidden
              className="pointer-events-none absolute inset-[-6px] rounded-full"
              style={{
                background: `radial-gradient(circle, ${STATUS_TONE.mastered.fg}55 0%, transparent 70%)`,
              }}
              initial={{ opacity: 0.9, scale: 0.4 }}
              animate={{ opacity: 0, scale: 2.1 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ) : null}
          <span className="material-symbols-outlined relative text-sm">check_circle</span>
        </span>
        Correcta
      </span>
    </motion.div>
  )
}

export default function DeckItemCard({
  index,
  statement,
  options,
  onDelete,
  deleting,
  highlightQuery = '',
  showCorrectAnswer = false,
  showMeta = true,
  subject,
  year,
  expanded = false,
  onToggleExpand,
  revealKey = 0,
}: DeckItemCardProps) {
  return (
    <li
      className="rounded-2xl border-2 bg-white p-4 transition-shadow"
      style={{ borderColor: INK, boxShadow: '3px 3px 0 0 #2c3e50' }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onToggleExpand}
          disabled={!onToggleExpand}
          aria-expanded={expanded}
          className="min-w-0 flex-1 rounded-xl -m-1 p-1 text-left transition-colors hover:bg-[#FAF7F4] disabled:cursor-default disabled:hover:bg-transparent"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[#C99A8D]">
              {onToggleExpand ? (
                <span
                  className="material-symbols-outlined text-sm text-[#B9B2AD] transition-transform"
                  style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  chevron_right
                </span>
              ) : null}
              Pregunta {index + 1}
            </p>
            {/* Se monta siempre que la pregunta tenga asignatura/año — el toggle
                "Etiquetas" solo cambia `invisible`, nunca si el bloque existe.
                Así el ancho/wrap de esta fila no cambia al alternarlo y la
                tarjeta no cambia de tamaño ("reshape"). */}
            {subject || year ? (
              <div
                aria-hidden={!showMeta}
                className={`flex flex-wrap gap-1.5 ${showMeta ? '' : 'invisible'}`}
              >
                {subject ? <MetaPill icon="sell">{subject}</MetaPill> : null}
                {year ? <MetaPill icon="calendar_month">{year}</MetaPill> : null}
              </div>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-[#2C3E50]">
            <HighlightedText text={statement} query={highlightQuery} />
          </p>
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Eliminar pregunta del mazo"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-transparent text-[#C4655A] transition hover:border-[#E6B0A6] hover:bg-[#FFF1EE] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <TrashIcon />
        </button>
      </div>

      {expanded && options.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {options.map((option) => (
            <DeckOptionRow
              key={option.key}
              option={option}
              highlightCorrect={showCorrectAnswer && option.isCorrect}
              highlightQuery={highlightQuery}
              revealKey={revealKey}
            />
          ))}
        </div>
      ) : null}
    </li>
  )
}
