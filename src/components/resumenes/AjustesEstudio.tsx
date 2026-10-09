'use client'

import { useEffect, useMemo, useState } from 'react'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { NIVELES, type Nivel } from '@/lib/resumenes/huecos'
import { CUANTOS, cuantosSeEstudian, entra, type Ajustes, type Solo } from '@/lib/resumenes/sesion'
import type { Parrafo } from '@/lib/resumenes/api'
import { INK } from './ParrafoHuecos'

// «Estudiar» → ajustes de la sesión: qué niveles se TAPAN (los demás se ven), qué temas, qué párrafos
// (todos, pendientes, solo fallados, solo nuevos, con su número) y cuántos; y «Vas a estudiar N».

const SOLO: { id: Solo; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'due', nombre: 'Pendientes' },
  { id: 'failed', nombre: 'Solo fallados' },
  { id: 'new', nombre: 'Solo nuevos' },
]

export function AjustesEstudio({
  parrafos,
  inicial,
  onEmpezar,
  onCerrar,
}: {
  parrafos: Parrafo[]
  inicial: Ajustes
  onEmpezar: (a: Ajustes) => void
  onCerrar: () => void
}) {
  const temas = useMemo(() => [...new Set(parrafos.map((p) => (p.tema ?? '').trim()))], [parrafos])
  const [a, setA] = useState<Ajustes>(() => ({ ...inicial, temas: inicial.temas ? inicial.temas.filter((t) => temas.includes(t)) : null }))
  const n = cuantosSeEstudian(parrafos, a)
  const cuenta = (solo: Solo) => parrafos.filter((p) => entra(p, { ...a, solo, cuantos: null })).length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'Enter' && n > 0) onEmpezar(a)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [a, n, onCerrar, onEmpezar])

  const alternarNivel = (k: Nivel) =>
    setA((x) => {
      const ns = x.niveles.includes(k) ? x.niveles.filter((y) => y !== k) : [...x.niveles, k].sort()
      return { ...x, niveles: ns.length ? ns : x.niveles }
    })
  const marcados = a.temas ?? temas
  const alternarTema = (t: string) =>
    setA((x) => {
      const actual = x.temas ?? temas
      const nuevos = actual.includes(t) ? actual.filter((y) => y !== t) : [...actual, t]
      return { ...x, temas: nuevos.length === temas.length ? null : nuevos }
    })

  const chip = (on: boolean, color = '#E8A598') => ({ background: on ? color : '#fff', color: on ? '#fff' : '#2C3E50', border: `2px solid ${on ? INK : 'rgba(44,62,80,0.18)'}` })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="ra-ajustes" className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-[#FAF7F4]" style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}>
        <div className="overflow-y-auto px-6 pb-4 pt-6">
          <h2 id="ra-ajustes" className="text-xl font-extrabold text-[#2C3E50]">
            Ajustes de la sesión
          </h2>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Huecos que se tapan</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {NIVELES.map((k) => (
              <button key={k} type="button" aria-pressed={a.niveles.includes(k)} onClick={() => alternarNivel(k)} className="rounded-xl px-3 py-1.5 text-sm font-extrabold" style={chip(a.niveles.includes(k), LEVEL_INFO[k].color)}>
                {LEVEL_INFO[k].name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[0.72rem] text-[#7D8A96]">Los huecos de los demás niveles se ven. Solo salen los párrafos con algún hueco de estos niveles.</p>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Qué párrafos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SOLO.map((s) => (
              <button key={s.id} type="button" aria-pressed={a.solo === s.id} onClick={() => setA((x) => ({ ...x, solo: s.id }))} className="rounded-xl px-3 py-1.5 text-sm font-bold" style={chip(a.solo === s.id)}>
                {s.nombre} <span className="opacity-70">({cuenta(s.id)})</span>
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Cuántos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...CUANTOS, null].map((c) => (
              <button key={c ?? 'todos'} type="button" aria-pressed={a.cuantos === c} onClick={() => setA((x) => ({ ...x, cuantos: c }))} className="rounded-xl px-3 py-1.5 text-sm font-bold" style={chip(a.cuantos === c)}>
                {c ?? 'Todos'}
              </button>
            ))}
          </div>

          {temas.length > 1 && (
            <>
              <p className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#7D8A96]">
                Temas
                <button type="button" onClick={() => setA((x) => ({ ...x, temas: null }))} className="normal-case tracking-normal underline">
                  Todos
                </button>
              </p>
              <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {temas.map((t) => (
                  <button key={t || '-'} type="button" aria-pressed={marcados.includes(t)} onClick={() => alternarTema(t)} className="rounded-lg px-2.5 py-1 text-xs font-bold" style={chip(marcados.includes(t), '#3F7EA6')}>
                    {t || 'Sin tema'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[#7D8A96]/15 bg-white px-6 py-4">
          <p className="text-sm font-bold text-[#2C3E50]" aria-live="polite">
            {n ? `Vas a estudiar ${n} ${n === 1 ? 'párrafo' : 'párrafos'}` : 'Ningún párrafo con estos ajustes'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="rounded-xl px-3 py-2 text-sm font-bold text-[#7D8A96]">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!n}
              onClick={() => onEmpezar(a)}
              className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
              style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
            >
              Empezar
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
