'use client'

import { useEffect, useMemo, useRef } from 'react'
import { arbolProvisional, type FaseIA, type LineaProvisional, type RamaProvisional } from '@/lib/mapas/ia/stream'

// Progreso de «Crear con IA» mientras se genera (informe 76): las fases (leyendo → estructura →
// tablas → ordenando) y las ramas PROVISIONALES según las va escribiendo la IA. Es solo una vista:
// texto plano (React lo escapa), sin guardar nada; al terminar, el mapa validado la sustituye.

export const INK = '#2C3E50'
export const STICKER_SHADOW = `4px 4px 0 0 ${INK}`

const NOMBRE: Record<FaseIA, string> = {
  leyendo: 'Leyendo',
  estructura: 'Estructura',
  tablas: 'Tablas',
  tarjetas: 'Tarjetas',
  ordenando: 'Ordenando',
}

const ESTADO_TEMA = { espera: 'en espera', empieza: 'generando', listo: 'listo', fallo: 'no salió' } as const

// Color de cada bloque de primer nivel (los de las categorías del editor, en orden).
const COLORES = ['#6E9BC5', '#9B86BD', '#E8A598', '#D9A441', '#8BA888', '#D4667A', '#7D8A96']

export function ProgresoIA({
  fases,
  fase,
  lineas,
  segundos,
  detalle,
  arbol: arbolDado,
  temas,
  contador,
  vacio = 'La IA está leyendo el documento…',
}: {
  /** Las fases que tiene esta generación (sin «Incluir tablas», no hay fase de tablas). */
  fases: FaseIA[]
  fase: FaseIA
  lineas: LineaProvisional[]
  segundos: number
  /** Texto extra bajo las fases (p. ej. «Tema 3 de 16»). */
  detalle?: string
  /** Árbol ya montado (documento largo: un bloque por tema); si no, sale de `lineas`. */
  arbol?: RamaProvisional[]
  /** Documento largo: cómo va cada tema. */
  temas?: { titulo: string; estado: 'espera' | 'empieza' | 'listo' | 'fallo' }[]
  /** Texto del contador del borrador (flashcards: «N preguntas…»); por defecto, las ramas. */
  contador?: (lineas: LineaProvisional[]) => string
  /** Lo que se lee mientras aún no ha llegado nada. */
  vacio?: string
}) {
  const propio = useMemo(() => arbolProvisional(lineas), [lineas])
  const arbol = arbolDado ?? propio
  const actual = fases.indexOf(fase)
  const caja = useRef<HTMLDivElement>(null)
  // Se sigue el final mientras el usuario no suba a mirar algo.
  const pegado = useRef(true)

  useEffect(() => {
    const el = caja.current
    if (el && pegado.current) el.scrollTop = el.scrollHeight
  }, [lineas.length])

  return (
    <div
      className="mt-4 rounded-2xl bg-white px-4 py-4"
      style={{ border: `2px solid ${INK}`, boxShadow: STICKER_SHADOW }}
      role="status"
      aria-live="polite"
    >
      <ol className="flex flex-wrap items-center gap-2" aria-label="Fases">
        {fases.map((f, i) => {
          const hecha = i < actual
          const activa = i === actual
          return (
            <li
              key={f}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-extrabold"
              style={{
                border: `2px solid ${activa || hecha ? INK : '#D4C8BE'}`,
                background: activa ? '#E8A598' : hecha ? '#EDF3EC' : '#FFFFFF',
                color: activa ? '#FFFFFF' : hecha ? INK : '#7D8A96',
              }}
              aria-current={activa ? 'step' : undefined}
            >
              <span aria-hidden className="inline-block">
                <span className="material-symbols-outlined text-[1rem] leading-none">
                  {hecha ? 'check' : activa ? 'progress_activity' : 'radio_button_unchecked'}
                </span>
              </span>
              {NOMBRE[f]}
            </li>
          )
        })}
        <li className="ml-auto text-[0.75rem] font-bold tabular-nums text-[#7D8A96]">{segundos} s</li>
      </ol>
      {detalle && <p className="mt-2 text-[0.75rem] font-bold text-[#2C3E50]">{detalle}</p>}
      {temas && temas.length > 0 && (
        <ol className="mt-2 flex flex-wrap gap-1" aria-label="Temas">
          {temas.map((t, i) => (
            <li
              key={i}
              title={`${t.titulo}: ${ESTADO_TEMA[t.estado]}`}
              className={`flex h-[1.4rem] min-w-[1.6rem] items-center justify-center rounded-md px-1 text-[0.68rem] font-extrabold tabular-nums ${t.estado === 'empieza' ? 'animate-pulse' : ''}`}
              style={{
                border: `1.5px solid ${t.estado === 'espera' ? '#D4C8BE' : INK}`,
                background: t.estado === 'listo' ? '#8BA888' : t.estado === 'fallo' ? '#D4667A' : t.estado === 'empieza' ? '#E8A598' : '#FFFFFF',
                color: t.estado === 'espera' ? '#7D8A96' : '#FFFFFF',
              }}
            >
              {i + 1}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">Borrador</p>
        <p className="text-[0.7rem] text-[#7D8A96]">
          {lineas.length ? (contador ? contador(lineas) : `${lineas.length} ramas · se revisa y se ordena al terminar`) : vacio}
        </p>
      </div>
      <div
        ref={caja}
        onScroll={(e) => {
          const el = e.currentTarget
          pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        className="mt-1 max-h-[16rem] min-h-[6rem] overflow-y-auto rounded-xl bg-[#FAF7F4] px-3 py-2"
        style={{ border: '1.5px dashed #D4C8BE' }}
        aria-label="Mapa provisional"
      >
        {arbol.length === 0 ? (
          <div className="flex h-[5rem] items-center justify-center">
            <span className="h-1.5 w-1/2 overflow-hidden rounded-full bg-[#F1F3F5]">
              <span className="block h-full w-1/3 rounded-full bg-[#E8A598]" style={{ animation: 'ia-barra 1.4s ease-in-out infinite' }} />
            </span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {arbol.map((b, i) => (
              <Bloque key={b.key} rama={b} color={COLORES[i % COLORES.length]} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Bloque({ rama, color }: { rama: RamaProvisional; color: string }) {
  return (
    <li className="ia-prov-entra">
      <span
        className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[0.75rem] font-extrabold text-white"
        style={{ background: color, border: `1.5px solid ${INK}` }}
      >
        {rama.t}
      </span>
      {rama.hijos.length > 0 && <Ramas hijos={rama.hijos} color={color} />}
    </li>
  )
}

function Ramas({ hijos, color }: { hijos: RamaProvisional[]; color: string }) {
  return (
    <ul className="ml-3 mt-1 space-y-0.5 pl-3" style={{ borderLeft: `2px solid ${color}` }}>
      {hijos.map((h) => (
        <li key={h.key} className="ia-prov-entra text-[0.75rem] leading-snug text-[#2C3E50]">
          <span className={h.hijos.length ? 'font-bold' : ''}>{h.t}</span>
          {h.hijos.length > 0 && <Ramas hijos={h.hijos} color={color} />}
        </li>
      ))}
    </ul>
  )
}
