'use client'

// Barra de la página de un grupo: buscador (texto y tema, o solo las respuestas de los huecos), chips
// de estado, nivel, «Toca repasar» y «Con huecos fallados», el orden, el recuento y los atajos
// (quitar filtros, seleccionar los visibles, plegar o desplegar todos los temas).

import { memo, type ReactNode } from 'react'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { NIVELES, type Nivel } from '@/lib/resumenes/huecos'
import { ESTADO, ESTADOS_REPASO, FILTROS_VACIOS, ORDENES, esOrden, hayFiltros, type EstadoRepaso, type FiltrosGrupo as Filtros, type OrdenGrupo } from '@/lib/resumenes/grupo'

const INK = '#2C3E50'

export type ConteosGrupo = { estados: Record<EstadoRepaso, number>; niveles: Record<Nivel, number>; toca: number; conFallados: number }

function Chip({ activo, color, onClick, children }: { activo: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold transition-colors"
      style={activo ? { background: color, borderColor: INK, color: '#fff', boxShadow: `2px 2px 0 0 ${INK}` } : { background: '#fff', borderColor: `${color}55`, color }}
    >
      {children}
    </button>
  )
}

const Cuenta = ({ n }: { n: number }) => <span className="tabular-nums opacity-75">{n}</span>

function alternar<T>(xs: T[], x: T): T[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]
}

export const FiltrosGrupo = memo(function FiltrosGrupo({
  filtros,
  onFiltros,
  orden,
  onOrden,
  conteos,
  total,
  visibles,
  todosVisiblesSeleccionados,
  onSeleccionarVisibles,
  plegado,
  onPlegarTodo,
}: {
  filtros: Filtros
  onFiltros: (f: Filtros) => void
  orden: OrdenGrupo
  onOrden: (o: OrdenGrupo) => void
  conteos: ConteosGrupo
  total: number
  visibles: number
  todosVisiblesSeleccionados: boolean
  onSeleccionarVisibles: () => void
  /** Solo con el orden «Documento»: ¿están todos los temas plegados? */
  plegado: boolean | null
  onPlegarTodo: (plegar: boolean) => void
}) {
  const f = filtros
  const poner = (cambio: Partial<Filtros>) => onFiltros({ ...f, ...cambio })

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-[#2c3e50] bg-white p-4" style={{ boxShadow: `5px 5px 0 0 ${INK}` }} data-filtros-grupo>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Buscar</span>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#7D8A96]" aria-hidden>
            <span className="material-symbols-outlined text-[20px]">search</span>
          </span>
          <input
            type="search"
            value={f.busqueda}
            onChange={(e) => poner({ busqueda: e.target.value.slice(0, 120) })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && f.busqueda) {
                e.preventDefault()
                poner({ busqueda: '' })
              }
            }}
            placeholder="Buscar en el texto o en los huecos"
            className="w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] py-2 pr-3 pl-10 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
          />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={f.soloHuecos}
          onClick={() => poner({ soloHuecos: !f.soloHuecos })}
          className="flex items-center gap-2 text-xs font-extrabold text-[#2C3E50]"
        >
          <span
            aria-hidden
            className="relative inline-block h-5 w-9 rounded-full border-2 border-[#2c3e50] transition-colors"
            style={{ background: f.soloHuecos ? '#E8A598' : '#F2EFED' }}
          >
            <span className={`absolute top-[1px] h-3.5 w-3.5 rounded-full border-2 border-[#2c3e50] bg-white transition-all ${f.soloHuecos ? 'left-[15px]' : 'left-[1px]'}`} />
          </span>
          Solo en huecos
        </button>
        <label className="flex items-center gap-2 text-xs font-extrabold text-[#2C3E50]">
          Orden
          <select
            value={orden}
            onChange={(e) => esOrden(e.target.value) && onOrden(e.target.value)}
            className="rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-2 py-1.5 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
          >
            {ORDENES.map((o) => (
              <option key={o.k} value={o.k}>
                {o.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros">
        {ESTADOS_REPASO.map((s) => (
          <Chip key={s} activo={f.estados.includes(s)} color={ESTADO[s].color} onClick={() => poner({ estados: alternar(f.estados, s) })}>
            {ESTADO[s].nombre} <Cuenta n={conteos.estados[s]} />
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-[#E6DEDA]" aria-hidden />
        {NIVELES.map((n) => (
          <Chip key={n} activo={f.niveles.includes(n)} color={LEVEL_INFO[n].color} onClick={() => poner({ niveles: alternar(f.niveles, n) })}>
            {LEVEL_INFO[n].name} <Cuenta n={conteos.niveles[n]} />
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-[#E6DEDA]" aria-hidden />
        <Chip activo={f.tocaRepasar} color="#B07A1E" onClick={() => poner({ tocaRepasar: !f.tocaRepasar })}>
          Toca repasar <Cuenta n={conteos.toca} />
        </Chip>
        <Chip activo={f.conFallados} color="#B04A5E" onClick={() => poner({ conFallados: !f.conFallados })}>
          Con huecos fallados <Cuenta n={conteos.conFallados} />
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <p className="font-bold text-[#2C3E50]" aria-live="polite" data-recuento>
          {visibles === total ? `${total} ${total === 1 ? 'párrafo' : 'párrafos'}` : `${visibles} de ${total} párrafos`}
        </p>
        {hayFiltros(f) && (
          <button type="button" onClick={() => onFiltros(FILTROS_VACIOS)} className="font-bold underline hover:text-[#2C3E50]">
            Quitar filtros
          </button>
        )}
        <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
          {plegado !== null && (
            <button type="button" onClick={() => onPlegarTodo(!plegado)} className="font-bold hover:text-[#2C3E50]">
              {plegado ? 'Desplegar todo' : 'Plegar todo'}
            </button>
          )}
          {visibles > 0 && (
            <button type="button" onClick={onSeleccionarVisibles} className="font-bold hover:text-[#2C3E50]">
              {todosVisiblesSeleccionados ? `Deseleccionar los ${visibles} visibles` : `Seleccionar los ${visibles} visibles`}
            </button>
          )}
        </span>
      </div>
    </div>
  )
})
