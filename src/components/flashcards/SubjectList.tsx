'use client'

// Navegador de asignaturas de flashcards, al estilo del de mazos de Anki.
//
// Sustituye al mapa radial en el nivel raíz: el radial reparte los nodos en un
// círculo de radio fijo, así que a partir de ~15 asignaturas se solapan y el
// resto se sale del lienzo. Una lista de filas de altura constante escala hasta
// donde haga falta y, sobre todo, se lee de un vistazo: categoría, dominio y
// las dos columnas de contadores siempre en el mismo sitio.

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import DropdownMenu from '@/components/studio/DropdownMenu'
import { HighlightedText, STATUS_TONE, domainColorClass } from '@/components/studio/deckUi'
import { SectionLabel } from '@/components/flashcards/ui'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  subjectVisual,
  type SubjectCategory,
  type SubjectVisual,
} from '@/lib/subjectVisuals'
import type { FlashcardDeck } from '@/lib/studioFlashcards'

export type SubjectSort = 'due' | 'name' | 'mastery' | 'mir'

export const SORT_LABEL: Record<SubjectSort, string> = {
  due: 'Pendientes',
  name: 'Alfabético',
  mastery: 'Dominio',
  mir: 'Peso MIR',
}

type Row = {
  deck: FlashcardDeck
  visual: SubjectVisual
  mastery: number
}

/** Dominio de la asignatura: qué parte de sus tarjetas están dominadas. */
function masteryOf(deck: FlashcardDeck): number {
  if (deck.totalCards <= 0) return 0
  return Math.round((deck.summary.mastered / deck.totalCards) * 100)
}

export function groupSubjects(
  decks: FlashcardDeck[],
  query: string,
  sort: SubjectSort,
): { category: SubjectCategory; rows: Row[] }[] {
  const needle = query.trim().toLowerCase()

  const rows: Row[] = decks
    .map((deck) => ({
      deck,
      visual: subjectVisual(deck.name, deck.color, deck.icon),
      mastery: masteryOf(deck),
    }))
    .filter((row) => !needle || row.deck.name.toLowerCase().includes(needle))

  const compare = (a: Row, b: Row) => {
    switch (sort) {
      case 'name':
        return a.deck.name.localeCompare(b.deck.name, 'es')
      case 'mastery':
        return a.mastery - b.mastery || a.deck.name.localeCompare(b.deck.name, 'es')
      case 'mir':
        return b.visual.mirWeight - a.visual.mirWeight || a.deck.name.localeCompare(b.deck.name, 'es')
      case 'due':
      default:
        // Más pendientes primero: es la pregunta que trae al usuario aquí.
        return b.deck.dueCards - a.deck.dueCards || a.deck.name.localeCompare(b.deck.name, 'es')
    }
  }

  return CATEGORY_ORDER.map((category) => ({
    category,
    rows: rows.filter((row) => row.visual.category === category).sort(compare),
  })).filter((section) => section.rows.length > 0)
}

