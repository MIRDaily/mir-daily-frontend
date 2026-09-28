'use client'

// Los cuatro botones de respuesta, cada uno con el intervalo que le tocaría a la
// tarjeta si lo eliges. Es lo que convierte el repaso en una decisión informada:
// antes eran dos botones y no había forma de saber qué implicaba cada uno.
//
// Los intervalos NO se calculan aquí: llegan ya resueltos desde el servidor con
// cada tarjeta. Si se calcularan en el cliente habría que mantener los mismos
// parámetros de FSRS en los dos lados, y en cuanto se desincronizaran el botón
// prometería una fecha que el servidor no va a cumplir.

import { GRADE, type Grade, type GradePreview } from '@/lib/studioFlashcards'

const BOTONES: { grade: Grade; label: string; icon: string; fg: string; bg: string }[] = [
  { grade: GRADE.again, label: 'Otra vez', icon: 'replay', fg: '#C4655A', bg: '#FFF1EE' },
  { grade: GRADE.hard, label: 'Difícil', icon: 'trending_down', fg: '#B4831F', bg: '#FBF3E1' },
  { grade: GRADE.good, label: 'Bien', icon: 'check', fg: '#5C7A59', bg: '#EAF2E8' },
  { grade: GRADE.easy, label: 'Fácil', icon: 'bolt', fg: '#4E7C9B', bg: '#E7F0F6' },
]

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
  onGrade,
}: {
  preview?: Record<string, GradePreview>
  now: Date
  disabled?: boolean
  onGrade: (grade: Grade) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {BOTONES.map((b) => (
        <button
          key={b.grade}
          type="button"
          onClick={() => onGrade(b.grade)}
          disabled={disabled}
          className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[#2c3e50] px-3 py-3 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          style={{ background: b.bg, boxShadow: `4px 4px 0 0 ${b.fg}` }}
        >
          <span className="flex items-center gap-1.5 text-sm font-black" style={{ color: b.fg }}>
            <span className="material-symbols-outlined text-lg">{b.icon}</span>
            {b.label}
          </span>
          <span className="text-xs font-black tabular-nums text-[#2C3E50]">
            {formatInterval(preview?.[String(b.grade)], now)}
          </span>
          <kbd className="kbd text-[10px]">{b.grade}</kbd>
        </button>
      ))}
    </div>
  )
}
