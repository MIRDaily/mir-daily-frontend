'use client'

// La barra de acciones de la selección múltiple de un grupo (fija abajo mientras haya algo marcado):
// mover o copiar a otro grupo, cambiar el tema y borrar. «Cambiar tema» se abre aquí mismo, con la
// lista de los temas del grupo.

import { useId, useState } from 'react'
import { MAX_TEMA } from '@/lib/resumenes/huecos'

const INK = '#2C3E50'

function Accion({ icon, children, onClick, disabled, peligro }: { icon: string; children: string; onClick: () => void; disabled?: boolean; peligro?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-extrabold transition-colors disabled:opacity-45 ${
        peligro ? 'text-[#B04A5E] hover:bg-[#FAEAED]' : 'text-[#2C3E50] hover:bg-[#FAF7F4]'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        {icon}
      </span>
      {children}
    </button>
  )
}

export function BarraBloque({
  n,
  ocultos,
  temas,
  ocupado,
  onMover,
  onCopiar,
  onCambiarTema,
  onBorrar,
  onCerrar,
}: {
  n: number
  /** Cuántos de los seleccionados no se ven ahora por los filtros. */
  ocultos: number
  temas: string[]
  ocupado: boolean
  onMover: () => void
  onCopiar: () => void
  onCambiarTema: (tema: string | null) => Promise<boolean>
  onBorrar: () => void
  onCerrar: () => void
}) {
  const [tema, setTema] = useState<string | null>(null)
  const idLista = useId()

  const aplicar = async () => {
    if (tema === null || ocupado) return
    if (await onCambiarTema(tema.trim() || null)) setTema(null)
  }

  return (
    <div
      role="region"
      aria-label="Acciones con los párrafos seleccionados"
      className="w-full rounded-3xl border-2 border-[#2c3e50] bg-white px-3 py-2"
      style={{ boxShadow: `5px 5px 0 0 ${INK}` }}
      data-barra-bloque
    >
      <div className="flex flex-wrap items-center gap-1">
        <p className="px-2 text-sm font-black text-[#2C3E50]">
          {n === 1 ? '1 seleccionado' : `${n} seleccionados`}
          {ocultos > 0 && <span className="ml-1 text-xs font-bold text-[#7D8A96]">({ocultos} {ocultos === 1 ? 'oculto' : 'ocultos'} por los filtros)</span>}
        </p>
        <span className="mx-1 hidden h-5 w-px bg-[#E6DEDA] sm:block" aria-hidden />
        <Accion icon="drive_file_move" onClick={onMover} disabled={ocupado}>
          Mover a…
        </Accion>
        <Accion icon="content_copy" onClick={onCopiar} disabled={ocupado}>
          Copiar a…
        </Accion>
        <Accion icon="label" onClick={() => setTema((t) => (t === null ? '' : null))} disabled={ocupado}>
          Cambiar tema
        </Accion>
        <Accion icon="delete" onClick={onBorrar} disabled={ocupado} peligro>
          Borrar
        </Accion>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Quitar la selección"
          title="Quitar la selección"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      {tema !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#7D8A96]/15 px-2 pt-2 pb-1">
          <input
            autoFocus
            value={tema}
            list={idLista}
            maxLength={MAX_TEMA}
            onChange={(e) => setTema(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void aplicar()
              if (e.key === 'Escape') setTema(null)
            }}
            placeholder="Tema nuevo (vacío: sin tema)"
            aria-label="Tema nuevo"
            className="min-w-0 flex-1 rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-1.5 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
          />
          <datalist id={idLista}>
            {temas.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button type="button" onClick={() => setTema(null)} className="text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={ocupado}
            className="rounded-xl bg-[#E8A598] px-4 py-1.5 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
          >
            {tema.trim() ? 'Cambiar' : 'Quitar el tema'}
          </button>
        </div>
      )}
    </div>
  )
}
