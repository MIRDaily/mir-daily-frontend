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
      {sections.map((section) => {
        const isCollapsed = collapsed.has(section.category)
        const due = section.rows.reduce((n, r) => n + r.deck.dueReviewCards, 0)
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
                    <span style={{ color: STATUS_TONE.failed.fg }}>{due}</span>
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

      {/* Contadores en columnas de ancho fijo, para que se lean en vertical. */}
      <button
        type="button"
        onClick={onOpen}
        className="flex shrink-0 items-center gap-1 text-right"
        aria-label={`${deck.summary.new} nuevas, ${deck.dueReviewCards} pendientes`}
      >
        <Count value={deck.summary.new} tone={STATUS_TONE.new} />
        <Count value={deck.dueReviewCards} tone={STATUS_TONE.failed} />
      </button>

      <div className="flex shrink-0 items-center gap-1">
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
}: {
  value: number
  tone: { fg: string; bg: string; border: string }
}) {
  if (value === 0) {
    return <span className="w-11 text-center text-xs font-bold tabular-nums text-[#D4D9DD]">–</span>
  }
  return (
    <span
      className="w-11 rounded-lg border py-0.5 text-center text-xs font-black tabular-nums"
      style={{ color: tone.fg, background: tone.bg, borderColor: tone.border }}
    >
      {value}
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
