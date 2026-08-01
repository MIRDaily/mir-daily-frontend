'use client'

import { useEffect, useState } from 'react'
// La lista de asignaturas es un catálogo compartido, no algo del simulacro:
// se reutiliza su consulta en vez de duplicar el endpoint.
import { fetchSubjects } from '@/lib/simulacro/queries'
import type { Subject } from '@/lib/simulacro/types'
import { startGame } from '@/lib/versus/queries'
import type { VersusMode } from '@/lib/versus/types'

type VersusStartPanelProps = {
  pin: string
  canStart: boolean
}

const COUNTS = [5, 10, 15, 20] as const
const LIVES = [1, 2, 3] as const

// Solo los modos con reglas escritas. Los demás siguen anunciados en /versus
// como "próximamente", pero aquí no se pueden elegir.
const MODES = [
  {
    id: 'classic' as const,
    icon: 'swords',
    name: 'Clásico',
    blurb: 'Acertar y ser rápido. Gana quien más puntúa.',
  },
  {
    id: 'mir_rank' as const,
    icon: 'trending_up',
    name: 'Número de orden',
    blurb: 'Como el MIR: +3 acertar, −1 fallar. Sin premio a la velocidad.',
  },
  {
    id: 'survival' as const,
    icon: 'bolt',
    name: 'Guardia',
    blurb: 'Quien falla pierde una vida. El último en pie gana.',
  },
]

export default function VersusStartPanel({ pin, canStart }: VersusStartPanelProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [count, setCount] = useState<number>(10)
  const [mode, setMode] = useState<VersusMode>('classic')
  const [lives, setLives] = useState<number>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubjects()
      .then(setSubjects)
      .catch(() => setError('No se pudieron cargar las asignaturas.'))
  }, [])

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  async function handleStart() {
    if (selected.length === 0) return
    setBusy(true)
    setError(null)
    try {
      // El servidor emite el arranque por el canal; esta pantalla cambia sola
      // al llegar el evento, no hace falta navegar.
      await startGame(pin, { subjectIds: selected, topicIds: [], count, mode, lives })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo empezar la partida.')
      setBusy(false)
    }
  }

  return (
    <section className="mb-8 rounded-2xl border-2 border-[#EAE4E2] bg-white p-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
        Configura la partida
      </h2>

      <p className="mb-3 text-sm font-semibold text-[#2c3e50]">Modo</p>
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        {MODES.map((option) => {
          const on = mode === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`rounded-xl border-2 p-3 text-left transition-colors ${
                on
                  ? 'border-[#E8A598] bg-[#E8A598]/10'
                  : 'border-[#EAE4E2] hover:border-[#E8A598]/40'
              }`}
            >
              <span className="mb-1 flex items-center gap-1.5">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    on ? 'text-[#d18d80]' : 'text-[#7D8A96]'
                  }`}
                >
                  {option.icon}
                </span>
                <span
                  className={`text-sm font-bold ${on ? 'text-[#d18d80]' : 'text-[#2c3e50]'}`}
                >
                  {option.name}
                </span>
              </span>
              <span className="block text-xs leading-snug text-[#7D8A96]">{option.blurb}</span>
            </button>
          )
        })}
      </div>

      {mode === 'survival' ? (
        <>
          <p className="mb-3 text-sm font-semibold text-[#2c3e50]">Vidas</p>
          <div className="mb-6 flex gap-2">
            {LIVES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLives(value)}
                className={`flex items-center gap-1.5 rounded-lg border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
                  lives === value
                    ? 'border-[#E8A598] bg-[#E8A598]/10 text-[#d18d80]'
                    : 'border-[#EAE4E2] text-[#7D8A96] hover:border-[#E8A598]/40'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">favorite</span>
                {value}
              </button>
            ))}
            <span className="self-center text-xs text-[#7D8A96]">
              {lives === 1 ? 'Muerte súbita' : `Aguantas ${lives} fallos`}
            </span>
          </div>
        </>
      ) : null}

      <p className="mb-3 text-sm font-semibold text-[#2c3e50]">Asignaturas</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {subjects.map((subject) => {
          const on = selected.includes(subject.id)
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => toggle(subject.id)}
              className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                on
                  ? 'border-[#E8A598] bg-[#E8A598]/10 text-[#d18d80]'
                  : 'border-[#EAE4E2] text-[#7D8A96] hover:border-[#E8A598]/40'
              }`}
            >
              {subject.name}
            </button>
          )
        })}
      </div>

      <p className="mb-3 text-sm font-semibold text-[#2c3e50]">Preguntas</p>
      <div className="mb-6 flex gap-2">
        {COUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCount(value)}
            className={`rounded-lg border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
              count === value
                ? 'border-[#E8A598] bg-[#E8A598]/10 text-[#d18d80]'
                : 'border-[#EAE4E2] text-[#7D8A96] hover:border-[#E8A598]/40'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={!canStart || selected.length === 0 || busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80] disabled:cursor-not-allowed disabled:bg-[#F2EFED] disabled:text-[#7D8A96]/60 disabled:shadow-none"
      >
        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
        {busy ? 'Empezando…' : canStart ? 'Empezar partida' : 'Falta gente para empezar'}
      </button>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-[#C4655A]">
          {error}
        </p>
      ) : null}
    </section>
  )
}
