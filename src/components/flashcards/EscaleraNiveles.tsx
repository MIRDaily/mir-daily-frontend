'use client'

// Escalera de dificultad de un grupo: por tema, qué niveles están abiertos y cuánto falta para los
// cerrados («Difícil: 12 de 20 dominadas de fácil y media»), con un candado. Los números y la regla
// vienen del servidor (get_flashcard_ladder): aquí solo se pintan.

import { useState } from 'react'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { resumenEscalera, textoFalta, type Escalera } from '@/lib/flashcards/escalera'
import { INK } from '@/components/flashcards/ui'

const VISIBLES = 6

export function EscaleraNiveles({ escalera, activa }: { escalera: Escalera; activa: boolean }) {
  const [todos, setTodos] = useState(false)
  // Primero los temas con algo cerrado (lo que queda por hacer); con un solo nivel no hay escalera.
  const temas = escalera.topics
    .filter((t) => t.levels.length > 1)
    .sort((a, b) => Number(b.levels.some((l) => !l.unlocked)) - Number(a.levels.some((l) => !l.unlocked)))
  if (!temas.length) return null
  const { nivelesCerrados } = resumenEscalera({ topics: temas })
  const vistos = todos ? temas : temas.slice(0, VISIBLES)

  return (
    <section
      aria-label="Escalera de niveles"
      className="rounded-3xl bg-white p-5"
      style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}`, opacity: activa ? 1 : 0.7 }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-black text-[#2C3E50]">
          <span aria-hidden className="inline-block text-[#E8A598]">
            <span className="material-symbols-outlined text-[1.3rem] leading-none">stairs</span>
          </span>
          Escalera de niveles
        </p>
        <p className="text-xs font-bold text-[#7D8A96]">
          {nivelesCerrados === 0 ? 'Todo abierto' : `${nivelesCerrados} ${nivelesCerrados === 1 ? 'nivel cerrado' : 'niveles cerrados'}`}
        </p>
      </div>
      <p className="mt-1 text-xs text-[#7D8A96]">
        {activa
          ? 'Las tarjetas nuevas de un nivel salen cuando dominas el 80 % de las de los niveles de abajo de ese tema. Las que ya has visto salen siempre.'
          : 'Escalera quitada: al estudiar salen las nuevas de todos los niveles.'}
      </p>
      <ul className="mt-3 space-y-2.5">
        {vistos.map((t) => (
          <li key={t.topic ?? '—'} className="rounded-2xl bg-[#FAF7F4] px-3 py-2.5">
            <p className="truncate text-[0.78rem] font-extrabold uppercase tracking-wide text-[#2C3E50]">{t.topic ?? 'Sin tema'}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {t.levels.map((l) => (
                <span
                  key={l.level}
                  title={l.unlocked ? `${LEVEL_INFO[l.level].name}: abierto (${l.mastered} de ${l.total} dominadas)` : textoFalta(t, l)}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.72rem] font-extrabold"
                  style={{
                    border: `1.5px solid ${l.unlocked ? LEVEL_INFO[l.level].color : '#D4C8BE'}`,
                    background: l.unlocked ? LEVEL_INFO[l.level].soft : '#FFFFFF',
                    color: l.unlocked ? LEVEL_INFO[l.level].color : '#7D8A96',
                  }}
                >
                  <span aria-hidden className="inline-block">
                    <span className="material-symbols-outlined text-[0.85rem] leading-none">{l.unlocked ? 'lock_open' : 'lock'}</span>
                  </span>
                  {LEVEL_INFO[l.level].name} · {l.total}
                </span>
              ))}
            </div>
            {t.levels
              .filter((l) => !l.unlocked)
              .slice(0, 1)
              .map((l) => (
                <p key={l.level} className="mt-1.5 text-[0.72rem] font-semibold text-[#8A6418]">
                  {LEVEL_INFO[l.level].name}: {textoFalta(t, l)}
                </p>
              ))}
          </li>
        ))}
      </ul>
      {temas.length > VISIBLES ? (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-2 text-xs font-bold text-[#7D8A96] underline">
          {todos ? 'Ver menos' : `Ver los ${temas.length} temas`}
        </button>
      ) : null}
    </section>
  )
}
