'use client'

// Un párrafo en la página de su grupo: casilla para la selección múltiple, el texto con sus huecos, el
// estado de repaso y Editar / Borrar. En `memo` y con callbacks estables desde la página, para que con
// 300 párrafos marcar uno o escribir en el buscador no repinte los demás.

import { memo } from 'react'
import { ParrafoHuecos, ResumenHuecos } from '@/components/resumenes/ParrafoHuecos'
import { ESTADO, cuandoVence, rangosEn, tocaRepasar } from '@/lib/resumenes/grupo'
import type { Parrafo } from '@/lib/resumenes/api'

/** Un texto con lo que coincide con la búsqueda resaltado. */
export function Resaltado({ texto, terminos }: { texto: string; terminos: string[] }) {
  const rangos = rangosEn(texto, terminos)
  if (!rangos.length) return <>{texto}</>
  const partes = []
  let k = 0
  for (const r of rangos) {
    if (r.i > k) partes.push(texto.slice(k, r.i))
    partes.push(
      <mark key={r.i} className="rounded bg-[#FBF0DA] px-0.5 text-inherit">
        {texto.slice(r.i, r.f)}
      </mark>,
    )
    k = r.f
  }
  if (k < texto.length) partes.push(texto.slice(k))
  return <>{partes}</>
}

export const TarjetaParrafoGrupo = memo(function TarjetaParrafoGrupo({
  p,
  seleccionado,
  onAlternar,
  onEditar,
  onBorrar,
  mostrarTema,
  mostrarVence,
  terminos,
}: {
  p: Parrafo
  seleccionado: boolean
  onAlternar: (itemId: number) => void
  onEditar: (id: string) => void
  onBorrar: (p: Parrafo) => void
  /** En los órdenes que no agrupan por tema, el tema va en la tarjeta. */
  mostrarTema: boolean
  mostrarVence: boolean
  /** Para resaltar la búsqueda en el tema. */
  terminos: string[]
}) {
  const vence = mostrarVence ? cuandoVence(p) : null
  const nFallados = p.huecosFallados?.length ?? 0
  return (
    <div
      className="flex gap-3 rounded-2xl px-4 py-3 transition-colors"
      style={{ background: seleccionado ? '#FFF4F1' : '#fff', border: seleccionado ? '2px solid #2C3E50' : '2px solid rgba(44,62,80,0.15)' }}
      data-item={p.itemId}
    >
      <input
        type="checkbox"
        checked={seleccionado}
        onChange={() => onAlternar(p.itemId)}
        aria-label="Seleccionar este párrafo"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#E8A598]"
      />
      <div className="min-w-0 flex-1">
        {mostrarTema && (
          <p className="mb-1 truncate text-[0.66rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">
            {p.tema ? <Resaltado texto={p.tema} terminos={terminos} /> : 'Sin tema'}
          </p>
        )}
        <ParrafoHuecos texto={p.texto} huecos={p.huecos} />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem]">
          <ResumenHuecos huecos={p.huecos} />
          {p.status ? (
            <span className="rounded-md px-1.5 py-0.5 font-extrabold text-white" style={{ background: ESTADO[p.status]?.color ?? '#7D8A96' }}>
              {ESTADO[p.status]?.nombre}
            </span>
          ) : null}
          {vence ? (
            <span className={`font-bold ${tocaRepasar(p) ? 'text-[#B07A1E]' : ''}`}>{vence}</span>
          ) : tocaRepasar(p) ? (
            <span className="font-bold text-[#B07A1E]">Toca repasar</span>
          ) : null}
          {p.fallos > 0 && (
            <span className="font-bold text-[#B04A5E]" title="Veces que lo has respondido mal">
              {p.fallos === 1 ? '1 fallo' : `${p.fallos} fallos`}
              {nFallados ? ` · ${nFallados === 1 ? '1 hueco fallado' : `${nFallados} huecos fallados`}` : ''}
            </span>
          )}
          {p.fallos === 0 && nFallados > 0 && (
            <span className="font-bold text-[#B04A5E]">{nFallados === 1 ? '1 hueco fallado' : `${nFallados} huecos fallados`}</span>
          )}
          {p.origen?.page ? (
            <span>
              {p.origen.unit === 'diapositiva' ? 'Diap.' : 'Pág.'} {p.origen.page}
              {p.modo === 'literal' ? ' · texto original' : ''}
            </span>
          ) : null}
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={() => onEditar(p.id)} className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAF7F4] hover:text-[#2C3E50]">
              Editar
            </button>
            <button type="button" onClick={() => onBorrar(p)} className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAEAED] hover:text-[#B04A5E]">
              Borrar
            </button>
          </span>
        </div>
      </div>
    </div>
  )
})
