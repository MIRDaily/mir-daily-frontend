'use client'

// «Estudiar» en un grupo de flashcards → ajustes mínimos de la sesión antes de empezar: cuántas, qué
// tarjetas (todas, pendientes, solo falladas, solo nuevas), temas, dificultad y escalera. Abre con los
// últimos que se usaron en ese grupo; «Empezar» en un clic si no se quiere tocar nada (Enter también).
// Los aplica el servidor; aquí se avisa de cuántas van a salir.

import { useEffect, useMemo, useState } from 'react'
import { FLASHCARD_LEVELS, LEVEL_INFO, type Flashcard, type FlashcardLevel } from '@/lib/studioFlashcards'
import type { Escalera } from '@/lib/flashcards/escalera'
import {
  CANTIDADES,
  coincideSolo,
  coinciden,
  OPCIONES_SOLO,
  temasDelGrupo,
  type AjustesSesion,
} from '@/lib/flashcards/sesion'
import { INK } from '@/components/flashcards/ui'

const chip = (on: boolean, color = '#E8A598') => ({
  border: `2px solid ${on ? color : '#EDE6DE'}`,
  background: on ? '#FFFFFF' : '#FFFFFF',
  color: on ? '#2C3E50' : '#7D8A96',
})

export function AjustesSesionDialogo({
  deckName,
  cards,
  inicial,
  escalera,
  onEmpezar,
  onCerrar,
}: {
  deckName: string
  cards: Flashcard[]
  inicial: AjustesSesion
  /** Foto de la escalera del grupo (para que el número que se avisa cuente con ella). */
  escalera: Escalera | null
  onEmpezar: (a: AjustesSesion) => void
  onCerrar: () => void
}) {
  const [a, setA] = useState<AjustesSesion>(inicial)
  const temas = useMemo(() => temasDelGrupo(cards), [cards])
  const conNivel = cards.some((c) => c.level)
  const conTemas = temas.length > 1
  const efectivos: AjustesSesion = { ...a, escalera: conNivel && a.escalera }
  const salen = coinciden(cards, efectivos, escalera).length
  const tarjetas = a.cantidad ? Math.min(a.cantidad, salen) : salen
  const porSolo = (s: AjustesSesion['solo']) => cards.filter((c) => coincideSolo(c, s)).length
  const elegidos = a.temas ? new Set(a.temas) : null

  const alternarTema = (t: string) =>
    setA((x) => {
      const actual = new Set(x.temas ?? temas.map((y) => y.tema))
      if (actual.has(t)) actual.delete(t)
      else actual.add(t)
      return { ...x, temas: actual.size === temas.length ? null : [...actual] }
    })
  const alternarNivel = (n: FlashcardLevel) =>
    setA((x) => {
      const ns = x.niveles.includes(n) ? x.niveles.filter((y) => y !== n) : [...x.niveles, n].sort()
      return { ...x, niveles: ns.length ? ns : x.niveles }
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCerrar()
      } else if (e.key === 'Enter' && tarjetas > 0 && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        onEmpezar(a)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [a, tarjetas, onCerrar, onEmpezar])

  const etiqueta = (t: string) => t || 'Sin tema'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajustes-sesion-titulo"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-[#FAF7F4]"
        style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <h2 id="ajustes-sesion-titulo" className="flex items-center gap-2 text-xl font-extrabold text-[#2C3E50]">
              <span aria-hidden className="inline-block text-[#E8A598]">
                <span className="material-symbols-outlined text-[24px] leading-none">tune</span>
              </span>
              Ajustes de la sesión
            </h2>
            <p className="mt-1 truncate text-sm text-[#7D8A96]">{deckName}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-[#7D8A96] hover:bg-white hover:text-[#2C3E50]">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <div className="overflow-y-auto px-6 pb-5">
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Cuántas tarjetas</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Cuántas tarjetas">
            {[...CANTIDADES, null].map((n) => (
              <button
                key={n ?? 'todas'}
                type="button"
                role="radio"
                aria-checked={a.cantidad === n}
                onClick={() => setA((x) => ({ ...x, cantidad: n }))}
                className="min-w-[3.4rem] rounded-xl px-3 py-1.5 text-sm font-extrabold"
                style={chip(a.cantidad === n)}
              >
                {n ?? 'Todas'}
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Qué tarjetas</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Qué tarjetas">
            {OPCIONES_SOLO.map((o) => {
              const n = porSolo(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={a.solo === o.id}
                  disabled={n === 0}
                  onClick={() => setA((x) => ({ ...x, solo: o.id }))}
                  className="rounded-2xl bg-white px-3 py-2 text-left disabled:opacity-40"
                  style={{ border: `2px solid ${a.solo === o.id ? '#E8A598' : 'transparent'}` }}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-extrabold text-[#2C3E50]">{o.titulo}</span>
                    <span className="text-xs font-bold text-[#7D8A96]">{n}</span>
                  </span>
                  <span className="block text-[0.72rem] text-[#7D8A96]">{o.descripcion}</span>
                </button>
              )
            })}
          </div>

          {conTemas ? (
            <>
              <div className="mt-5 flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Temas</p>
                <button
                  type="button"
                  onClick={() => setA((x) => ({ ...x, temas: null }))}
                  disabled={!a.temas}
                  className="text-xs font-bold text-[#7D8A96] underline disabled:no-underline disabled:opacity-50"
                >
                  {a.temas ? 'Todos' : 'Todos los temas'}
                </button>
              </div>
              <div className="mt-2 flex max-h-[9.5rem] flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Temas">
                {temas.map((t) => {
                  const on = !elegidos || elegidos.has(t.tema)
                  return (
                    <button
                      key={t.tema || '—'}
                      type="button"
                      aria-pressed={on}
                      onClick={() => alternarTema(t.tema)}
                      className="max-w-full truncate rounded-full px-3 py-1 text-xs font-extrabold"
                      style={{ ...chip(on), textDecoration: on ? undefined : 'line-through' }}
                    >
                      {etiqueta(t.tema)} · {t.total}
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}

          {conNivel ? (
            <>
              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Dificultad</p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Niveles de dificultad">
                {FLASHCARD_LEVELS.map((n) => {
                  const total = cards.filter((c) => c.level === n).length
                  const on = a.niveles.includes(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      disabled={total === 0}
                      onClick={() => alternarNivel(n)}
                      className="rounded-full px-3 py-1 text-xs font-extrabold disabled:opacity-40"
                      style={{
                        border: `2px solid ${on ? LEVEL_INFO[n].color : '#E4DCD8'}`,
                        background: on ? LEVEL_INFO[n].soft : '#FFFFFF',
                        color: on ? LEVEL_INFO[n].color : '#7D8A96',
                      }}
                    >
                      {LEVEL_INFO[n].name} · {total}
                    </button>
                  )
                })}
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-[#7D8A96]">
                <input
                  type="checkbox"
                  role="switch"
                  checked={a.escalera}
                  onChange={(e) => setA((x) => ({ ...x, escalera: e.target.checked }))}
                  style={{ accentColor: '#E8A598', width: 16, height: 16, marginTop: 1, flexShrink: 0 }}
                />
                <span>
                  <b className="text-[#2C3E50]">Escalera de dificultad</b>: lo nuevo de un nivel sale cuando dominas lo de abajo de su tema. Lo ya
                  visto sale siempre.
                </span>
              </label>
            </>
          ) : null}
        </div>

        <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
          <p className="mb-3 text-sm text-[#2C3E50]" aria-live="polite">
            {tarjetas > 0 ? (
              <>
                Vas a estudiar <b>{tarjetas}</b> {tarjetas === 1 ? 'tarjeta' : 'tarjetas'}
                {a.cantidad && salen > a.cantidad ? <span className="text-[#7D8A96]"> de {salen} que coinciden</span> : null}. Las que falles vuelven en la
                misma sesión.
              </>
            ) : (
              <span className="font-bold text-[#B04A5E]">Ninguna tarjeta coincide con estos ajustes.</span>
            )}
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onEmpezar(a)}
              disabled={tarjetas === 0}
              className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              <span aria-hidden className="inline-block">
                <span className="material-symbols-outlined text-[1.1rem] leading-none">play_arrow</span>
              </span>
              Empezar
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
