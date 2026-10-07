'use client'

import { useState } from 'react'
import {
  alternarEntrada,
  estadoEntrada,
  leerRango,
  rangoLabel,
  seccionesDePaginas,
  type EntradaIndice,
} from '@/lib/mapas/ia/indice'
import type { Seccion } from '@/lib/mapas/ia/types'
import { INK } from './ProgresoIA'

// «Qué parte usar» (informe 76): el índice del documento (temas, apartados, páginas o
// diapositivas, con sus caracteres) para marcar solo una parte, o un rango de páginas a mano.
// Al servidor solo viaja lo marcado.

const fmt = (n: number) => n.toLocaleString('es-ES')

export function SelectorParte({
  secciones,
  indice,
  sel,
  onChange,
  unidad,
  abierto,
  onAbrir,
  resumen,
}: {
  secciones: Seccion[]
  indice: EntradaIndice[]
  sel: Set<number>
  onChange: (sel: Set<number>) => void
  unidad: 'página' | 'diapositiva'
  abierto: boolean
  onAbrir: (v: boolean) => void
  /** «Todo el documento» o «3 de 11 partes»… */
  resumen: string
}) {
  const [rango, setRango] = useState('')
  const maxPagina = Math.max(1, ...secciones.map((s, i) => s.pagina ?? i + 1))
  const rangoMal = rango.trim() !== '' && leerRango(rango, maxPagina) === null
  const todo = sel.size === secciones.length

  return (
    <div className="mt-4 rounded-2xl bg-white" style={{ border: `2px solid ${INK}` }}>
      <button
        type="button"
        onClick={() => onAbrir(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span aria-hidden className="inline-block text-[#E8A598]">
          <span className="material-symbols-outlined text-[1.4rem] leading-none">checklist</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-[#2C3E50]">Qué parte usar</span>
          <span className="block truncate text-xs text-[#7D8A96]">{resumen}</span>
        </span>
        <span aria-hidden className="inline-block text-[#7D8A96]">
          <span className="material-symbols-outlined text-[1.3rem] leading-none">{abierto ? 'expand_less' : 'expand_more'}</span>
        </span>
      </button>

      {abierto && (
        <div className="border-t border-[#EDE6DE] px-4 pb-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(new Set(secciones.map((_, i) => i)))}
              disabled={todo}
              className="rounded-full border-2 border-[#2C3E50] px-3 py-0.5 text-[0.75rem] font-bold text-[#2C3E50] disabled:opacity-40"
            >
              Todo
            </button>
            <button
              type="button"
              onClick={() => onChange(new Set())}
              disabled={sel.size === 0}
              className="rounded-full border-2 border-[#D4C8BE] px-3 py-0.5 text-[0.75rem] font-bold text-[#7D8A96] disabled:opacity-40"
            >
              Nada
            </button>
            <label className="ml-auto flex items-center gap-2 text-[0.75rem] font-bold text-[#7D8A96]">
              {unidad === 'diapositiva' ? 'Diapositivas' : 'Páginas'}
              <input
                value={rango}
                onChange={(e) => {
                  const v = e.target.value.slice(0, 80)
                  setRango(v)
                  const paginas = leerRango(v, maxPagina)
                  if (paginas) onChange(seccionesDePaginas(secciones, paginas))
                }}
                placeholder={`p. ej. 3-5, 8 (de ${maxPagina})`}
                aria-invalid={rangoMal}
                className="w-[10.5rem] rounded-xl border-2 bg-white px-2.5 py-1 text-[0.8rem] font-semibold text-[#2C3E50] outline-none"
                style={{ borderColor: rangoMal ? '#D4667A' : '#D4C8BE' }}
              />
            </label>
          </div>
          {rangoMal && <p className="mt-1 text-[0.72rem] font-semibold text-[#B04A5E]">Escribe páginas o rangos: 3-5, 8</p>}

          <ul className="mt-2 max-h-[14rem] space-y-0.5 overflow-y-auto pr-1" aria-label="Índice del documento">
            {indice.map((e) => {
              const estado = estadoEntrada(e, sel)
              return (
                <li key={e.key}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={estado === 'todo' ? true : estado === 'parte' ? 'mixed' : false}
                    onClick={() => onChange(alternarEntrada(e, sel))}
                    className={`flex w-full items-center gap-2 rounded-lg py-1 pr-1 text-left hover:bg-[#FAF7F4] ${e.nivel === 2 ? 'pl-6' : 'pl-1'}`}
                  >
                    <Casilla estado={estado} />
                    <span className={`min-w-0 flex-1 truncate text-[0.8rem] text-[#2C3E50] ${e.nivel === 1 ? 'font-bold' : ''}`}>
                      {e.titulo}
                    </span>
                    <span className="shrink-0 text-[0.7rem] tabular-nums text-[#7D8A96]">
                      {rangoLabel(e, unidad)}
                      {rangoLabel(e, unidad) ? ' · ' : ''}
                      {fmt(e.caracteres)} car.
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function Casilla({ estado }: { estado: 'todo' | 'parte' | 'nada' }) {
  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] text-[0.7rem] font-black leading-none text-white"
      style={{ border: `2px solid ${estado === 'nada' ? '#D4C8BE' : INK}`, background: estado === 'nada' ? '#FFFFFF' : '#E8A598' }}
    >
      {estado === 'todo' ? '✓' : estado === 'parte' ? '–' : ''}
    </span>
  )
}