export default function SubjectList({
  decks,
  query,
  sort,
  collapsed,
  onToggleCategory,
  onOpen,
  onStudy,
  onEdit,
  onDelete,
}: {
  decks: FlashcardDeck[]
  query: string
  sort: SubjectSort
  collapsed: ReadonlySet<SubjectCategory>
  onToggleCategory: (category: SubjectCategory) => void
  onOpen: (deck: FlashcardDeck) => void
  onStudy: (deck: FlashcardDeck) => void
  onEdit: (deck: FlashcardDeck) => void
  onDelete: (deck: FlashcardDeck) => void
}) {
  const sections = useMemo(() => groupSubjects(decks, query, sort), [decks, query, sort])

  if (sections.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-[#E0D8D4] bg-white/60 px-4 py-8 text-center text-sm font-semibold text-[#9CA3AF]">
        {query.trim()
          ? `Ninguna asignatura coincide con «${query.trim()}».`
          : 'Todavía no tienes asignaturas.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Rótulo de las columnas. Sin él, tres cifras de colores junto a cada
          asignatura no dicen qué es cada una.
          Repite la estructura de una fila —relleno, hueco flexible y el mismo
          ancho reservado para los botones (ACTIONS_W)— para que las columnas
          queden alineadas por construcción y no por un relleno acertado a ojo. */}
      <div className="-mb-3 flex items-center gap-3 border-2 border-transparent px-3 text-[9px] font-black uppercase tracking-[0.1em]">
        <span className="min-w-0 flex-1" />
        <span className="flex shrink-0 items-center gap-1">
          <span className="w-11 text-center" style={{ color: STATUS_TONE.new.fg }}>
            Nuevas
          </span>
          <span className="w-11 text-center" style={{ color: STATUS_TONE.failed.fg }}>
            Falladas
          </span>
          <span className="w-11 text-center" style={{ color: DUE_TONE.fg }}>
            Repasos
          </span>
        </span>
        <span className={`${ACTIONS_W} shrink-0`} aria-hidden />
      </div>

      {sections.map((section) => {
        const isCollapsed = collapsed.has(section.category)
        const due = section.rows.reduce(
          (n, r) => n + Math.max(0, r.deck.dueReviewCards - r.deck.summary.failed),
          0,
        )
        const failed = section.rows.reduce((n, r) => n + r.deck.summary.failed, 0)
        const fresh = section.rows.reduce((n, r) => n + r.deck.summary.new, 0)

        return (
          <section key={section.category}>
            <button
              type="button"
              onClick={() => onToggleCategory(section.category)}
              className="group w-full text-left"
              aria-expanded={!isCollapsed}
            >
              <SectionLabel
                right={
                  <span className="flex items-center gap-3 text-[11px] font-black tabular-nums">
                    <span style={{ color: STATUS_TONE.new.fg }}>{fresh}</span>
                    <span style={{ color: STATUS_TONE.failed.fg }}>{failed}</span>
                    <span style={{ color: DUE_TONE.fg }}>{due}</span>
                    <span
                      className={`material-symbols-outlined text-base text-[#B8C0C8] transition-transform ${
                        isCollapsed ? '' : 'rotate-180'
                      }`}
                    >
                      expand_more
                    </span>
                  </span>
                }
              >
                {CATEGORY_LABEL[section.category]}
              </SectionLabel>
            </button>

            {isCollapsed ? null : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {section.rows.map((row, i) => (
                  <motion.li
                    key={row.deck.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.2), duration: 0.18 }}
                  >
                    <SubjectRow
                      row={row}
                      query={query}
                      onOpen={() => onOpen(row.deck)}
                      onStudy={() => onStudy(row.deck)}
                      onEdit={() => onEdit(row.deck)}
                      onDelete={() => onDelete(row.deck)}
                    />
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function SubjectRow({
  row,
  query,
  onOpen,
  onStudy,
  onEdit,
  onDelete,
}: {
  row: Row
  query: string
  onOpen: () => void
  onStudy: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { deck, visual, mastery } = row
  // Sin nada pendiente la fila se apaga: es lo que hace que la lista se lea de
  // un vistazo, porque lo que queda encendido es justo lo que hay que trabajar.
  const idle = deck.dueCards === 0

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-2xl border-2 bg-white px-3 py-2.5 transition-colors ${
        idle ? 'border-[#EFEAE7]' : 'border-[#E4DCD8] hover:border-[#2c3e50]'
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#2c3e50] text-[11px] font-black text-white"
          style={{ background: visual.color.bg, opacity: idle ? 0.55 : 1 }}
          title={deck.name}
        >
          {visual.sigla}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`material-symbols-outlined shrink-0 text-base ${
                idle ? 'text-[#C9CFD5]' : 'text-[#9CA3AF]'
              }`}
            >
              {visual.icon}
            </span>
            <span
              className={`truncate text-sm font-black ${idle ? 'text-[#9CA3AF]' : 'text-[#2C3E50]'}`}
            >
              <HighlightedText text={deck.name} query={query} />
            </span>
          </span>

          <MasteryBar percent={mastery} total={deck.totalCards} />
        </span>
      </button>

      {/* Columnas de ancho fijo, para que se lean en vertical. */}
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0"
        aria-label={`${deck.name}: ${deck.summary.new} nuevas, ${deck.summary.failed} falladas, ${Math.max(0, deck.dueReviewCards - deck.summary.failed)} por repasar`}
      >
        <WorkCounts deck={deck} />
      </button>

      <div className={`${ACTIONS_W} flex shrink-0 items-center justify-end gap-1`}>
        <button
          type="button"
          onClick={onStudy}
          disabled={deck.totalCards === 0}
          title={deck.totalCards === 0 ? 'Esta asignatura no tiene tarjetas' : 'Estudiar'}
          className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#E4DCD8] text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:bg-[#2c3e50] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E4DCD8] disabled:hover:bg-transparent disabled:hover:text-[#7D8A96]"
        >
          <span className="material-symbols-outlined text-lg">play_arrow</span>
        </button>
        <DropdownMenu
          ariaLabel={`Acciones de ${deck.name}`}
          items={[
            { label: 'Editar', icon: 'edit', onSelect: onEdit },
            { label: 'Eliminar', icon: 'delete', danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  )
}

/**
 * Contador de una columna. El cero se dibuja como una raya en vez de como "0":
 * en una lista larga, los ceros llenan las columnas de ruido y cuesta encontrar
 * las cifras que importan.
 */
export function Count({
  value,
  tone,
  compact,
}: {
  value: number
  tone: { fg: string; bg: string; border: string }
  compact?: boolean
}) {
  const ancho = compact ? 'w-7' : 'w-11'
  if (value === 0) {
    return (
      <span className={`${ancho} text-center text-xs font-bold tabular-nums text-[#D4D9DD]`}>–</span>
    )
  }
  return (
    <span
      className={`${ancho} rounded-lg border py-0.5 text-center ${
        compact ? 'text-[10px]' : 'text-xs'
      } font-black tabular-nums`}
      style={{ color: tone.fg, background: tone.bg, borderColor: tone.border }}
    >
      {value}
    </span>
  )
}

/** Verde de "toca repasar", el mismo papel que la columna Due de Anki. */
export const DUE_TONE = { fg: '#5C7A59', bg: '#EAF2E8', border: '#CFE0CC' }

/**
 * Ancho reservado para los botones del final de cada fila. Lo comparten la fila
 * y el rótulo de columnas: si solo lo supiera una de las dos, las cifras y sus
 * títulos se irían desalineando en cuanto cambiara un botón.
 */
const ACTIONS_W = 'w-[4.5rem]'

/**
 * Las tres columnas de trabajo, con la misma lectura que el navegador de mazos
 * de Anki: nuevas, falladas y repasos que tocan. Son DISJUNTAS —una tarjeta
 * cuenta en una sola— para que sumarlas dé el trabajo pendiente de verdad.
 */
export function WorkCounts({ deck, compact }: { deck: FlashcardDeck; compact?: boolean }) {
  // `dueReviewCards` son las vencidas ya vistas, falladas incluidas; se restan
  // para que no aparezcan contadas dos veces.
  const repasos = Math.max(0, deck.dueReviewCards - deck.summary.failed)
  return (
    <span
      className="flex shrink-0 items-center gap-1"
      title={`${deck.summary.new} nuevas · ${deck.summary.failed} falladas · ${repasos} por repasar · ${deck.totalCards} en total`}
    >
      <Count value={deck.summary.new} tone={STATUS_TONE.new} compact={compact} />
      <Count value={deck.summary.failed} tone={STATUS_TONE.failed} compact={compact} />
      <Count value={repasos} tone={DUE_TONE} compact={compact} />
    </span>
  )
}

/** Barra de dominio con su porcentaje y el total de tarjetas al lado. */
export function MasteryBar({ percent, total }: { percent: number; total: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-[3px] w-full max-w-[9rem] overflow-hidden rounded-full bg-[#EFEAE7]">
        <span
          className={`block h-full rounded-full ${domainColorClass(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#B0B8BF]">
        {percent}% · {total}
      </span>
    </span>
  )
}
