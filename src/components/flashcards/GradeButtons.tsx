'use client'

// Los botones de respuesta, cada uno con el intervalo que le tocaría a la tarjeta si lo eliges. Por defecto
// el semáforo de tres («No me la sabía» / «Me costó» / «Me la sabía»); con la preferencia de Anki, los cuatro
// de siempre. Ver lib/flashcards/botones.ts.
//
// Los intervalos NO se calculan aquí: llegan ya resueltos desde el servidor con
// cada tarjeta. Si se calcularan en el cliente habría que mantener los mismos
// parámetros de FSRS en los dos lados, y en cuanto se desincronizaran el botón
// prometería una fecha que el servidor no va a cumplir.

import type { Grade, GradePreview } from '@/lib/studioFlashcards'
import { botonesDe, POR_DEFECTO, type NumBotones } from '@/lib/flashcards/botones'

/**
 * Intervalo en la forma corta de Anki. Por debajo de un día se dan minutos u
 * horas, porque `scheduledDays` sale 0 en los primeros pasos y decir "0 d" no
 * significa nada.
 */
export function formatInterval(preview: GradePreview | undefined, from: Date): string {
  if (!preview) return '—'

  const days = preview.scheduledDays
  if (days >= 365) {
    const years = days / 365
    return `${years < 10 ? years.toFixed(1).replace('.0', '') : Math.round(years)} a`
  }
  if (days >= 30) return `${Math.round(days / 30)} m`
  if (days >= 1) return `${days} d`

  const minutes = Math.round((new Date(preview.due).getTime() - from.getTime()) / 60000)
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${minutes} min`
  return `${Math.round(minutes / 60)} h`
}

export default function GradeButtons({
  preview,
  now,
  disabled,
  botones = POR_DEFECTO,
  onGrade,
}: {
  preview?: Record<string, GradePreview>
  now: Date
  disabled?: boolean
  /** 3 = semáforo (por defecto), 4 = los de Anki. */
  botones?: NumBotones
  onGrade: (grade: Grade) => void
}) {
  const lista = botonesDe(botones)
  return (
    <div className={`grid gap-2 ${botones === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
      {lista.map((b) => {
        const cuando = formatInterval(preview?.[String(b.grade)], now)
        return (
          <button
            key={b.grade}
            type="button"
            onClick={() => onGrade(b.grade)}
            disabled={disabled}
            aria-label={`${b.label}: vuelve en ${cuando}`}
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#2c3e50] px-2 py-3 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: b.bg, boxShadow: `4px 4px 0 0 ${b.fg}` }}
          >
            <span className="flex items-center gap-1.5 text-center text-sm font-black leading-tight" style={{ color: b.fg }}>
              <span aria-hidden className="inline-block">
                <span className="material-symbols-outlined text-lg leading-none">{b.icon}</span>
              </span>
              {b.label}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-[#2C3E50]/70">{cuando}</span>
            <kbd className="kbd hidden text-[10px] sm:inline-flex">{b.grade}</kbd>
          </button>
        )
      })}
    </div>
  )
}
